import test from "node:test";
import assert from "node:assert/strict";
import {
  parseNetworks, parseContainerFacts, sharedNetworks, localhostSettings, parseNslookup, parseProbe, diagnose,
  type ContainerFacts,
} from "./network.ts";

test("parseNetworks reads members with their addresses, without the mask", () => {
  const out = parseNetworks(JSON.stringify([
    { Name: "devnet", Driver: "bridge", IPAM: { Config: [{ Subnet: "172.18.0.0/16" }] }, Containers: { abc: { Name: "db", IPv4Address: "172.18.0.2/16" }, def: { Name: "web", IPv4Address: "172.18.0.3/16" } } },
    { Name: "bridge", Driver: "bridge", IPAM: { Config: [] }, Containers: {} },
    { Name: "empty", Driver: "bridge", Containers: null },
  ]));
  assert.equal(out[0].subnet, "172.18.0.0/16");
  assert.deepEqual(out[0].members.map((m) => `${m.name}=${m.ip}`), ["db=172.18.0.2", "web=172.18.0.3"]);
  assert.equal(out[1].subnet, "");
  assert.deepEqual(out[2].members, []);
  assert.deepEqual(parseNetworks("bad"), []);
});

const inspect = (o: object) => JSON.stringify([o]);

test("parseContainerFacts reads state, networks, environment and declared ports", () => {
  const f = parseContainerFacts(inspect({
    Name: "/kafka-ui", State: { Running: true },
    Config: { Env: ["A=1", "B=2"], ExposedPorts: { "8080/tcp": {}, "53/udp": {} } },
    NetworkSettings: { Networks: { devnet: { IPAddress: "172.18.0.5", Aliases: ["kafka-ui", "abc123"] }, bridge: { IPAddress: "172.17.0.2", Aliases: null } } },
  }))!;
  assert.equal(f.name, "kafka-ui");
  assert.equal(f.running, true);
  assert.deepEqual(f.env, ["A=1", "B=2"]);
  assert.deepEqual(f.ports, [8080]);
  assert.deepEqual(f.nets.map((n) => n.network).sort(), ["bridge", "devnet"]);
  assert.deepEqual(f.nets.find((n) => n.network === "bridge")!.aliases, []);
  assert.equal(parseContainerFacts("nope"), null);
});

const facts = (name: string, networks: string[], extra: Partial<ContainerFacts> = {}): ContainerFacts => ({
  name, running: true, env: [], ports: [], nets: networks.map((network) => ({ network, ip: "172.18.0.9", aliases: [] })), ...extra,
});

test("sharedNetworks finds user-defined networks both are on, and flags the default bridge case", () => {
  assert.deepEqual(sharedNetworks(facts("a", ["devnet", "bridge"]), facts("b", ["devnet"])), { named: ["devnet"], onlyBridge: false });
  assert.deepEqual(sharedNetworks(facts("a", ["bridge"]), facts("b", ["bridge"])), { named: [], onlyBridge: true });
  assert.deepEqual(sharedNetworks(facts("a", ["bridge"]), facts("b", ["devnet"])), { named: [], onlyBridge: false });
  assert.deepEqual(sharedNetworks(facts("a", ["host"]), facts("b", ["host"])), { named: [], onlyBridge: false });
});

test("localhostSettings flags values that point at localhost on the target's port, and proposes the fix", () => {
  const env = ["KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=localhost:9092", "URL=http://127.0.0.1:9092/x", "OTHER=localhost:5432", "NO_PROXY=localhost,127.0.0.1", "PLAIN=hello"];
  const out = localhostSettings(env, "kafka", [9092]);
  assert.deepEqual(out.map((s) => s.key), ["KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS", "URL"]);
  assert.equal(out[0].fixed, "KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:9092");
  assert.equal(out[1].fixed, "URL=http://kafka:9092/x");
  assert.deepEqual(localhostSettings([], "kafka", [9092]), []);
  assert.deepEqual(localhostSettings(["A=localhost:9092,localhost:9093"], "k", [9092]).map((s) => s.fixed), ["A=k:9092,localhost:9093"]);
});

const NSLOOKUP = "Server:\t\t127.0.0.11\nAddress:\t127.0.0.11#53\n\nNon-authoritative answer:\nName:\tkafka\nAddress: 172.18.0.3\n";

test("parseNslookup returns the resolved address, not the DNS server's", () => {
  assert.equal(parseNslookup(NSLOOKUP), "172.18.0.3");
  assert.equal(parseNslookup("** server can't find nope: NXDOMAIN"), null);
  assert.equal(parseNslookup(""), null);
});

test("parseProbe reads the exit markers from the helper container", () => {
  const ok = parseProbe(`${NSLOOKUP}\n::dns-exit=0\nConnection to kafka 9092 port [tcp/*] succeeded!\n::tcp-exit=0\n`);
  assert.deepEqual(ok, { dns: { ok: true, ip: "172.18.0.3" }, tcp: { ok: true } });
  const dnsFail = parseProbe("** server can't find nope: NXDOMAIN\n::dns-exit=1\nnc: bad address\n::tcp-exit=1\n");
  assert.deepEqual(dnsFail, { dns: { ok: false, ip: null }, tcp: { ok: false } });
  assert.deepEqual(parseProbe("pulling…"), { dns: { ok: false, ip: null }, tcp: { ok: false } });
});

const okProbe = { dns: { ok: true, ip: "172.18.0.3" }, tcp: { ok: true } };
const byId = (fs: ReturnType<typeof diagnose>, id: string) => fs.find((f) => f.id === id);

test("on the default bridge only, names don't resolve: say so and offer to connect both", () => {
  const f = diagnose({ from: facts("ui", ["bridge"]), to: facts("kafka", ["bridge"]), port: 9092, probe: null });
  const n = byId(f, "network")!;
  assert.equal(n.status, "fail");
  assert.match(n.detail, /default/i);
  assert.deepEqual(n.fix, { kind: "connect", network: "devnet", containers: ["ui", "kafka"] });
  assert.equal(byId(f, "dns"), undefined);
});

test("a different-networks case still explains why names need a shared network", () => {
  const f = diagnose({ from: facts("ui", ["bridge"]), to: facts("kafka", ["devnet"]), port: 9092, probe: null });
  assert.match(byId(f, "network")!.detail, /ui is on bridge and kafka is on devnet/);
  assert.match(byId(f, "network")!.detail, /both belong to/);
  assert.match(byId(f, "network")!.detail, /default network/i);
});

test("with no shared network the offer prefers a network the target is already on", () => {
  const f = diagnose({ from: facts("ui", ["bridge"]), to: facts("kafka", ["bridge", "stack"]), port: 9092, probe: null });
  assert.deepEqual(byId(f, "network")!.fix, { kind: "connect", network: "stack", containers: ["ui"] });
});

test("shared network, resolving name, open port: three passes and the honest closing note", () => {
  const f = diagnose({ from: facts("ui", ["devnet"]), to: facts("kafka", ["devnet"]), port: 9092, probe: okProbe });
  assert.deepEqual(["network", "dns", "port"].map((id) => byId(f, id)!.status), ["ok", "ok", "ok"]);
  assert.match(byId(f, "dns")!.detail, /172\.18\.0\.3/);
  assert.equal(byId(f, "summary")!.status, "info");
  assert.match(byId(f, "summary")!.detail, /different address/i);
});

test("a name that doesn't resolve is a failure, and the port check is skipped", () => {
  const f = diagnose({ from: facts("ui", ["devnet"]), to: facts("kafka", ["devnet"]), port: 9092, probe: { dns: { ok: false, ip: null }, tcp: { ok: false } } });
  assert.equal(byId(f, "dns")!.status, "fail");
  assert.equal(byId(f, "port"), undefined);
});

test("a closed port is a failure that names the ports the target declares", () => {
  const f = diagnose({ from: facts("ui", ["devnet"]), to: facts("kafka", ["devnet"], { ports: [9093, 9092] }), port: 9094, probe: { dns: { ok: true, ip: "1.2.3.4" }, tcp: { ok: false } } });
  const p = byId(f, "port")!;
  assert.equal(p.status, "fail");
  assert.match(p.detail, /9092/);
  assert.match(p.detail, /9093/);
});

test("a stopped container is reported before anything else", () => {
  const f = diagnose({ from: facts("ui", ["devnet"]), to: facts("kafka", ["devnet"], { running: false }), port: 9092, probe: null });
  assert.equal(f[0].id, "running");
  assert.equal(f[0].status, "fail");
  assert.match(f[0].title, /kafka/);
});

test("localhost settings in the client are warned about even when the network checks pass", () => {
  const f = diagnose({ from: facts("ui", ["devnet"], { env: ["X=localhost:9092"] }), to: facts("kafka", ["devnet"]), port: 9092, probe: okProbe });
  const l = byId(f, "localhost")!;
  assert.equal(l.status, "warn");
  assert.deepEqual(l.fix, { kind: "copy", label: "Copy corrected setting", text: "X=kafka:9092" });
  assert.equal(byId(f, "summary"), undefined);
});

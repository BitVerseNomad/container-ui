import test from "node:test";
import assert from "node:assert/strict";
import { appProblems } from "./apps.ts";

// Shapes as `docker inspect` prints them, trimmed to what the checks read.
type Extra = { mounts?: object[]; nets?: string[]; labels?: Record<string, string>; running?: boolean; mode?: string; restart?: string; name?: string };
const broker = (env: string[] = [], x: Extra = {}) => ({
  Name: `/${x.name ?? "kafka-u5it"}`,
  State: { Running: x.running ?? true },
  Config: { Image: "apache/kafka:3.9.0", Env: ["PATH=/usr/bin", ...env], Labels: x.labels ?? {} },
  HostConfig: { NetworkMode: x.mode ?? "devnet", RestartPolicy: { Name: x.restart ?? "no" } },
  NetworkSettings: { Ports: { "9092/tcp": [{ HostIp: "", HostPort: "9092" }], "9093/tcp": null }, Networks: Object.fromEntries((x.nets ?? ["devnet"]).map((n) => [n, {}])) },
  Mounts: x.mounts ?? [],
});
const ui = (env: string[] = [], x: Extra = {}, image = "provectuslabs/kafka-ui:latest") => ({
  Name: "/kafka-ui-xekw",
  State: { Running: x.running ?? true },
  Config: { Image: image, Env: ["PATH=/usr/bin", "JAVA_HOME=/opt/java", "TZ=UTC", ...env], Labels: x.labels ?? {} },
  HostConfig: { NetworkMode: x.mode ?? "devnet", RestartPolicy: { Name: "no" } },
  NetworkSettings: { Ports: { "8080/tcp": [{ HostIp: "", HostPort: "8080" }] }, Networks: Object.fromEntries((x.nets ?? ["devnet"]).map((n) => [n, {}])) },
  Mounts: x.mounts ?? [],
});

test("Given Kafka UI with no cluster and a broker on image defaults, when checked, then both get a safe replace command", () => {
  const out = appProblems([broker(), ui()], "colima");
  const [k] = out.get("kafka-u5it")!;
  const [u] = out.get("kafka-ui-xekw")!;
  assert.equal(k.id, "kafka-localhost");
  assert.match(k.detail, /no topics/);
  const t = k.fix!.text;
  assert.match(t, /^docker --context 'colima' rename kafka-u5it kafka-u5it-old && docker --context 'colima' stop kafka-u5it-old && \\\n/);
  assert.match(t, /run -d --name kafka-u5it --network 'devnet' -p 9092:9092 \\/);
  assert.match(t, /-e CLUSTER_ID='5L6g3nShT-eMCtK--X86sw'/);
  assert.match(t, /-e KAFKA_ADVERTISED_LISTENERS='PLAINTEXT_HOST:\/\/localhost:9092,PLAINTEXT:\/\/kafka-u5it:19092'/);
  assert.match(t, /-e KAFKA_LOG_DIRS='\/tmp\/kraft-combined-logs'/);
  assert.match(t, /apache\/kafka:3\.9\.0 && \\\ndocker --context 'colima' rm kafka-u5it-old$/);
  assert.doesNotMatch(t, /rm -f/);
  assert.equal(u.id, "kafka-ui-empty");
  assert.match(u.detail, /Fix replaces kafka-u5it first, then kafka-ui-xekw/);
  assert.deepEqual(u.fix!.steps!.map((r) => r.name), ["kafka-u5it", "kafka-ui-xekw"]);
  assert.deepEqual(k.fix!.steps!.map((r) => r.name), ["kafka-u5it"]);
  assert.match(u.fix!.text, /rename kafka-u5it kafka-u5it-old[\s\S]*rename kafka-ui-xekw kafka-ui-xekw-old/);
  assert.match(u.fix!.text, /-e KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS='kafka-u5it:19092'/);
  assert.match(u.fix!.text, /-e TZ='UTC'/);
  assert.doesNotMatch(u.fix!.text, /PATH=|JAVA_HOME=/);
});

test("Given a broker that advertises a container address, when checked, then only Kafka UI is flagged and uses that address", () => {
  const out = appProblems([broker(["KAFKA_ADVERTISED_LISTENERS=PLAINTEXT_HOST://localhost:9092,PLAINTEXT://kafka-u5it:29092"]), ui()]);
  assert.equal(out.has("kafka-u5it"), false);
  const [u] = out.get("kafka-ui-xekw")!;
  assert.doesNotMatch(u.detail, /first/);
  assert.match(u.fix!.text, /BOOTSTRAPSERVERS='kafka-u5it:29092'/);
});

test("Given a broker with its own listeners and no advertised ones, when checked, then it is not flagged", () => {
  const out = appProblems([broker(["KAFKA_PROCESS_ROLES=broker,controller", "KAFKA_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093"]), ui()]);
  assert.equal(out.has("kafka-u5it"), false);
  assert.match(out.get("kafka-ui-xekw")![0].fix!.text, /BOOTSTRAPSERVERS='kafka-u5it:9092'/);
});

test("Given Kafka UI with two clusters and one on localhost, when checked, then only that one changes", () => {
  const out = appProblems([broker(["KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka-u5it:19092"]), ui(["KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=prod:9092", "KAFKA_CLUSTERS_1_BOOTSTRAPSERVERS=localhost:9092", "SPRING_SECURITY_USER_PASSWORD=it's"])]);
  const [u] = out.get("kafka-ui-xekw")!;
  assert.equal(u.id, "kafka-ui-localhost");
  assert.match(u.fix!.text, /KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS='prod:9092'/);
  assert.match(u.fix!.text, /KAFKA_CLUSTERS_1_BOOTSTRAPSERVERS='kafka-u5it:19092'/);
  assert.match(u.fix!.text, /SPRING_SECURITY_USER_PASSWORD='it'\\''s'/);
  assert.doesNotMatch(u.fix!.text, /CLUSTERS_0_NAME/);
});

test("Given Kafka UI with a cluster, a config file, or dynamic config, when checked, then nothing is flagged", () => {
  assert.equal(appProblems([ui(["KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=kafka:19092"])]).size, 0);
  assert.equal(appProblems([ui(["DYNAMIC_CONFIG_ENABLED=true"])]).size, 0);
  assert.equal(appProblems([ui(["SPRING_CONFIG_ADDITIONAL-LOCATION=/config.yml"])]).size, 0);
  assert.equal(appProblems([ui([], { mounts: [{ Type: "bind", Source: "/x", Destination: "/etc/kafkaui/dynamic_config.yaml" }] })]).size, 0);
});

test("Given host networking, a lone broker, or stopped containers, when checked, then nothing is flagged", () => {
  assert.equal(appProblems([broker(), ui(["KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=localhost:9092"], { mode: "host", nets: ["host"] })]).size, 0);
  assert.equal(appProblems([broker()]).size, 0);
  assert.equal(appProblems([broker(), ui([], { running: false })]).size, 0);
});

test("Given a stopped broker next to a running one, when checked, then Kafka UI is pointed at the running one", () => {
  const out = appProblems([broker([], { name: "kafka-old", running: false }), broker(["KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka:19092"], { name: "kafka" }), ui()]);
  assert.match(out.get("kafka-ui-xekw")![0].fix!.text, /BOOTSTRAPSERVERS='kafka:19092'/);
});

test("Given no Kafka container, when checked, then there is advice but no command with placeholders", () => {
  const [u] = appProblems([ui(["KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=localhost:9092"], {}, "kafbat/kafka-ui:latest")]).get("kafka-ui-xekw")!;
  assert.equal(u.fix, undefined);
  assert.match(u.detail, /host\.docker\.internal:9092/);
});

test("Given compose and Kubernetes containers, when checked, then compose gets service lines and Kubernetes gets no command", () => {
  const labels = { "com.docker.compose.project": "shop", "com.docker.compose.service": "kafka-ui", "com.docker.compose.project.working_dir": "/Users/me/My Code/shop" };
  const [u] = appProblems([broker(["KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka-u5it:19092"]), ui([], { labels })]).get("kafka-ui-xekw")!;
  assert.match(u.fix!.text, /^environment:\n  KAFKA_CLUSTERS_0_NAME: "local"\n  KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: "kafka-u5it:19092"\n\ncd '\/Users\/me\/My Code\/shop' && docker compose up -d kafka-ui$/);
  const [k] = appProblems([broker([], { labels: { "io.kubernetes.pod.name": "kafka-0" } }), ui()]).get("kafka-u5it")!;
  assert.equal(k.fix, undefined);
  assert.match(k.detail, /Kubernetes pod/);
});

test("Given extra networks, a restart policy and volumes, when replaced, then all come back", () => {
  const vols = [{ Type: "volume", Name: "kafka-data3", Destination: "/var/lib/kafka/data", RW: true }, { Type: "bind", Source: "/Users/me/My Drive/k", Destination: "/k", RW: false }, { Type: "tmpfs", Destination: "/scratch" }];
  const [k] = appProblems([broker([], { mounts: vols, nets: ["devnet", "appnet"], restart: "unless-stopped" }), ui()]).get("kafka-u5it")!;
  const t = k.fix!.text;
  assert.match(t, /--network 'devnet' --restart unless-stopped/);
  assert.match(t, /\n  -v 'kafka-data3:\/var\/lib\/kafka\/data' \\\n/);
  assert.match(t, /-v '\/Users\/me\/My Drive\/k:\/k:ro'/);
  assert.doesNotMatch(t, /scratch/);
  assert.match(t, /network connect 'appnet' kafka-u5it && \\/);
  assert.match(k.detail, /no topics/); // the volume isn't where the topics are
});

test("Given a log dir on a volume, when checked, then no topic loss is claimed and the log dir is kept", () => {
  const vol = { Type: "bind", Source: "/Users/me/kafka", Destination: "/var/lib/kafka/data", RW: true };
  const [k] = appProblems([broker(["KAFKA_LOG_DIRS=/var/lib/kafka/data/logs", "KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://localhost:9092"], { mounts: [vol] }), ui()]).get("kafka-u5it")!;
  assert.doesNotMatch(k.detail, /no topics/);
  assert.match(k.fix!.text, /KAFKA_LOG_DIRS='\/var\/lib\/kafka\/data\/logs'/);
});

test("Given a broker only on the default bridge, when replaced, then a network is made first", () => {
  const [k] = appProblems([broker([], { nets: ["bridge"], mode: "default" }), ui([], { nets: ["bridge"], mode: "default" })]).get("kafka-u5it")!;
  assert.match(k.fix!.text, /^docker --context 'colima' network create kafka\n/);
  assert.match(k.fix!.text, /--network 'kafka'/);
});

test("Given a mount the app may not use or a compose container, when checked, then Fix is copy-only", () => {
  const outside = { Type: "bind", Source: "/opt/kafka-data", Destination: "/data", RW: true };
  assert.equal(appProblems([broker([], { mounts: [outside] }), ui()]).get("kafka-u5it")![0].fix!.steps, undefined);
  // The broker can't be replaced by the app, so Kafka UI's Fix is copy-only too.
  assert.equal(appProblems([broker([], { mounts: [outside] }), ui()]).get("kafka-ui-xekw")![0].fix!.steps, undefined);
  const labels = { "com.docker.compose.project": "shop" };
  assert.equal(appProblems([broker(["KAFKA_ADVERTISED_LISTENERS=PLAINTEXT://kafka-u5it:19092"]), ui([], { labels })]).get("kafka-ui-xekw")![0].fix!.steps, undefined);
});

test("Given a replace step, when it is built, then its run args are the shape the backend accepts", () => {
  const vol = { Type: "volume", Name: "kafka-data3", Destination: "/var/lib/kafka/data", RW: true };
  const [r] = appProblems([broker([], { mounts: [vol], nets: ["devnet", "appnet"], restart: "unless-stopped" }), ui()]).get("kafka-u5it")![0].fix!.steps!;
  assert.deepEqual(r.run.slice(0, 10), ["run", "-d", "--name", "kafka-u5it", "--network", "devnet", "--restart", "unless-stopped", "-p", "9092:9092"]);
  assert.deepEqual(r.run.slice(10, 12), ["-v", "kafka-data3:/var/lib/kafka/data"]);
  assert.equal(r.run[r.run.length - 1], "apache/kafka:3.9.0");
  assert.equal((r.run.length - 3) % 2, 0); // flag and value pairs between "run -d" and the image
  assert.deepEqual(r.connect, ["appnet"]);
});

test("Given a port bound to 127.0.0.1 and an on-failure retry count, when replaced, then both carry over", () => {
  const b = broker([], { restart: "on-failure" });
  b.NetworkSettings.Ports["9092/tcp"] = [{ HostIp: "127.0.0.1", HostPort: "9092" }];
  (b.HostConfig.RestartPolicy as { MaximumRetryCount?: number }).MaximumRetryCount = 3;
  const [k] = appProblems([b, ui()]).get("kafka-u5it")!;
  const run = k.fix!.steps!.at(-1)!.run;
  assert.ok(run.join(" ").includes("-p 127.0.0.1:9092:9092"));
  assert.ok(run.join(" ").includes("--restart on-failure:3"));
});

test("Given a broker with its own settings, when replaced, then they are kept next to the listener setup", () => {
  const [k] = appProblems([broker(["KAFKA_LISTENERS=PLAINTEXT://localhost:9092", "KAFKA_HEAP_OPTS=-Xmx512m", "TZ=Europe/Lisbon"]), ui()]).get("kafka-u5it")!;
  const run = k.fix!.steps!.at(-1)!.run;
  assert.ok(run.includes("KAFKA_HEAP_OPTS=-Xmx512m") && run.includes("TZ=Europe/Lisbon"));
  assert.ok(!run.includes("KAFKA_LISTENERS=PLAINTEXT://localhost:9092"), "the broken listener is replaced");
  assert.ok(!run.some((a) => a.startsWith("PATH=")), "image settings are left to the image");
});

test("Given settings Fix can't run again, when checked, then Fix is copy-only and says which", () => {
  const b = broker();
  Object.assign(b.HostConfig, { Memory: 1073741824, ExtraHosts: ["db:10.0.0.5"] });
  const [k] = appProblems([b, ui()]).get("kafka-u5it")!;
  assert.equal(k.fix!.steps, undefined);
  assert.match(k.detail, /memory or CPU limits, extra hosts, which Fix can't carry over/);
  const udp = broker();
  udp.NetworkSettings.Ports["9999/udp"] = [{ HostIp: "", HostPort: "9999" }];
  assert.equal(appProblems([udp, ui()]).get("kafka-u5it")![0].fix!.steps, undefined);
});

// --rm would delete the old copy the moment Fix stops it, so nothing is left to put back; the others would just vanish.
test("Given --rm, tmpfs, log options or other run flags, when checked, then Fix is copy-only and names each one", () => {
  const cases: [Record<string, unknown>, RegExp][] = [
    [{ AutoRemove: true }, /removed when it stops \(--rm\)/],
    [{ Tmpfs: { "/scratch": "" } }, /a tmpfs mount/],
    [{ LogConfig: { Type: "json-file", Config: { "max-size": "10m" } } }, /log options/],
    [{ Sysctls: { "net.core.somaxconn": "1024" } }, /kernel settings \(sysctls\)/],
    [{ PidMode: "host" }, /a shared process or IPC namespace/],
    [{ IpcMode: "host" }, /a shared process or IPC namespace/],
    [{ PublishAllPorts: true }, /all ports published \(-P\)/],
    [{ CapDrop: ["NET_RAW"] }, /dropped capabilities/],
  ];
  for (const [host, says] of cases) {
    const b = broker();
    Object.assign(b.HostConfig, host);
    const [k] = appProblems([b, ui()]).get("kafka-u5it")!;
    assert.equal(k.fix!.steps, undefined, JSON.stringify(host));
    assert.match(k.detail, says);
  }
  // Docker's own defaults are not settings someone chose.
  const plain = broker();
  Object.assign(plain.HostConfig, { IpcMode: "private", PidMode: "", LogConfig: { Type: "json-file", Config: {} }, Tmpfs: null, CapDrop: null });
  assert.ok(appProblems([plain, ui()]).get("kafka-u5it")![0].fix!.steps);
});

test("Given a replace step, when it is built, then it records what the container ran with", () => {
  const b = { ...broker(), Image: "sha256:abc", Config: { ...broker().Config, Cmd: ["/etc/kafka/docker/run"], User: "appuser" } };
  const [k] = appProblems([b, ui()]).get("kafka-u5it")!;
  assert.deepEqual(k.fix!.steps!.at(-1)!.keep, { image: "apache/kafka:3.9.0", imageId: "sha256:abc", Cmd: ["/etc/kafka/docker/run"], Entrypoint: undefined, User: "appuser", WorkingDir: undefined, Healthcheck: undefined });
});

test("Given a broker that restarts always, when its Fix is built, then the commands turn that off on the old copy too", () => {
  const [k] = appProblems([broker([], { restart: "always" }), ui()], "colima").get("kafka-u5it")!;
  assert.equal(k.fix!.steps![0].restart, "always");
  assert.match(k.fix!.text, /rename kafka-u5it kafka-u5it-old && docker --context 'colima' update --restart no kafka-u5it-old && docker --context 'colima' stop kafka-u5it-old/);
});

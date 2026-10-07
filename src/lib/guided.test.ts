import test from "node:test";
import assert from "node:assert/strict";
import {
  parseImageInfo, safeLink, hubLink, docsLinks, suggestVolumes, hostArch, checkImage,
  usedHostPorts, containerPorts, portWarnings, nameWarning, peers,
} from "./guided.ts";

const inspect = (o: object) => JSON.stringify([o]);

test("parseImageInfo reads what the image declares", () => {
  const i = parseImageInfo(inspect({
    Architecture: "arm64", Os: "linux",
    Config: { Env: ["A=1"], ExposedPorts: { "8080/tcp": {}, "53/udp": {}, "443/tcp": {} }, Volumes: { "/b": {}, "/a": {} }, Labels: { x: "y" } },
  }))!;
  assert.deepEqual(i, { arch: "arm64", os: "linux", env: ["A=1"], ports: ["443", "8080"], volumes: ["/a", "/b"], labels: { x: "y" } });
});

test("parseImageInfo tolerates null fields and bad input", () => {
  const i = parseImageInfo(inspect({ Architecture: "amd64", Config: { Env: null, ExposedPorts: null, Volumes: null, Labels: null } }))!;
  assert.deepEqual(i.env, []);
  assert.deepEqual(i.ports, []);
  assert.deepEqual(i.volumes, []);
  assert.deepEqual(i.labels, {});
  assert.equal(parseImageInfo("not json"), null);
  assert.equal(parseImageInfo("[]"), null);
});

test("safeLink accepts plain https only", () => {
  assert.deepEqual(safeLink("https://docs.docker.com/engine/storage/"), { url: "https://docs.docker.com/engine/storage/", host: "docs.docker.com" });
  for (const bad of ["http://example.com", "javascript:alert(1)", "https://user:pw@example.com/", "https://localhost/", "ftp://example.com", "", undefined, "not a url"]) {
    assert.equal(safeLink(bad as string), null, String(bad));
  }
});

test("hubLink builds the Docker Hub page for official and user images", () => {
  assert.equal(hubLink("postgres")?.url, "https://hub.docker.com/_/postgres");
  assert.equal(hubLink("postgres:18")?.url, "https://hub.docker.com/_/postgres");
  assert.equal(hubLink("library/redis:7")?.url, "https://hub.docker.com/_/redis");
  assert.equal(hubLink("acme/orders-api:1.4")?.url, "https://hub.docker.com/r/acme/orders-api");
  assert.equal(hubLink("docker.io/acme/x@sha256:abc")?.url, "https://hub.docker.com/r/acme/x");
});

test("hubLink returns null for other registries", () => {
  assert.equal(hubLink("ghcr.io/acme/x:1"), null);
  assert.equal(hubLink("localhost:5000/app"), null);
  assert.equal(hubLink("123456789012.dkr.ecr.eu-west-1.amazonaws.com/app:1"), null);
});

test("docsLinks prefers the image's own labels and falls back to the Hub page", () => {
  const l = docsLinks("acme/x:1", {
    "org.opencontainers.image.documentation": "https://acme.example/docs",
    "org.opencontainers.image.source": "https://github.com/acme/x",
  });
  assert.equal(l.docs?.host, "acme.example");
  assert.equal(l.source?.host, "github.com");
  assert.equal(l.hub?.host, "hub.docker.com");
});

test("docsLinks uses the url label, then legacy label-schema keys, and ignores unsafe values", () => {
  assert.equal(docsLinks("a/b", { "org.opencontainers.image.url": "https://a.example/" }).docs?.host, "a.example");
  assert.equal(docsLinks("a/b", { "org.label-schema.usage": "https://old.example/usage" }).docs?.host, "old.example");
  assert.equal(docsLinks("a/b", { "org.opencontainers.image.documentation": "javascript:alert(1)" }).docs, null);
});

test("suggestVolumes gives each declared path a named volume", () => {
  assert.deepEqual(suggestVolumes("db", ["/var/lib/data"]), [{ source: "db-data", target: "/var/lib/data" }]);
  assert.deepEqual(suggestVolumes("db", ["/a", "/b"]), [{ source: "db-data", target: "/a" }, { source: "db-data2", target: "/b" }]);
  assert.deepEqual(suggestVolumes("db", []), []);
});

test("hostArch maps Colima's names to Docker's", () => {
  assert.equal(hostArch("aarch64"), "arm64");
  assert.equal(hostArch("x86_64"), "amd64");
  assert.equal(hostArch("riscv64"), "riscv64");
});

const info = (arch: string) => ({ arch, os: "linux", env: [], ports: [], volumes: [], labels: {} });

test("checkImage warns about a different CPU and an unpinned version", () => {
  const w = checkImage("acme/x:1.4", info("amd64"), "arm64");
  assert.equal(w.length, 1);
  assert.match(w[0], /amd64/);
  assert.match(checkImage("nginx", info("arm64"), "arm64")[0], /latest/);
  assert.match(checkImage("nginx:latest", info("arm64"), "arm64")[0], /latest/);
});

test("checkImage is quiet for a pinned image on the right CPU, or a digest", () => {
  assert.deepEqual(checkImage("nginx:1.27", info("arm64"), "arm64"), []);
  assert.deepEqual(checkImage("nginx@sha256:abc", info("arm64"), "arm64"), []);
  assert.deepEqual(checkImage("localhost:5000/app:2", info("arm64"), "arm64"), []);
  assert.match(checkImage("localhost:5000/app", info("arm64"), "arm64")[0], /latest/);
});

const ctrs = [
  { Names: "web", State: "running", Ports: "0.0.0.0:8080->80/tcp, :::8080->80/tcp" },
  { Names: "db", State: "running", Ports: "5432/tcp" },
  { Names: "old", State: "exited", Ports: "0.0.0.0:9000->9000/tcp" },
];

test("usedHostPorts maps host ports of running containers only", () => {
  const u = usedHostPorts(ctrs);
  assert.equal(u.get("8080"), "web");
  assert.equal(u.has("9000"), false);
  assert.equal(u.has("5432"), false);
});

test("containerPorts reads the container side, published or not", () => {
  assert.deepEqual(containerPorts("0.0.0.0:8080->80/tcp, :::8080->80/tcp"), [80]);
  assert.deepEqual(containerPorts("5432/tcp"), [5432]);
  assert.deepEqual(containerPorts("9092/tcp, 0.0.0.0:3000->3000/tcp"), [3000, 9092]);
  assert.deepEqual(containerPorts(""), []);
});

test("portWarnings and nameWarning say what is taken", () => {
  const used = usedHostPorts(ctrs);
  assert.match(portWarnings([{ host: "8080" }, { host: "" }, { host: "3000" }], used)[0], /8080.*"web"/);
  assert.equal(portWarnings([{ host: "3000" }], used).length, 0);
  assert.match(nameWarning("db", ctrs)!, /"db" already exists/);
  assert.equal(nameWarning("fresh", ctrs), null);
  assert.equal(nameWarning("", ctrs), null);
});

test("peers lists the other running containers with the ports they listen on", () => {
  assert.deepEqual(peers(ctrs), [{ name: "web", ports: [80] }, { name: "db", ports: [5432] }]);
});

import test from "node:test";
import assert from "node:assert/strict";
import { doctor } from "./doctor.ts";

// `docker inspect` shapes, trimmed to what the checks read.
type C = { name: string; image: string; env?: string[]; nets?: string[]; exposed?: number[]; running?: boolean; exit?: number; error?: string; mounts?: object[]; ports?: Record<string, { HostIp: string; HostPort: string }[]>; imageId?: string };
const c = (x: C) => ({
  Id: `${x.name}0000000000000000`,
  Name: `/${x.name}`,
  Image: x.imageId ?? `sha256:${x.name}`,
  State: { Running: x.running ?? true, Status: x.running === false ? "exited" : "running", ExitCode: x.exit ?? 0, Error: x.error ?? "", OOMKilled: false, RestartCount: 0, StartedAt: "" },
  Config: { Image: x.image, Env: ["PATH=/usr/bin", ...(x.env ?? [])], Labels: {}, ExposedPorts: Object.fromEntries((x.exposed ?? []).map((p) => [`${p}/tcp`, {}])) },
  HostConfig: { NetworkMode: (x.nets ?? ["appnet"])[0], RestartPolicy: { Name: "no" } },
  NetworkSettings: { Ports: x.ports ?? {}, Networks: Object.fromEntries((x.nets ?? ["appnet"]).map((n) => [n, {}])) },
  Mounts: x.mounts ?? [],
});
const ids = (r: ReturnType<typeof doctor>) => r.findings.map((f) => f.key);

test("Given an app that points at localhost for another container's port, when checked, then it names the container and offers a replace", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "api", image: "my/api", env: ["DATABASE_URL=postgres://u@localhost:5432/app"], exposed: [8080] }), c({ name: "db", image: "postgres:16", exposed: [5432], env: ["POSTGRES_PASSWORD=x"], mounts: [{ Type: "volume", Name: "pgdata", Destination: "/var/lib/postgresql/data" }] })] });
  const f = r.findings.find((x) => x.id === "localhost-target")!;
  assert.equal(f.subject, "api");
  assert.match(f.detail, /DATABASE_URL is postgres:\/\/u@localhost:5432\/app/);
  assert.match(f.detail, /db:5432/);
  assert.ok(f.fix?.steps?.[0].run.includes("DATABASE_URL=postgres://u@db:5432/app"));
  assert.equal(r.byContainer.get("api")?.[0].id, "localhost-target");
});

test("Given an app that points at its own port on localhost, when checked, then nothing is flagged", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "api", image: "my/api", env: ["HEALTH_URL=http://localhost:8080/health"], exposed: [8080] }), c({ name: "web", image: "nginx", exposed: [8080] })] });
  assert.ok(!ids(r).some((k) => k.startsWith("localhost-target")));
});

test("Given two containers on the default bridge that use each other's names, when checked, then it explains bridge has no names and offers to connect", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "api", image: "my/api", env: ["REDIS_HOST=cache"], nets: ["bridge"] }), c({ name: "cache", image: "redis", nets: ["bridge"] })] });
  const f = r.findings.find((x) => x.id === "no-shared-network")!;
  assert.match(f.detail, /default network/);
  assert.deepEqual(f.fix?.connect, { network: "cache-net", create: true, containers: ["api", "cache"] });
});

test("Given a container that names another on a network it is not on, when checked, then the fix joins it to that network", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "api", image: "my/api", env: ["REDIS_HOST=cache"], nets: ["front"] }), c({ name: "cache", image: "redis", nets: ["back"] })] });
  assert.deepEqual(r.findings.find((x) => x.id === "no-shared-network")!.fix?.connect, { network: "back", create: false, containers: ["api"] });
});

test("Given a container that stopped over a taken port, when checked, then it names the container holding it", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "web2", image: "nginx", running: false, exit: 128, error: "driver failed programming external connectivity: Bind for 0.0.0.0:8080 failed: port is already allocated" }), c({ name: "web", image: "nginx", ports: { "80/tcp": [{ HostIp: "", HostPort: "8080" }] } })] });
  const f = r.findings.find((x) => x.id === "port-taken")!;
  assert.match(f.title, /port 8080 is taken/);
  assert.match(f.detail, /web is using it now/);
});

test("Given an amd64 image on an arm64 VM, when it runs, stops normally, or crashes, then it is worth knowing and never hides the crash", () => {
  const images = [{ Id: "sha256:old", Architecture: "amd64" }];
  const run = (x: Partial<C>) => doctor({ ctx: "colima", hostArch: "arm64", images, containers: [c({ name: "x", image: "old/tool", imageId: "sha256:old", ...x })] });
  const ok = run({});
  assert.equal(ok.findings.find((f) => f.id === "arch")!.severity, "know");
  assert.equal(ok.findings.find((f) => f.id === "arch")!.fix?.text, "docker --context 'colima' pull --platform linux/arm64 'old/tool'");
  assert.match(run({ running: false, exit: 143 }).findings.find((f) => f.id === "arch")!.title, /runs an amd64 image/, "a plain stop is not a failure");
  const crash = run({ running: false, exit: 1 });
  assert.equal(crash.findings.find((f) => f.id === "arch")!.severity, "know");
  assert.ok(crash.findings.some((f) => f.id === "crashed"), "the crash line stays");
  assert.equal(run({ image: "old/tool@sha256:abc" }).findings.find((f) => f.id === "arch")!.fix, undefined, "no tag, no pull command");
  assert.ok(!doctor({ ctx: "colima", hostArch: "arm64", containers: [c({ name: "x", image: "old/tool" })] }).passed.some((p) => /CPU/.test(p)), "no image data: not counted as passed");
});

test("Given postgres or mysql that exited without a password setting, when checked, then it names the setting and leaves the password to you", () => {
  const pg = doctor({ ctx: "colima", containers: [c({ name: "pg", image: "postgres:16", running: false, exit: 1 })] });
  assert.match(pg.findings.find((f) => f.id === "db-password")!.title, /no POSTGRES_PASSWORD/);
  const trust = doctor({ ctx: "colima", containers: [c({ name: "pg", image: "postgres:16", running: false, exit: 1, env: ["POSTGRES_HOST_AUTH_METHOD=trust"] })] });
  assert.ok(!ids(trust).some((k) => k.startsWith("db-password")));
  const my = doctor({ ctx: "colima", containers: [c({ name: "m", image: "docker.io/library/mysql:8", running: false, exit: 1 })] });
  assert.match(my.findings.find((f) => f.id === "db-password")!.detail, /MYSQL_ROOT_PASSWORD/);
});

test("Given databases with no volume, an unnamed one, or a named one, when checked, then only the first two are flagged", () => {
  const anon = "a".repeat(64);
  const r = doctor({ ctx: "colima", containers: [
    c({ name: "none", image: "postgres:16", env: ["POSTGRES_PASSWORD=x"] }),
    c({ name: "anon", image: "mongo:7", mounts: [{ Type: "volume", Name: anon, Destination: "/data/db" }] }),
    c({ name: "named", image: "mysql:8", env: ["MYSQL_ROOT_PASSWORD=x"], mounts: [{ Type: "volume", Name: "mydata", Destination: "/var/lib/mysql" }] }),
  ] });
  const flagged = r.findings.filter((f) => f.id === "db-volume").map((f) => f.subject).sort();
  assert.deepEqual(flagged, ["anon", "none"]);
  assert.match(r.findings.find((f) => f.subject === "none" && f.id === "db-volume")!.detail, /-v none-data:\/var\/lib\/postgresql/);
});

test("Given a 2 GB VM running Elasticsearch, when checked, then it points to Profiles", () => {
  const r = doctor({ ctx: "colima", vmMemory: 2 * 1024 ** 3, containers: [c({ name: "es", image: "elasticsearch:8.15.0" })] });
  const f = r.findings.find((x) => x.id === "vm-memory")!;
  assert.equal(f.fix?.go, "Profiles");
  assert.ok(!doctor({ ctx: "colima", vmMemory: 8 * 1024 ** 3, containers: [c({ name: "es", image: "elasticsearch:8.15.0" })] }).findings.some((x) => x.id === "vm-memory"));
});

test("Given 12 GB of unused images and cache, when checked, then it points to Images", () => {
  const disk = [{ kind: "images", size: 20e9, reclaimable: 9e9, count: 10, active: 2 }, { kind: "buildCache", size: 3e9, reclaimable: 3e9, count: 4, active: 0 }];
  const r = doctor({ ctx: "colima", containers: [], disk: disk as never });
  assert.match(r.findings.find((f) => f.id === "disk")!.title, /About 12 GB/);
});

test("Given a healthy setup, when checked, then every check is listed as passed and nothing needs action", () => {
  const r = doctor({ ctx: "colima", hostArch: "arm64", vmMemory: 8 * 1024 ** 3, disk: [{ kind: "images", size: 1e9, reclaimable: 0, count: 1, active: 1 }], images: [{ Id: "sha256:web", Architecture: "arm64" }], containers: [c({ name: "web", image: "nginx", imageId: "sha256:web" })] });
  assert.deepEqual(r.findings, []);
  assert.ok(r.passed.length >= 9);
  assert.match(r.passed[0], /No container crashed/);
});

test("Given findings of both kinds, when listed, then the ones needing action come first", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "none", image: "postgres:16", env: ["POSTGRES_PASSWORD=x"] }), c({ name: "pg", image: "postgres:16", running: false, exit: 1 })] });
  const sev = r.findings.map((f) => f.severity);
  assert.deepEqual(sev, [...sev].sort((a, b) => (a === b ? 0 : a === "action" ? -1 : 1)));
  assert.equal(sev[0], "action");
});

test("Given a muted finding, when checked, then it stays in the full list but leaves the per-container maps", () => {
  const containers = [c({ name: "pg", image: "postgres:16", running: false, exit: 1 })];
  const key = doctor({ ctx: "colima", containers }).findings.find((f) => f.id === "db-password")!.key;
  const r = doctor({ ctx: "colima", containers }, new Set([key]));
  assert.ok(r.findings.some((f) => f.key === key), "the page can still list it under Not an issue");
  assert.ok(!(r.byContainer.get("pg") ?? []).some((p) => p.id === "db-password"));
  assert.ok(!(r.extra.get("pg") ?? []).some((p) => p.id === "db-password"));
});

test("Given a crash finding, when mapped, then the container page's extra list leaves it out", () => {
  const r = doctor({ ctx: "colima", containers: [{ ...c({ name: "job", image: "acme/job", running: false, exit: 137 }), State: { Running: false, Status: "exited", ExitCode: 137, OOMKilled: true, RestartCount: 0, StartedAt: "", Error: "" } }] });
  assert.ok((r.byContainer.get("job") ?? []).length > 0);
  assert.equal((r.extra.get("job") ?? []).length, 0);
});

test("Given crash titles written for a container's own page, when listed, then each names its container", async () => {
  const { named } = await import("./doctor.ts");
  assert.equal(named("api", "Its health check is failing"), "api's health check is failing");
  assert.equal(named("worker", "It keeps restarting"), "worker keeps restarting");
  assert.equal(named("job", "Ran out of memory"), "job ran out of memory");
});

test("Given postgres stopped for a missing password, when listed, then the plain stopped-with-an-error line is left out", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "pg", image: "postgres:16", running: false, exit: 1 }), c({ name: "job", image: "acme/job", running: false, exit: 1 })] });
  assert.ok(!r.findings.some((f) => f.id === "crashed" && f.subject === "pg"));
  assert.ok(r.findings.some((f) => f.id === "crashed" && f.subject === "job"), "a stop with no known cause still shows");
});

test("Given addresses a browser uses or the app listens on, when checked, then localhost there is not flagged", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "api", image: "my/api", env: ["CORS_ORIGINS=http://localhost:3000", "LISTEN_ADDR=127.0.0.1:9000", "NEXTAUTH_URL=http://localhost:3000"] }), c({ name: "grafana", image: "grafana/grafana", exposed: [3000, 9000] })] });
  assert.ok(!r.findings.some((f) => f.id === "localhost-target"));
});

test("Given two containers on the port and none shared, when checked, then it asks which one and offers no one-click replace", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "api", image: "my/api", env: ["CACHE=redis://localhost:6379"], nets: ["front"] }), c({ name: "r1", image: "redis", exposed: [6379], nets: ["a"] }), c({ name: "r2", image: "redis", exposed: [6379], nets: ["b"] })] });
  const f = r.findings.find((x) => x.id === "localhost-target")!;
  assert.equal(f.severity, "know");
  assert.match(f.detail, /r1 and r2 all listen on 6379/);
  assert.equal(f.fix?.steps, undefined);
});

test("Given a container in another container's network, when checked, then localhost and names are left alone", () => {
  const pod = { ...c({ name: "app", image: "my/app", env: ["DB=postgres://localhost:5432/x", "REDIS_HOST=cache"], nets: [] }), HostConfig: { NetworkMode: "container:abc", RestartPolicy: { Name: "no" } } };
  const r = doctor({ ctx: "colima", containers: [pod, c({ name: "pg", image: "postgres:16", exposed: [5432], env: ["POSTGRES_PASSWORD=x"], mounts: [{ Type: "volume", Name: "d", Destination: "/var/lib/postgresql/data" }] }), c({ name: "cache", image: "redis", nets: ["back"] })] });
  assert.ok(!r.findings.some((f) => f.subject === "app"));
});

test("Given URLs whose scheme or path is a container's name, when checked, then only the host part counts", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "web", image: "my/web", env: ["DATABASE_URL=postgres://u:p@host.docker.internal:5432/postgres", "SESSION_DRIVER=redis", "POSTGRES_USER=postgres"], nets: ["front"] }), c({ name: "postgres", image: "postgres:16", nets: ["back"], env: ["POSTGRES_PASSWORD=x"] }), c({ name: "redis", image: "redis", nets: ["back"] })] });
  assert.ok(!r.findings.some((f) => f.id === "no-shared-network"));
});

test("Given one name on a shared network and another not, when checked, then the one not shared is reported", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "web", image: "my/web", env: ["CACHE_HOST=cache", "QUEUE_URL=amqp://queue:5672", "DB_HOST=db"], nets: ["front"] }), c({ name: "cache", image: "redis", nets: ["front"] }), c({ name: "queue", image: "rabbitmq", nets: ["back"] })] });
  assert.match(r.findings.find((f) => f.id === "no-shared-network")!.title, /web can't find queue/);
});

test("Given postgres with saved data that stopped, when checked, then it is not blamed on a password and the crash line stays", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "pg", image: "postgres:15", running: false, exit: 1, mounts: [{ Type: "volume", Name: "pgdata", Destination: "/var/lib/postgresql/data" }] })] });
  assert.ok(!r.findings.some((f) => f.id === "db-password"));
  assert.ok(r.findings.some((f) => f.id === "crashed"));
  assert.ok(!r.passed.some((p) => /No container crashed/.test(p)));
});

test("Given a crash explained by a missing password, when listed, then Passed does not claim nothing crashed", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "pg", image: "postgres:16", running: false, exit: 1 })] });
  assert.ok(!r.passed.some((p) => /No container crashed/.test(p)));
});

test("Given a database on tmpfs, when checked, then it says the data goes on every stop", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "pg", image: "postgres:16", env: ["POSTGRES_PASSWORD=x"], mounts: [{ Type: "tmpfs", Destination: "/var/lib/postgresql/data" }] })] });
  assert.match(r.findings.find((f) => f.id === "db-volume")!.detail, /every stop deletes the data/);
});

test("Given the same finding in two profiles, when muted in one, then the other still shows it", () => {
  const containers = [c({ name: "pg", image: "postgres:16", running: false, exit: 1 })];
  const key = doctor({ ctx: "colima", containers }).findings.find((f) => f.id === "db-password")!.key;
  assert.ok(doctor({ ctx: "colima-work", containers }, new Set([key])).byContainer.get("pg")!.some((f) => f.id === "db-password"));
});

// A Fix renames the container to NAME-old while it starts a new one. If the app quit or the VM stopped mid-way,
// that copy is all that's left, and nothing else says so.
test("Given a stopped NAME-old and no NAME, when checked, then it says the Fix didn't finish and how to put it back", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "kafka-old", image: "apache/kafka:3.9.0", running: false, exit: 143 })] });
  const f = r.findings.find((x) => x.id === "fix-leftover")!;
  assert.equal(f.subject, "kafka-old");
  assert.equal(f.severity, "action");
  assert.match(f.title, /kafka is still named kafka-old/);
  assert.equal(f.fix?.text, "docker --context 'colima' rename kafka-old kafka && docker --context 'colima' start kafka");
  assert.equal(f.fix?.steps, undefined);
});

test("Given a stopped NAME-old next to a working NAME, when checked, then it is worth knowing, with the command to remove it", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "kafka", image: "apache/kafka:3.9.0" }), c({ name: "kafka-old", image: "apache/kafka:3.9.0", running: false, exit: 143 })] });
  const f = r.findings.find((x) => x.id === "fix-leftover")!;
  assert.equal(f.severity, "know");
  assert.equal(f.fix?.text, "docker --context 'colima' rm kafka-old");
  assert.ok(!r.findings.some((x) => x.id === "fix-leftover" && x.subject === "kafka"));
});

test("Given a running container whose name ends in -old, when checked, then it is not taken for a Fix leftover", () => {
  const r = doctor({ ctx: "colima", containers: [c({ name: "site-old", image: "nginx" })] });
  assert.ok(!r.findings.some((x) => x.id === "fix-leftover"));
  assert.ok(r.passed.includes("No container is left over from an unfinished Fix"));
});

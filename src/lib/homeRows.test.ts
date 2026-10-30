import { test } from "node:test";
import assert from "node:assert/strict";
import { KUBE_KEY, appState, appsFrom, runInfo, startWhat, stateWord } from "./homeRows.ts";

const ctr = (ID: string, Names: string, labels = "", State = "running", Status = "Up 2 hours") => ({ ID, Names, State, Status, Labels: labels });
const shop = (dir: string) => `com.docker.compose.project=shop,com.docker.compose.project.working_dir=${dir},com.docker.compose.project.config_files=${dir}/compose.yaml`;

test("Given two folders both called shop, when grouped, then they are two rows", () => {
  const apps = appsFrom([ctr("1", "shop-web-1", shop("/Users/a/one/shop")), ctr("2", "shop-web-2", shop("/Users/a/two/shop"))]);
  assert.equal(apps.length, 2);
  assert.deepEqual(apps.map((a) => a.rows.length), [1, 1]);
});

test("Given a folder typed with different case, when grouped, then it is one project", () => {
  const apps = appsFrom([ctr("1", "a", shop("/Users/a/Dev/shop")), ctr("2", "b", shop("/Users/a/dev/shop"))]);
  assert.equal(apps.length, 1);
});

test("Given loose containers and projects, when grouped, then rows are alphabetical and Kubernetes is last", () => {
  const apps = appsFrom([
    ctr("k", "k8s_web_pod_ns_uid_0"),
    ctr("z", "zebra"),
    ctr("1", "shop-web-1", shop("/Users/a/shop")),
    ctr("b", "blog"),
  ]);
  assert.deepEqual(apps.map((a) => a.name), ["blog", "shop", "zebra", "Kubernetes"]);
  assert.equal(apps.at(-1)!.key, KUBE_KEY);
});

test("Given the scan found the folder, when grouped, then its files come from the scan", () => {
  const apps = appsFrom([ctr("1", "shop-web-1", shop("/Users/a/shop"))], ["/Users/a/shop/docker-compose.yml"]);
  assert.deepEqual(apps[0].files, ["docker-compose.yml"]);
});

test("Given only the label names the file, when grouped, then the file comes from the label", () => {
  const apps = appsFrom([ctr("1", "shop-web-1", shop("/Users/a/shop"))]);
  assert.deepEqual(apps[0].files, ["compose.yaml"]);
});

// What `docker inspect` says of each container, as the home rows read it. ran: how long its last run took, in ms
// (20 s unless given; null for a container whose times docker never wrote).
const T0 = Date.parse("2026-10-29T08:00:00Z");
const inspect = (name: string, o: { restart?: string; ports?: boolean; health?: boolean; ran?: number | null; labels?: Record<string, string>; volume?: string } = {}) => ({
  Name: `/${name}`,
  State: o.ran === null ? { StartedAt: "2026-10-29T08:00:00Z", FinishedAt: "0001-01-01T00:00:00Z" } : { StartedAt: new Date(T0).toISOString(), FinishedAt: new Date(T0 + (o.ran ?? 20_000)).toISOString() },
  HostConfig: { RestartPolicy: { Name: o.restart ?? "no" }, PortBindings: o.ports ? { "5432/tcp": [{ HostIp: "", HostPort: "5432" }] } : {} },
  Config: { ...(o.health ? { Healthcheck: { Test: ["CMD", "pg_isready"] } } : {}), Labels: o.labels ?? {} },
  Mounts: o.volume ? [{ Type: "volume", Name: o.volume, Destination: "/data" }] : [],
});
const svc = (service: string, dependsOn = "") => ({
  "com.docker.compose.project": "shop",
  "com.docker.compose.project.working_dir": "/Users/me/code/shop",
  "com.docker.compose.service": service,
  ...(dependsOn ? { "com.docker.compose.depends_on": dependsOn } : {}),
});
const infoOf = (rows: unknown[]) => { const m = runInfo(rows); return (c: { Names: string }) => m.get(c.Names); };

test("Given a one-shot job that exited with code 0, when the state is read, then it is Finished and the project is still running", () => {
  const seed = ctr("2", "seed", "", "exited", "Exited (0) 3 hours ago");
  const info = infoOf([inspect("web", { ports: true }), inspect("seed")]);
  assert.deepEqual(appState([ctr("1", "web"), seed], info), { state: "running", up: 1, of: 1 });
  assert.equal(stateWord(seed, info(seed)), "Finished");
});

test("Given db stopped with exit 0 and a published port, when the state is read, then shop reads 5 of 6 running and db is Stopped", () => {
  const db = ctr("6", "db", "", "exited", "Exited (0) 1 minute ago");
  const rows = [ctr("1", "api"), ctr("2", "web"), ctr("3", "queue"), ctr("4", "worker"), ctr("5", "cache"), db];
  const info = infoOf([...["api", "web", "queue", "worker", "cache"].map((n) => inspect(n)), inspect("db", { ports: true })]);
  assert.deepEqual(appState(rows, info), { state: "partly", up: 5, of: 6 });
  assert.equal(stateWord(db, info(db)), "Stopped");
});

test("Given a service that exited 0 but has a health check or a restart policy, when read, then it is Stopped, not Finished", () => {
  const c = ctr("1", "db", "", "exited", "Exited (0) 1 minute ago");
  assert.equal(stateWord(c, runInfo([inspect("db", { health: true })]).get("db")), "Stopped");
  assert.equal(stateWord(c, runInfo([inspect("db", { restart: "unless-stopped" })]).get("db")), "Stopped");
  assert.equal(stateWord(c, runInfo([inspect("db", { restart: "" })]).get("db")), "Finished", "an unset policy is the same as no");
});

test("Given queue with no ports and no health check that ran 2 hours and exited 0, when read, then it is Stopped and shop reads 5 of 6 running", () => {
  const queue = ctr("6", "queue", "", "exited", "Exited (0) 1 minute ago");
  const rows = [ctr("1", "api"), ctr("2", "web"), ctr("3", "db"), ctr("4", "worker"), ctr("5", "cache"), queue];
  const info = infoOf([...["api", "web", "db", "worker", "cache"].map((n) => inspect(n)), inspect("queue", { ran: 2 * 3600_000 })]);
  assert.equal(stateWord(queue, info(queue)), "Stopped");
  assert.deepEqual(appState(rows, info), { state: "partly", up: 5, of: 6 });
});

test("Given a migration with no volume that ran 90 seconds and exited 0, when read, then it is Finished", () => {
  const m = ctr("1", "migrate", "", "exited", "Exited (0) 5 minutes ago");
  assert.equal(stateWord(m, runInfo([inspect("migrate", { ran: 90_000 })]).get("migrate")), "Finished");
});

test("Given db with a named volume stopped after 90 seconds with exit 0, when read, then it is Stopped", () => {
  const db = ctr("1", "db", "", "exited", "Exited (0) 1 minute ago");
  assert.equal(stateWord(db, runInfo([inspect("db", { ran: 90_000, volume: "shop_db" })]).get("db")), "Stopped");
  // An anonymous volume the image declared is not kept data.
  assert.equal(stateWord(db, runInfo([inspect("db", { ran: 90_000, volume: "a".repeat(64) })]).get("db")), "Finished");
});

test("Given a seed with no volume that ran 3 minutes and exited 0, when read, then it is Stopped", () => {
  const seed = ctr("1", "seed", "", "exited", "Exited (0) 1 minute ago");
  assert.equal(stateWord(seed, runInfo([inspect("seed", { ran: 3 * 60_000 })]).get("seed")), "Stopped");
});

test("Given a job another service waits for with service_completed_successfully that ran 10 minutes on a named volume, when read, then it is Finished", () => {
  const m = ctr("1", "migrate", "", "exited", "Exited (0) 5 minutes ago");
  const info = runInfo([inspect("migrate", { ran: 10 * 60_000, volume: "shop_db", labels: svc("migrate") }), inspect("api", { ports: true, labels: svc("api", "migrate:service_completed_successfully:false,db:service_healthy:false") })]);
  assert.equal(info.get("migrate")!.job, true);
  assert.equal(stateWord(m, info.get("migrate")), "Finished");
  // The same name in another project is not that project's job.
  const other = runInfo([inspect("migrate", { ran: 10 * 60_000, labels: { ...svc("migrate"), "com.docker.compose.project": "blog" } }), inspect("api", { labels: svc("api", "migrate:service_completed_successfully:false") })]);
  assert.equal(stateWord(m, other.get("migrate")), "Stopped");
});

test("Given a container whose run time is unknown, when read, then it is Stopped and the exit code alone never makes it Finished", () => {
  const c = ctr("1", "seed", "", "exited", "Exited (0) 1 minute ago");
  assert.equal(stateWord(c, runInfo([inspect("seed", { ran: null })]).get("seed")), "Stopped");
  assert.equal(stateWord(c, runInfo([{ Name: "/seed", HostConfig: {}, Config: {} }]).get("seed")), "Stopped");
});

test("Given a short job this app stopped, when read, then it is Stopped", () => {
  const c = ctr("1", "seed", "", "exited", "Exited (0) 1 minute ago");
  const i = runInfo([inspect("seed")]).get("seed")!;
  assert.equal(stateWord(c, { ...i, byApp: true }), "Stopped");
  assert.equal(stateWord(c, i), "Finished");
});

test("Given nothing is known of a container that exited 0, when read, then the safer reading wins: Stopped, and it counts as down", () => {
  const c = ctr("1", "db", "", "exited", "Exited (0) 1 minute ago");
  assert.equal(stateWord(c, undefined), "Stopped");
  assert.deepEqual(appState([ctr("2", "web"), c]), { state: "partly", up: 1, of: 2 });
});

test("Given one of three services crashed, when the state is read, then the project is partly running", () => {
  const s = appState([ctr("1", "web"), ctr("2", "db"), ctr("3", "api", "", "exited", "Exited (1) 1 minute ago")]);
  assert.deepEqual(s, { state: "partly", up: 2, of: 3 });
});

test("Given nothing runs, when the state is read, then it is stopped", () => {
  assert.equal(appState([ctr("1", "web", "", "exited", "Exited (137) 1 minute ago")]).state, "stopped");
});

test("Given two projects started from one folder, when grouped, then they are two rows", () => {
  const a = shop("/Users/a/shop");
  const apps = appsFrom([ctr("1", "shop-web-1", a), ctr("2", "test-web-1", a.replace("project=shop", "project=test"))]);
  assert.deepEqual(apps.map((x) => x.name), ["shop", "test"]);
});

// `docker compose up` in that folder would act on the folder's own project, so only that row may run Compose.
test("Given two projects from one folder, when grouped, then only the folder's default project keeps its file", () => {
  const a = shop("/Users/a/shop");
  const apps = appsFrom([ctr("1", "shop-web-1", a), ctr("2", "test-web-1", a.replace("project=shop", "project=test"))]);
  assert.deepEqual(apps.map((x) => x.files), [["compose.yaml"], []]);
});

test("Given one project whose name differs from its folder, when grouped, then it keeps its file", () => {
  const apps = appsFrom([ctr("1", "store-web-1", shop("/Users/a/shop").replace("project=shop", "project=store"))]);
  assert.deepEqual(apps[0].files, ["compose.yaml"]);
});

test("Given stopped services in a project, when its Start item is named, then it lists them, three at most", () => {
  assert.equal(startWhat(["worker"]), "worker");
  assert.equal(startWhat(["cache", "report-job"]), "the 2 stopped (cache, report-job)");
  assert.equal(startWhat(["a", "b", "c", "d", "e"]), "the 5 stopped (a, b, c and 2 more)");
});

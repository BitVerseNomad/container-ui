import { test } from "node:test";
import assert from "node:assert/strict";
import { KUBE_KEY, appState, appsFrom } from "./homeRows.ts";

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

test("Given a job that exited with code 0, when the state is read, then the project is still running", () => {
  const s = appState([ctr("1", "web"), ctr("2", "seed", "", "exited", "Exited (0) 3 hours ago")]);
  assert.deepEqual(s, { state: "running", up: 1, of: 1 });
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

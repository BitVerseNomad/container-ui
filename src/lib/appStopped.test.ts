import { test } from "node:test";
import assert from "node:assert/strict";
import { byApp, noteCompose, noteDocker, projectKey, resetAppStopped, stoppedAt } from "./appStopped.ts";

const FULL = "a".repeat(64);
const T = Date.parse("2026-10-29T09:00:00Z");

test("given the app stopped a container by its full ID, when its ps row is checked, then it was stopped by the app", () => {
  resetAppStopped();
  noteDocker("colima", ["stop", FULL], T);
  assert.equal(byApp(stoppedAt("colima", [FULL.slice(0, 12), "db"]), T - 60_000), true);
  assert.equal(stoppedAt("colima", ["bbbbbbbbbbbb", "web"]), undefined);
});

test("given the app stopped db and something started it later, when checked, then the later start clears it and the run-time rule decides", () => {
  resetAppStopped();
  noteDocker("colima", ["stop", "db"], T);
  // Started again from a terminal, a restart policy or a recreate under the same name: its run began after our stop.
  assert.equal(byApp(stoppedAt("colima", ["db"]), T + 5_000), false);
  assert.equal(byApp(stoppedAt("colima", ["db"]), T - 3600_000), true, "the run our stop ended still reads stopped by the app");
});

test("given db stopped in one profile, when the same name is checked in another, then it is not marked", () => {
  resetAppStopped();
  noteDocker("colima", ["stop", "db"], T);
  assert.equal(stoppedAt("colima-work", ["db"]), undefined);
  assert.equal(stoppedAt("colima", ["db"]), T);
});

test("given the app ran compose stop on a project, when one of its containers is checked, then it was stopped by the app", () => {
  resetAppStopped();
  noteCompose("colima", "/Users/me/code/Shop", "shop", "stop", T);
  assert.equal(stoppedAt("colima", ["x", "queue", projectKey("/users/me/code/shop", "shop")]), T, "the folder's letter case doesn't matter");
  noteDocker("colima", ["ps", "-a"], T + 1);
  noteCompose("colima", "/Users/me/code/Shop", "shop", "up", T + 2);
  assert.equal(stoppedAt("colima", [projectKey("/Users/me/code/Shop", "shop")]), T, "reads and starts add no stop");
});

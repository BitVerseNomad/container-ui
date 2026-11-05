import { test } from "node:test";
import assert from "node:assert/strict";
import { byApp, noteCompose, noteDocker, pinStopped, projectKey, resetAppStopped, runOf, stoppedAt, stoppedByApp } from "./appStopped.ts";

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

test("given a stop at Mac 08:00 and a terminal start whose VM clock says 07:58, when home looks again, then it reads by the run-time rule", () => {
  resetAppStopped();
  const vm = (t: string) => Date.parse(`2026-10-29T${t}:00Z`);
  noteDocker("colima", ["stop", "db"], vm("08:00"));
  // First look: db exited, its run began at 07:00, before our stop; that run is kept.
  assert.equal(stoppedByApp("colima", "abc", ["abc", "db"], vm("07:00"), true), true);
  // A terminal starts it; the VM's clock is two minutes behind the Mac's, so its StartedAt is 07:58, before the stop.
  // It is not the run we stopped, so it is not stopped by the app.
  assert.equal(stoppedByApp("colima", "abc", ["abc", "db"], vm("07:58"), true), false);
  // The run we stopped still reads as ours.
  assert.equal(stoppedByApp("colima", "abc", ["abc", "db"], vm("07:00"), true), true);
});

test("given a running container the app stopped a moment ago, when home looks before it has exited, then nothing is kept yet", () => {
  resetAppStopped();
  const T = Date.parse("2026-10-29T08:00:00Z");
  noteDocker("colima", ["stop", "db"], T);
  assert.equal(stoppedByApp("colima", "abc", ["db"], T - 60_000, false), true);
  // A second stop later: the kept run belongs to the old stop and is set again on the next look.
  assert.equal(stoppedByApp("colima", "abc", ["db"], T - 60_000, true), true);
  noteDocker("colima", ["stop", "db"], T + 3600_000);
  assert.equal(stoppedByApp("colima", "abc", ["db"], T + 1800_000, true), true);
  assert.equal(stoppedByApp("colima", "abc", ["db"], T - 60_000, true), false);
});

test("given the app stopped db and pinned its run at stop time, when the Mac clock is behind the VM, then db still reads stopped by the app until a new run starts", () => {
  resetAppStopped();
  const id = "d".repeat(64);
  // The Mac says 09:00; the VM's clock says the run started at 09:05. Compared, the stop would look older than the run.
  noteDocker("colima", ["stop", "db"], T);
  const started = "2026-10-29T09:05:00Z";
  pinStopped("colima", "db", runOf("db", [{ Id: id, Name: "/db", State: { StartedAt: started } }, { Id: "e".repeat(64), Name: "/web", State: { StartedAt: started } }]));
  assert.equal(stoppedByApp("colima", id.slice(0, 12), ["db"], Date.parse(started), true), true);
  // A later run (a terminal start) has another StartedAt: no longer the app's stop.
  assert.equal(stoppedByApp("colima", id.slice(0, 12), ["db"], Date.parse(started) + 60_000, false), false);
  // The project stop pins by its project key the same way.
  noteCompose("colima", "/Users/me/shop", "shop", "stop", T);
  pinStopped("colima", projectKey("/Users/me/shop", "shop"), [{ Id: "f".repeat(64), State: { StartedAt: started } }]);
  assert.equal(stoppedByApp("colima", "f".repeat(12), [projectKey("/Users/me/shop", "shop")], Date.parse(started), true), true);
});

test("given a stop pinned when it ran, when the container is recreated with a new ID, then the new one is not stopped by the app, even with the Mac clock ahead", () => {
  resetAppStopped();
  noteDocker("colima", ["stop", "db"], T);
  pinStopped("colima", "db", [{ Id: "1".repeat(64), Name: "/db", State: { StartedAt: "2026-10-29T08:00:00Z" } }]);
  // The recreate's run started "before" the Mac's stop time (the VM clock is behind): the clocks alone would say ours.
  assert.equal(stoppedByApp("colima", "2".repeat(12), ["db"], Date.parse("2026-10-29T08:59:00Z"), true), false);
  // A stop that never got its pin still uses the clocks.
  noteDocker("colima", ["stop", "cache"], T + 1);
  assert.equal(stoppedByApp("colima", "3".repeat(12), ["cache"], Date.parse("2026-10-29T08:00:00Z"), true), true);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { flipSaid, limitRaised, openFailure, notReady, parseMem, raisedLine, raisedText, serviceFacts, stillText } from "./composeLimit.ts";

const MiB = 1024 ** 2;
const cfg = (svc: object) => JSON.stringify({ name: "shop", services: { "report-job": svc, db: {} } });

test("given mem_limit or deploy.resources.limits.memory, when the config is read, then that service's limit is in bytes", () => {
  assert.equal(serviceFacts(cfg({ mem_limit: "268435456" }), "report-job")?.limit, 256 * MiB);
  assert.equal(serviceFacts(cfg({ deploy: { resources: { limits: { memory: "1073741824" } } } }), "report-job")?.limit, 1024 * MiB);
  assert.equal(serviceFacts(cfg({ mem_limit: "512m" }), "report-job")?.limit, 512 * MiB);
  assert.equal(serviceFacts(cfg({ mem_limit: "1g", deploy: { resources: { limits: { memory: "2g" } } } }), "report-job")?.limit, 1024 * MiB, "mem_limit wins");
  assert.equal(serviceFacts(cfg({}), "report-job")?.limit, 0, "no limit set");
  assert.equal(serviceFacts(cfg({ mem_limit: "lots" }), "report-job"), null, "unreadable: say nothing about it");
  assert.equal(serviceFacts("not json", "report-job"), null);
  assert.equal(parseMem("1.5g"), 1.5 * 1024 * MiB);
});

test("given a memory value as Docker accepts it, when parsed, then k m g t p with optional i and b are powers of 1024", () => {
  assert.equal(parseMem("268435456"), 256 * MiB, "bytes with no unit");
  assert.equal(parseMem("512b"), 512);
  assert.equal(parseMem("256MiB"), 256 * MiB);
  assert.equal(parseMem("1GB"), 1024 * MiB);
  assert.equal(parseMem("1 gi"), 1024 * MiB);
  assert.equal(parseMem("2t"), 2 * 1024 ** 4);
  assert.equal(parseMem("1PiB"), 1024 ** 5);
  assert.equal(parseMem("512k"), 512 * 1024);
  for (const bad of ["lots", "1x", "1gg", "-1g", "g", ""]) assert.equal(parseMem(bad), null, bad);
});

test("given what report-job depends on, when the project's containers are read, then a stopped db or an unfinished job is not ready", () => {
  const facts = serviceFacts(cfg({ depends_on: { db: { condition: "service_healthy" }, migrate: { condition: "service_completed_successfully" } } }), "report-job")!;
  const row = (svc: string, State: string, Status = "") => ({ State, Status, Labels: `com.docker.compose.project=shop,com.docker.compose.service=${svc}` });
  assert.deepEqual(notReady(facts.dependsOn, [row("db", "running"), row("migrate", "exited", "Exited (0) 2 hours ago")], "shop"), []);
  assert.deepEqual(notReady(facts.dependsOn, [row("db", "exited", "Exited (0) 1 hour ago"), row("migrate", "exited", "Exited (0) 2 hours ago")], "shop"), ["db"]);
  assert.deepEqual(notReady(facts.dependsOn, [row("db", "running"), row("migrate", "exited", "Exited (1) 1 hour ago")], "shop"), ["migrate"]);
  assert.deepEqual(notReady(facts.dependsOn, [row("db", "running")], "shop"), ["migrate"], "never created");
  assert.equal(facts.project, "shop");
  const other = (svc: string, State: string, Status = "") => ({ State, Status, Labels: `com.docker.compose.project=shop-old,com.docker.compose.service=${svc}` });
  assert.deepEqual(notReady(facts.dependsOn, [other("db", "running"), other("migrate", "exited", "Exited (0) 2 hours ago")], "shop"), ["db", "migrate"], "another project's containers don't count");
});

test("given the limit report-job was killed at, when the file is read again, then unchanged and raised read differently", () => {
  const a = { file: "/Users/me/code/shop/compose.yaml", service: "report-job", limit: 256 * MiB, where: "`compose.yaml`" };
  assert.equal(limitRaised(a, 256 * MiB), false);
  assert.equal(limitRaised(a, 1024 * MiB), true);
  assert.equal(limitRaised(a, 0), true, "no limit at all");
  assert.equal(raisedText(a, 1024 * MiB), "`compose.yaml` now sets 1 GiB for report-job.");
  assert.equal(stillText(a), "`compose.yaml` still sets 256 MiB for report-job. Raise it, then press Apply and start.");
  assert.equal(raisedText({ ...a, where: "the project's Compose files" }, 1024 * MiB), "The project's Compose files now set 1 GiB for report-job.");
});

test("given compose.yaml raised report-job's limit, when the line is written, then it shows the new value, the old one, and the one step left", () => {
  const a = { file: "/Users/me/code/shop/compose.yaml", service: "report-job", limit: 256 * MiB, where: "`compose.yaml`" };
  assert.equal(raisedLine(a, 1024 * MiB), "Its limit in `compose.yaml` is now 1 GiB (was 256 MiB). Apply it to start.");
  assert.equal(raisedLine(a, 0), "Its memory limit is no longer set in `compose.yaml` (was 256 MiB). Apply it to start.");
  assert.equal(raisedLine(a, 1024 * MiB, ["db"], "shop"), "Its limit in `compose.yaml` is now 1 GiB (was 256 MiB). Start shop first: report-job needs db.");
  assert.equal(raisedLine({ ...a, where: "the project's Compose files" }, 1024 * MiB), "Its limit in the project's Compose files is now 1 GiB (was 256 MiB). Apply it to start.");
});

test("given a limit line's button changed under the user, when it is said, then it names what the file says and the button now", () => {
  const a = { file: "/Users/me/code/shop/compose.yaml", service: "report-job", limit: 256 * MiB, where: "`compose.yaml`" };
  assert.equal(flipSaid(a, true, 1024 * MiB, "Apply and start", true), "compose.yaml now sets 1 GiB for report-job. The button is now Apply and start.");
  assert.equal(flipSaid(a, true, 1024 * MiB, "Apply and start", false), "compose.yaml now sets 1 GiB for report-job. Apply and start runs it now.");
  assert.equal(flipSaid(a, false, 0, "Open compose.yaml", true), "compose.yaml sets 256 MiB for report-job again. The button is now Open compose.yaml.");
});

test("given Open didn't open the file, when it is said, then it names the app and macOS's reason, with the way out", () => {
  assert.deepEqual(openFailure("compose.yaml", "OPEN_FAILED:Cursor\nThe application can't be opened"), { text: "Couldn't open `compose.yaml` in Cursor: the application can't be opened. Open it from Finder.", still: false, finder: true });
  assert.deepEqual(openFailure("compose.yaml", "OPEN_FAILED:TextEdit\n"), { text: "Couldn't open `compose.yaml` in TextEdit. Open it from Finder.", still: false, finder: true });
  assert.equal(openFailure("compose.yaml", "OPEN_FAILED:\n").text, "Couldn't open `compose.yaml` in an editor. Open it from Finder.");
  assert.equal(openFailure("compose.yaml", "OPEN_FAILED:Cursor\nLSOpenURLsWithRole() failed with error -54").text, "Couldn't open `compose.yaml` in Cursor: LSOpenURLsWithRole() failed with error -54. Open it from Finder.", "a code-like reason stays as it is");
  assert.deepEqual(openFailure("compose.yaml", "STILL_OPENING"), { text: "Still opening `compose.yaml`…", still: true, finder: false });
  assert.deepEqual(openFailure("compose.yaml", "compose.yaml is in a linked folder outside your home, so it can't be opened from here"), { text: "Couldn't open `compose.yaml`. compose.yaml is in a linked folder outside your home, so it can't be opened from here", still: false, finder: false });
});

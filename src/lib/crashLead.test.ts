import { test } from "node:test";
import assert from "node:assert/strict";
import { crashLead } from "./crashLead.ts";

const logs = [
  "2026-10-28T15:00:00.1Z worker 2.0 starting",
  "2026-10-28T15:00:01.1Z ERROR job 4182 failed: open /data/in/4182.png: no such file or directory",
  "2026-10-28T15:00:02.1Z fatal: too many failed jobs in a row, exiting with code 1",
].join("\n");

test("given a crash log, when read, then the line with a known cause wins over the last error line", () => {
  assert.equal(crashLead(logs, [])!.line, "ERROR job 4182 failed: open /data/in/4182.png: no such file or directory");
});

test("given only errors with no known cause, when read, then the last error line is picked, without its time", () => {
  assert.deepEqual(crashLead("2026-10-28T15:00:00.1Z boot\n2026-10-28T15:00:01.1Z panic: nil map", []), { line: "panic: nil map", hint: null });
});

test("given a missing file in a folder nothing is mounted at, when read, then it says to mount that folder", () => {
  const lead = crashLead("open /data/in/4182.png: no such file or directory", []);
  assert.match(lead!.hint!, /^Nothing is mounted at \/data\/in, so \/data\/in\/4182\.png isn't there/);
  assert.match(crashLead("open /data/in/4182.png: no such file or directory", [{ Destination: "/data" }])!.hint!, /missing from the folder mounted there/);
});

test("given a refused connection to localhost, when read, then it explains localhost inside a container", () => {
  assert.match(crashLead("dial tcp 127.0.0.1:5432: connect: connection refused", [])!.hint!, /localhost is the container itself/);
  assert.match(crashLead("Error: connect ECONNREFUSED db:5432", [])!.hint!, /Nothing answered at db:5432/);
});

test("given logs with no error, when read, then there is no lead", () => {
  assert.equal(crashLead("listening on :80\nGET / 200", []), null);
});

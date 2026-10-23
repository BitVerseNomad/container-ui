import { test } from "node:test";
import assert from "node:assert/strict";
import { explainStartFailure, limaLogPath } from "./startFailure.ts";

test("given a stale ha.pid left after sleep, when explained, then it offers a force stop", () => {
  const e = explainStartFailure('FATA[0001] error starting vm: instance "colima" seems to be running (hostagent pid 4123 in ~/.colima/_lima/colima/ha.pid)', "default");
  assert.equal(e.kind, "stuck");
  assert.equal(e.fix, "force_restart");
});

test("given the VM never answers over ssh, when explained, then it is treated as stuck", () => {
  const e = explainStartFailure('level=fatal msg="error starting vm: did not receive an event with the \\"running\\" status"\nwaiting for the essential requirement 1 of 2: "ssh"', "default");
  assert.equal(e.kind, "stuck");
});

test("given a checksum error, when explained, then it blames the download and offers no destructive fix", () => {
  const e = explainStartFailure("FATA[0004] error downloading image: expected digest sha256:abc, got sha256:def", "default");
  assert.equal(e.kind, "download");
  assert.equal(e.fix, "retry");
});

test("given a port already in use, when explained, then it says so in plain words", () => {
  const e = explainStartFailure("listen tcp 127.0.0.1:6443: bind: address already in use", "default");
  assert.equal(e.kind, "port");
  assert.match(e.title, /port/i);
});

test("given an unknown exit status and no log, when explained, then it points at the VM log and only offers a retry", () => {
  const e = explainStartFailure("FATA[0009] error starting vm: exit status 1", "work");
  assert.equal(e.kind, "unknown");
  assert.equal(e.fix, "retry");
  assert.match(e.detail, /colima-work\/ha\.stderr\.log/);
});

test("given a vague CLI error but a stale pid in the VM log, when explained, then the log decides it is stuck", () => {
  const log = 'time="..." level=info msg="hostagent starting"\ntime="..." level=fatal msg="instance is already running (pid 812)"';
  const e = explainStartFailure("FATA[0009] error starting vm: exit status 1", "default", log);
  assert.equal(e.kind, "stuck");
  assert.equal(e.fix, "force_restart");
});

test("given an unknown failure with a log, when explained, then the last error line from the log is shown", () => {
  const log = 'level=info msg="booting"\nlevel=error msg="vz: the virtual machine stopped unexpectedly"\nlevel=info msg="cleanup"';
  const e = explainStartFailure("exit status 1", "default", log);
  assert.equal(e.line, 'level=error msg="vz: the virtual machine stopped unexpectedly"');
});

test("given the default profile, when locating its log, then it uses the colima instance name", () => {
  assert.equal(limaLogPath("default"), "~/.colima/_lima/colima/ha.stderr.log");
  assert.equal(limaLogPath("dev"), "~/.colima/_lima/colima-dev/ha.stderr.log");
});

import test from "node:test";
import assert from "node:assert/strict";
import { changeCommand, changeConfirm, changeConfirmLabel, changeDone, changeFail, changeLabel, changeProgress, stillFailed, undoOf, wayBackNote } from "./vmChange.ts";
import type { VmChange } from "./vmChange.ts";

const share: VmChange = { kind: "mounts", mounts: [{ path: "/Users/me", writable: true }, { path: "/Volumes/data", writable: false }], before: [{ path: "/Users/me", writable: true }], what: "/Volumes/data", makeWritable: false };

test("Given each kind of change, when its command is built, then it goes to its own backend command with the profile", () => {
  assert.deepEqual(changeCommand(share, "work"), { cmd: "apply_mounts", args: { name: "work", mounts: share.mounts } });
  assert.deepEqual(changeCommand({ kind: "restart", why: "dns" }, "default"), { cmd: "restart_profile", args: { name: "default" } });
  assert.deepEqual(changeCommand({ kind: "proxy", env: [["HTTP_PROXY", "http://p:1"]], before: [], summary: "p:1" }, "default"), { cmd: "apply_env", args: { name: "default", env: [["HTTP_PROXY", "http://p:1"]] } });
});

test("Given a folder to share, when confirmed, then it names the folder, the restart, the running containers, and what stays", () => {
  const t = changeConfirm(share, 3);
  assert.match(t, /^Share `\/Volumes\/data` with the VM\?/);
  assert.match(t, /Your 3 running containers stop and start again after/);
  assert.match(t, /Images, volumes and containers stay/);
  assert.match(changeConfirm(share, 0), /Nothing is running/);
  assert.match(changeConfirm({ ...share, makeWritable: true, what: "~/code" } as VmChange, 1), /^Let containers change files in `~\/code`\?/);
});

test("Given a change, when the button, progress and result are written, then each says what it does without em dashes", () => {
  assert.equal(changeLabel(share), "Share folder…");
  assert.equal(changeLabel({ kind: "restart", why: "dns" }), "Restart the VM…");
  assert.equal(changeProgress(share, "restarting"), "Restarting the VM to share `/Volumes/data`… about a minute");
  assert.equal(changeDone(share, 3, 0), "`/Volumes/data` is shared with the VM now. Everything that was running is running again.");
  assert.equal(changeDone(share, 3, 1), "`/Volumes/data` is shared with the VM now. Everything else that was running is running again.");
  for (const s of [changeConfirm(share, 2), changeDone(share, 2, 0), changeProgress(share, "starting")]) assert.ok(!/[—–]|--/.test(s), s);
});

test("Given a VM that a failed start left stopped, when the retry is built, then it is told not to stop it first", () => {
  assert.deepEqual(changeCommand(share, "work", false).args, { name: "work", mounts: share.mounts, restart: false });
  assert.equal("restart" in changeCommand(share, "work", true).args, false);
});

test("Given each change, when the confirm button is worded, then it says what happens, not just OK", () => {
  assert.equal(changeConfirmLabel(share), "Share and restart");
  assert.equal(changeConfirmLabel({ ...share, makeWritable: true } as VmChange), "Make writable and restart");
  assert.equal(changeConfirmLabel({ kind: "restart", why: "dns" }), "Restart the VM");
});

test("Given a failed start after a folder change, when the failure is worded, then it is about the folder, never the size, and says the folder stayed saved", () => {
  const t = changeFail(share, "exit status 1", "work");
  assert.match(t, /^Colima couldn't start the VM with `\/Volumes\/data` shared\./);
  assert.match(t, /The VM is stopped\./);
  assert.match(t, /`\/Volumes\/data` stays saved in the profile/);
  assert.ok(!/new size/.test(t));
  assert.match(changeFail({ kind: "restart", why: "dns" }, "exit status 1", "work"), /^Colima couldn't restart the VM\. The VM is stopped\.$/);
  assert.match(changeFail(share, "address already in use", "work"), /A port Colima needs is taken/);
  assert.match(changeFail(share, "Another VM operation is running\nmore", "work"), /^Another VM operation is running$/);
});

test("Given a folder change, when its way back is asked for, then it is the old list, starts a stopped VM, and has no way back itself", () => {
  const back = undoOf(share)!;
  assert.deepEqual(changeCommand(back, "work", false), { cmd: "apply_mounts", args: { name: "work", mounts: [{ path: "/Users/me", writable: true }], force: true } });
  assert.equal(undoOf(back), null);
  assert.equal(undoOf({ kind: "restart", why: "dns" }), null);
  assert.equal(changeDone(back, 2, 0), "The VM started with the folders it had. Everything that was running is running again.");
  assert.match(changeFail(back, "exit status 1", "work"), /^Colima couldn't start the VM the way it was\./);
});

test("Given a restart for the network, when the lookup answer is known, then it replaces the plain line", () => {
  assert.equal(changeDone({ kind: "restart", why: "dns" }, 1, 0, [], "The VM can look up names again."), "The VM can look up names again. Everything that was running is running again.");
});

test("Given the saved list and the one that failed, when compared, then only an equal list still counts, by path and writable flag", () => {
  const home = "/Users/me";
  const failed: VmChange = { kind: "mounts", mounts: [{ path: "/Users/me", writable: true }, { path: "/Volumes/data", writable: true }], before: [{ path: "/Users/me", writable: true }], what: "/Volumes/data", makeWritable: false };
  const m = (location: string, writable = true) => ({ location, writable });
  assert.equal(stillFailed(failed, { mounts: [m("/Volumes/data"), m("~")], env: {} }, home), true, "order and ~ do not matter");
  assert.equal(stillFailed(failed, { mounts: [m("~")], env: {} }, home), false, "the folder was removed by hand");
  assert.equal(stillFailed(failed, { mounts: [m("~"), m("/Volumes/data", false)], env: {} }, home), false, "writable changed");
  assert.equal(stillFailed(failed, { mounts: null, env: {} }, home), false, "unreadable is never a match");
  const home1: VmChange = { ...failed, mounts: [{ path: home, writable: true }] };
  assert.equal(stillFailed(home1, { mounts: [], env: {} }, home), true, "an empty list is the home folder, writable");
  const proxy: VmChange = { kind: "proxy", env: [["HTTP_PROXY", "http://p:1"]], before: [], summary: "p:1" };
  assert.equal(stillFailed(proxy, { mounts: [], env: { HTTP_PROXY: "http://p:1" } }, home), true);
  assert.equal(stillFailed(proxy, { mounts: [], env: {} }, home), false);
  assert.equal(stillFailed({ kind: "restart", why: "dns" }, { mounts: [], env: {} }, home), false);
});

test("Given the way back is offered, when the card line is written, then it names the saved folder and what Start VM does", () => {
  const c: VmChange = { kind: "mounts", mounts: [], before: [], what: "~/code/web", makeWritable: false };
  assert.equal(wayBackNote(c), "The last change didn't start. `~/code/web` is still saved in the profile, so Start VM tries it again.");
});

import test from "node:test";
import assert from "node:assert/strict";
import { colimaLine, createActivity, dockerLine, recallDue } from "./activity.ts";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

test("Given a click that runs a command, when it is recorded, then the log shows it newest first with its outcome", async () => {
  const a = createActivity(memory());
  await a.ran("restart", "docker restart web", async () => "");
  await a.ran("stop", "docker stop db", async () => {
    throw new Error("No such container");
  }).catch(() => {});
  const [last, first] = a.snapshot().entries;
  assert.equal(last.cmd, "docker stop db");
  assert.equal(last.ok, false);
  assert.equal(first.cmd, "docker restart web");
  assert.equal(first.ok, true);
});

// Like a phone asking for the PIN now and then: often enough to keep it, not so often that it nags.
test("Given the same kind of click again and again, when counted, then recall is asked at 3, 10, 30, 100, then every 100", () => {
  const due = Array.from({ length: 400 }, (_, i) => i + 1).filter(recallDue);
  assert.deepEqual(due, [3, 10, 30, 100, 200, 300, 400]);
});

test("Given the third restart, when recorded, then that entry asks to recall the command first", async () => {
  const a = createActivity(memory());
  for (let i = 0; i < 3; i++) await a.ran("restart", `docker restart web`, async () => "");
  const [third, second] = a.snapshot().entries;
  assert.equal(third.recall, true);
  assert.equal(second.recall, false);
});

test("Given tips turned off, when the count is due, then the command is simply shown", async () => {
  const a = createActivity(memory());
  a.setTips(false);
  for (let i = 0; i < 3; i++) await a.ran("restart", "docker restart web", async () => "");
  assert.equal(a.snapshot().entries[0].recall, false);
});

test("Given counts and the tips choice, when the app opens again, then both are remembered", async () => {
  const store = memory();
  const a = createActivity(store);
  a.setTips(false);
  await a.ran("restart", "docker restart web", async () => "");
  await a.ran("restart", "docker restart web", async () => "");
  const b = createActivity(store);
  assert.equal(b.snapshot().tips, false);
  b.setTips(true);
  await b.ran("restart", "docker restart web", async () => "");
  assert.equal(b.snapshot().entries[0].recall, true, "the third restart overall, across both sessions");
});

test("Given storage that throws, when used, then the log still works for this session", async () => {
  const a = createActivity({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  await a.ran("restart", "docker restart web", async () => "");
  assert.equal(a.snapshot().entries.length, 1);
});

test("Given more than 100 commands, when recorded, then only the newest 100 are kept", async () => {
  const a = createActivity(memory());
  for (let i = 0; i < 105; i++) await a.ran(`k${i}`, `docker x ${i}`, async () => "");
  const { entries } = a.snapshot();
  assert.equal(entries.length, 100);
  assert.equal(entries[0].cmd, "docker x 104");
});

test("Given a docker action, when logged, then the line names the context and quotes only what needs it", () => {
  assert.equal(dockerLine("colima", ["stop", "web"]), "docker --context colima stop web");
  assert.equal(dockerLine("colima-work", ["rm", "my app"]), "docker --context colima-work rm 'my app'");
});

test("Given a VM button, when logged, then the line is the colima command the backend runs", () => {
  assert.equal(colimaLine("start_profile", { opts: { name: "work", cpus: 4, memory: 8 } }), "colima start work --cpu 4 --memory 8");
  assert.equal(colimaLine("force_restart_profile", { name: "default" }), "colima stop --force default && colima start default");
  assert.equal(colimaLine("vm_log_tail", { name: "default" }), null);
});

test("given a container start and a remove, when logged, then only the start can run again, and it runs the same work", async () => {
  const a = createActivity(undefined);
  let runs = 0;
  await a.ran("start", "docker --context colima start web", async () => void runs++, "web");
  await a.ran("rm", "docker --context colima rm web", async () => undefined, "web");
  await a.ran("stop", "colima stop default", async () => undefined, "the default VM");
  const [vm, rm, start] = a.snapshot().entries;
  assert.equal(rm.again, undefined);
  assert.equal(vm.again, undefined);
  await start.again!();
  assert.equal(runs, 2);
  assert.equal(a.snapshot().entries[0].cmd, "docker --context colima start web");
});

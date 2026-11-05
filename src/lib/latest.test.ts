import test from "node:test";
import assert from "node:assert/strict";
import { latest } from "./latest.ts";

const later = <T,>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

test("a slow older request never counts as current once a newer one has started", async () => {
  const run = latest();
  const slow = run(() => later(40, "old"));
  const fast = run(() => later(5, "new"));
  const [a, b] = await Promise.all([slow, fast]);
  assert.equal(b.current, true);
  assert.equal(b.value, "new");
  assert.equal(a.current, false);
});

test("a lone request is current", async () => {
  const run = latest();
  const r = await run(async () => 42);
  assert.deepEqual([r.current, r.ok, r.value], [true, true, 42]);
});

test("errors are reported, and only the newest request's error is current", async () => {
  const run = latest();
  const oldFail = run(() => later(20, null).then(() => { throw new Error("old"); }));
  const newOk = run(async () => "fine");
  const [a, b] = await Promise.all([oldFail, newOk]);
  assert.equal(a.ok, false);
  assert.equal(a.current, false);
  assert.equal(b.current, true);
  const run2 = latest();
  const e = await run2(async () => { throw new Error("boom"); });
  assert.deepEqual([e.ok, e.current], [false, true]);
});

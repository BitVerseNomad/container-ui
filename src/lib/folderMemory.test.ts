import test from "node:test";
import assert from "node:assert/strict";
import { rememberWritable, wasWritable } from "./folderMemory.ts";

const fake = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

test("given a folder never chosen before when asked then it is not writable", () => {
  assert.equal(wasWritable("/Users/me/code/app", fake()), false);
});

test("given a folder made writable when asked again then it is remembered, per folder", () => {
  const s = fake();
  rememberWritable("/Users/me/code/app", true, s);
  assert.equal(wasWritable("/Users/me/code/app", s), true);
  assert.equal(wasWritable("/Users/me/code/other", s), false);
});

test("given a folder made writable and then read-only when asked then it is read-only again", () => {
  const s = fake();
  rememberWritable("/Users/me/code/app", true, s);
  rememberWritable("/Users/me/code/app", false, s);
  assert.equal(wasWritable("/Users/me/code/app", s), false);
});

test("given storage that throws when asked then it falls back to read-only without failing", () => {
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
  assert.equal(wasWritable("/Users/me/x", broken), false);
  assert.doesNotThrow(() => rememberWritable("/Users/me/x", true, broken));
});

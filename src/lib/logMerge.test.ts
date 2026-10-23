import test from "node:test";
import assert from "node:assert/strict";
import { mergeLogs, parseLine, sinceOf } from "./logMerge.ts";

test("given a timestamped line when parsed then the time and the text are split", () => {
  assert.deepEqual(parseLine("2026-10-23T09:00:01.5Z hello world"), { key: "2026-10-23T09:00:01.500000000Z", iso: "2026-10-23T09:00:01.5Z", text: "hello world" });
});

test("given a line without a timestamp when parsed then it is kept as text", () => {
  assert.equal(parseLine("plain").text, "plain");
});

test("given a chunk that repeats the last line we have when merged then only newer lines are added", () => {
  const first = mergeLogs([], "2026-10-23T09:00:01Z a\n2026-10-23T09:00:02.1Z b\n");
  const next = mergeLogs(first, "2026-10-23T09:00:02.1Z b\n2026-10-23T09:00:02.12Z c\n");
  assert.deepEqual(next.map((l) => l.text), ["a", "b", "c"]);
});

test("given an empty chunk when merged then the same lines come back", () => {
  const first = mergeLogs([], "2026-10-23T09:00:01Z a\n");
  assert.equal(mergeLogs(first, ""), first);
});

test("given more lines than the cap when merged then the oldest are dropped", () => {
  const chunk = Array.from({ length: 10 }, (_, i) => `2026-10-23T09:00:0${i}Z l${i}`).join("\n");
  assert.deepEqual(mergeLogs([], chunk, 3).map((l) => l.text), ["l7", "l8", "l9"]);
});

test("given loaded lines when asking where to continue then it is the last timestamp", () => {
  assert.equal(sinceOf(mergeLogs([], "2026-10-23T09:00:01Z a\n2026-10-23T09:00:03.25Z b")), "2026-10-23T09:00:03.25Z");
  assert.equal(sinceOf([]), null);
});

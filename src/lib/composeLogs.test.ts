import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeProjectLogs, parseProjectLine, projectSince, serviceName } from "./composeLogs.ts";

test("given a compose log line, when parsed, then service, time and text are split", () => {
  assert.deepEqual(parseProjectLine("shop-web-1  | 2026-10-28T15:04:05.12Z GET / 200"), { service: "shop-web-1", key: "2026-10-28T15:04:05.120000000Z", iso: "2026-10-28T15:04:05.12Z", text: "GET / 200" });
});

test("given services that interleave, when merged, then lines sort by time", () => {
  const l = mergeProjectLogs([], "b-1  | 2026-10-28T15:00:02Z two\na-1  | 2026-10-28T15:00:01Z one\n");
  assert.deepEqual(l.map((x) => x.text), ["one", "two"]);
});

test("given a poll repeats the line at the since time, when merged, then it is not shown twice", () => {
  const first = mergeProjectLogs([], "a-1  | 2026-10-28T15:00:01Z one\n");
  assert.equal(mergeProjectLogs(first, "a-1  | 2026-10-28T15:00:01Z one\na-1  | 2026-10-28T15:00:03Z three\n").length, 2);
});

test("given a slower service, when the next poll starts, then it starts at that service's newest line", () => {
  const l = mergeProjectLogs([], "fast-1  | 2026-10-28T15:00:09Z f\nslow-1  | 2026-10-28T15:00:02Z s\n");
  assert.equal(projectSince(l), "2026-10-28T15:00:02.0Z");
  // a late line from slow, older than fast's newest, still comes in
  assert.equal(mergeProjectLogs(l, "slow-1  | 2026-10-28T15:00:05Z late\n").slice(-2)[0].text, "late");
  assert.equal(projectSince([]), null);
});

test("given a container name, when shortened, then the project prefix and replica number go", () => {
  assert.equal(serviceName("shop-web-1", "shop"), "web");
  assert.equal(serviceName("shop_report-job_2", "shop"), "report-job");
  assert.equal(serviceName("other", "shop"), "other");
});

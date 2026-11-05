import test from "node:test";
import assert from "node:assert/strict";
import { volumeUsage, isAnonymous, unusedAnonymous } from "./volumes.ts";

const hex = "a".repeat(64);
const containers = [
  { Name: "/db", Mounts: [{ Type: "volume", Name: "mysql-data" }, { Type: "bind", Source: "/Users/me/app" }] },
  { Name: "/web", Mounts: [{ Type: "volume", Name: "mysql-data" }, { Type: "volume", Name: hex }] },
  { Name: "/cache", Mounts: [] },
];

test("volumeUsage maps each named volume to the containers that mount it, without the slash", () => {
  const u = volumeUsage(containers);
  assert.deepEqual(u.get("mysql-data"), ["db", "web"]);
  assert.deepEqual(u.get(hex), ["web"]);
});

test("bind mounts and containers without mounts add nothing", () => {
  const u = volumeUsage(containers);
  assert.equal(u.size, 2);
  assert.equal(volumeUsage([]).size, 0);
});

test("a container with null Mounts is tolerated", () => {
  assert.equal(volumeUsage([{ Name: "/x", Mounts: null as never }]).size, 0);
});

test("only 64-character hex names are anonymous volumes", () => {
  assert.equal(isAnonymous(hex), true);
  assert.equal(isAnonymous("mysql-data"), false);
  assert.equal(isAnonymous("a".repeat(63)), false);
  assert.equal(isAnonymous("A".repeat(64)), false);
});

test("unusedAnonymous never includes named volumes, even when nothing uses them", () => {
  const other = "b".repeat(64);
  const names = ["mysql-data", "pgdata-old", hex, other];
  const usage = volumeUsage(containers);
  assert.deepEqual(unusedAnonymous(names, usage), [other]);
});

test("unusedAnonymous of nothing is empty", () => {
  assert.deepEqual(unusedAnonymous([], new Map()), []);
});

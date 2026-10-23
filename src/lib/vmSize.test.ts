import { test } from "node:test";
import assert from "node:assert/strict";
import { firstVmSize } from "./vmSize.ts";

const GiB = 1024 ** 3;

test("given a 12-core 32 GiB Mac, when sizing the first VM, then it gets half the cores and a quarter of the memory", () => {
  assert.deepEqual(firstVmSize({ cpus: 12, memory: 32 * GiB }), { cpus: 6, memory: 8 });
});

test("given a small 8 GiB Mac, when sizing, then it never goes below Colima's 2 CPU and 2 GiB", () => {
  assert.deepEqual(firstVmSize({ cpus: 2, memory: 8 * GiB }), { cpus: 2, memory: 2 });
});

test("given a very large Mac, when sizing, then it caps at 8 CPUs and 16 GiB", () => {
  assert.deepEqual(firstVmSize({ cpus: 32, memory: 128 * GiB }), { cpus: 8, memory: 16 });
});

import test from "node:test";
import assert from "node:assert/strict";
import { sumStats, parseDf, fraction } from "./usage.ts";

test("no running containers sums to zero, never NaN", () => {
  assert.deepEqual(sumStats([]), { cores: 0, memBytes: 0 });
});

test("cpu percentages add up to cores", () => {
  const t = sumStats([{ CPUPerc: "150.00%", MemUsage: "1MiB / 2GiB" }, { CPUPerc: "50.00%", MemUsage: "1MiB / 2GiB" }]);
  assert.equal(t.cores, 2);
});

test("memory adds the used half of 'used / limit'", () => {
  const t = sumStats([{ CPUPerc: "0%", MemUsage: "12.5MiB / 2GiB" }, { CPUPerc: "0%", MemUsage: "512MiB / 2GiB" }]);
  assert.equal(t.memBytes, 12.5 * 1024 ** 2 + 512 * 1024 ** 2);
});

test("placeholder values from docker count as zero", () => {
  const t = sumStats([{ CPUPerc: "--", MemUsage: "--" }]);
  assert.deepEqual(t, { cores: 0, memBytes: 0 });
});

test("parseDf sums sizes and reclaimable, ignoring the percentage", () => {
  const d = parseDf([
    { Type: "Images", Size: "1.2GB", Reclaimable: "2.1GB (80%)" },
    { Type: "Containers", Size: "0B", Reclaimable: "0B" },
  ]);
  assert.equal(Math.round(d.totalBytes), 1.2e9);
  assert.equal(Math.round(d.reclaimableBytes), 2.1e9);
});

test("parseDf of nothing is zero", () => {
  assert.deepEqual(parseDf([]), { totalBytes: 0, reclaimableBytes: 0, freeableBytes: 0 });
});

test("fraction clamps to 0..1 and treats a zero total as 0", () => {
  assert.equal(fraction(5, 0), 0);
  assert.equal(fraction(15, 10), 1);
  assert.equal(fraction(-1, 10), 0);
  assert.equal(fraction(5, 10), 0.5);
});

test("given volumes and stopped containers that could be freed, when counting what Images can free, then only images and build cache count", () => {
  const d = parseDf([
    { Type: "Images", Size: "3GB", Reclaimable: "1GB (33%)" },
    { Type: "Containers", Size: "1GB", Reclaimable: "1GB (100%)" },
    { Type: "Local Volumes", Size: "2GB", Reclaimable: "2GB (100%)" },
    { Type: "Build Cache", Size: "500MB", Reclaimable: "500MB" },
  ]);
  assert.equal(Math.round(d.freeableBytes), 1.5e9);
});

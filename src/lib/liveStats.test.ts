import test from "node:test";
import assert from "node:assert/strict";
import { liveFromRows, pushPoint, nextHistory, machineUsage, memHot, diskHot, gbText, metersOf, type LiveMap, type MachineUsage } from "./liveStats.ts";

test("Given rows with CPUPerc '12.50%' and MemUsage '512MiB / 7.7GiB', when liveFromRows runs, then cpu is 12.5 and memBytes is 536870912", () => {
  const out = liveFromRows([{ Name: "web", CPUPerc: "12.50%", MemUsage: "512MiB / 7.7GiB" }]);
  assert.deepStrictEqual(out, { web: { cpu: 12.5, memBytes: 512 * 1024 ** 2 } });
});

test("Given a history of 60 values, when pushPoint adds one, then the length is still 60 and the oldest is gone", () => {
  const history = Array(60).fill(0).map((_, i) => i);
  const next = pushPoint(history, 99);
  assert.strictEqual(next.length, 60);
  assert.strictEqual(next[0], 1);
  assert.strictEqual(next[59], 99);
});

test("Given an old history for web and a read without web, when nextHistory runs, then web has no history", () => {
  const old = { web: [1, 2], api: [3] };
  const live: LiveMap = { api: { cpu: 4, memBytes: 0 } };
  assert.deepStrictEqual(nextHistory(old, live), { api: [3, 4] });
});

test("Given two containers using 100 and 50 percent on a 4-core VM, when machineUsage runs, then cpuPercent is 37.5", () => {
  const live: LiveMap = { a: { cpu: 100, memBytes: 0 }, b: { cpu: 50, memBytes: 0 } };
  const u = machineUsage(live, 4, 8, 40 * 1024 ** 3, 60 * 1024 ** 3);
  assert.strictEqual(u.cpuPercent, 37.5);
});

test("Given 5.1 GB used of 8 GB, when memHot runs, then it is true; Given 4 GB of 8, then false", () => {
  assert.strictEqual(memHot({ memUsedGb: 5.1, memTotalGb: 8 } as MachineUsage), true);
  assert.strictEqual(memHot({ memUsedGb: 4, memTotalGb: 8 } as MachineUsage), false);
});

test("Given 52 of 60 GB, when diskHot runs, then it is true; Given 50 of 60, then false", () => {
  assert.strictEqual(diskHot({ diskUsedGb: 52, diskTotalGb: 60 } as MachineUsage), true);
  assert.strictEqual(diskHot({ diskUsedGb: 50, diskTotalGb: 60 } as MachineUsage), false);
});

test("Given 5.13, 8, 41.2 and 0 GB, when gbText runs, then it returns '5.1', '8', '41' and '0'", () => {
  assert.strictEqual(gbText(5.13), "5.1");
  assert.strictEqual(gbText(8), "8");
  assert.strictEqual(gbText(41.2), "41");
  assert.strictEqual(gbText(0), "0");
});

test("Given 12.4 percent CPU, 5.1 of 8 GB memory and 41 of 60 GB disk, when metersOf runs, then it returns three meters labelled CPU, Memory, Disk with texts '12%', '5.1 of 8 GB' and '41 of 60 GB', shares 0.124, 0.6375 and 0.683, and only Memory is hot", () => {
  const u: MachineUsage = { cpuPercent: 12.4, memUsedGb: 5.1, memTotalGb: 8, diskUsedGb: 41, diskTotalGb: 60 };
  const meters = metersOf(u);
  assert.strictEqual(meters.length, 3);
  assert.deepStrictEqual(meters[0], { label: "CPU", share: 0.124, text: "12%" });
  assert.deepStrictEqual(meters[1], { label: "Memory", share: 0.6375, text: "5.1 of 8 GB", hot: true });
  assert.deepStrictEqual(meters[2], { label: "Disk", share: 41 / 60, text: "41 of 60 GB", hot: false });
  assert.strictEqual(Number(meters[2].share!.toFixed(3)), 0.683);
});

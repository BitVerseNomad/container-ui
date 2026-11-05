import test from "node:test";
import assert from "node:assert/strict";
import { parseDiskUsage, parseDfSize, formatDf } from "./disk.ts";

const out = [
  '{"Active":"4","Reclaimable":"1.1GB (48%)","Size":"2.3GB","TotalCount":"9","Type":"Images"}',
  '{"Active":"2","Reclaimable":"12.3MB (50%)","Size":"24.6MB","TotalCount":"5","Type":"Containers"}',
  '{"Active":"1","Reclaimable":"0B (0%)","Size":"512MB","TotalCount":"3","Type":"Local Volumes"}',
  '{"Active":"0","Reclaimable":"3.4GB","Size":"3.4GB","TotalCount":"87","Type":"Build Cache"}',
].join("\n");

test("parseDfSize reads Docker's decimal sizes into bytes", () => {
  assert.equal(parseDfSize("2.3GB"), 2.3e9);
  assert.equal(parseDfSize("512MB"), 512e6);
  assert.equal(parseDfSize("4kB"), 4e3);
  assert.equal(parseDfSize("0B"), 0);
});

test("parseDfSize ignores the percentage in a reclaimable value", () => {
  assert.equal(parseDfSize("1.1GB (48%)"), 1.1e9);
});

test("parseDfSize gives null for text it cannot read", () => {
  assert.equal(parseDfSize(""), null);
  assert.equal(parseDfSize("lots"), null);
  assert.equal(parseDfSize(undefined), null);
});

test("parseDiskUsage returns the four rows in a fixed order with sizes in bytes", () => {
  const rows = parseDiskUsage(out);
  assert.deepEqual(rows.map((r) => r.kind), ["buildCache", "images", "containers", "volumes"]);
  const cache = rows[0];
  assert.equal(cache.size, 3.4e9);
  assert.equal(cache.reclaimable, 3.4e9);
  assert.equal(cache.count, 87);
  assert.equal(rows[3].reclaimable, 0);
  assert.equal(rows[1].active, 4);
});

test("a missing type gives a row with dashes (null), never a crash", () => {
  const rows = parseDiskUsage(out.split("\n").slice(0, 2).join("\n"));
  assert.equal(rows.length, 4);
  assert.equal(rows[0].kind, "buildCache");
  assert.equal(rows[0].size, null);
  assert.equal(rows[0].reclaimable, null);
});

test("garbage, blank lines and odd shapes give null fields", () => {
  const rows = parseDiskUsage('\nnot json\n[1,2]\n{"Type":"Images","Size":7}\n{"Type":"Build Cache","Size":"5GB"}');
  assert.equal(rows.length, 4);
  assert.equal(rows.find((r) => r.kind === "images")!.size, null);
  assert.equal(rows.find((r) => r.kind === "buildCache")!.size, 5e9);
  assert.equal(parseDiskUsage("").length, 4);
});

test("formatDf prints sizes like Docker does, and a dash for unknown", () => {
  assert.equal(formatDf(3.4e9), "3.4 GB");
  assert.equal(formatDf(512e6), "512 MB");
  assert.equal(formatDf(0), "0 B");
  assert.equal(formatDf(null), "—");
});

import test from "node:test";
import assert from "node:assert/strict";
import { publishedPorts, parsePercent, parseBytes, parseUsage, formatBytes, sparkPoints } from "./containerInfo.ts";

test("publishedPorts returns unique tcp host ports, ignoring unpublished and udp", () => {
  const ports = {
    "3306/tcp": [{ HostIp: "0.0.0.0", HostPort: "3306" }, { HostIp: "::", HostPort: "3306" }],
    "33060/tcp": null,
    "53/udp": [{ HostIp: "0.0.0.0", HostPort: "53" }],
    "80/tcp": [{ HostIp: "0.0.0.0", HostPort: "8080" }],
  };
  assert.deepEqual(publishedPorts(ports), [3306, 8080]);
  assert.deepEqual(publishedPorts(undefined), []);
  assert.deepEqual(publishedPorts({}), []);
});

test("parsePercent reads docker's percentage strings", () => {
  assert.equal(parsePercent("0.45%"), 0.45);
  assert.equal(parsePercent("123.4%"), 123.4);
  assert.equal(parsePercent("--"), 0);
  assert.equal(parsePercent(""), 0);
});

test("parseBytes understands docker's decimal and binary units", () => {
  assert.equal(parseBytes("12.5MiB"), 12.5 * 1024 ** 2);
  assert.equal(parseBytes("1.5GB"), 1.5e9);
  assert.equal(parseBytes("512kB"), 512000);
  assert.equal(parseBytes("0B"), 0);
  assert.equal(parseBytes("garbage"), 0);
});

test("parseUsage splits 'used / limit'", () => {
  assert.deepEqual(parseUsage("12.5MiB / 2GiB"), { used: 12.5 * 1024 ** 2, limit: 2 * 1024 ** 3 });
  assert.deepEqual(parseUsage("nonsense"), { used: 0, limit: 0 });
});

test("formatBytes prints binary units", () => {
  assert.equal(formatBytes(0), "0 B");
  assert.equal(formatBytes(1536), "1.5 KiB");
  assert.equal(formatBytes(12.5 * 1024 ** 2), "12.5 MiB");
});

test("sparkPoints scales values into an svg polyline", () => {
  assert.equal(sparkPoints([0, 50, 100], 100, 20, 100), "0,20 50,10 100,0");
  assert.equal(sparkPoints([5], 100, 20, 10), "");
  assert.equal(sparkPoints([0, 0], 10, 10, 0), "0,10 10,10");
});

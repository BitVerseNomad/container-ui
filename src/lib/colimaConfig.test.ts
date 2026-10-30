import test from "node:test";
import assert from "node:assert/strict";
import { parseColimaConfig } from "./colimaConfig.ts";

// Trimmed from a real ~/.colima/default/colima.yaml (Colima 0.10.1): comments kept, defaults as written.
const DEFAULT = `
# Number of CPUs
cpu: 2
network:
  address: false
  # Custom DNS resolvers for the virtual machine.
  # EXAMPLE
  # dns: [8.8.8.8, 1.1.1.1]
  dns: null
  dnsHosts: {}
vmType: vz
# Default: virtiofs (for vz), sshfs (for qemu)
mountType: virtiofs
# EXAMPLE
# mounts:
#   - location: ~/secrets
mounts: []
rootDisk: 20
env: {}
`;

test("Given a default profile, when read, then there are no mounts, no env and no DNS, and the types are read", () => {
  assert.deepEqual(parseColimaConfig(DEFAULT), { vmType: "vz", mountType: "virtiofs", mounts: [], env: {}, dns: [] });
});

test("Given listed mounts, when read, then each has its location and whether it is writable", () => {
  const c = parseColimaConfig(`mountType: sshfs\nvmType: qemu\nmounts:\n  - location: ~/secrets\n    writable: false\n  - location: "/Volumes/Data disk"\n    writable: true\n    mountPoint: /data\nenv: {}\n`);
  assert.deepEqual(c.mounts, [{ location: "~/secrets", writable: false }, { location: "/Volumes/Data disk", writable: true, mountPoint: "/data" }]);
  assert.equal(c.mountType, "sshfs");
  assert.equal(c.vmType, "qemu");
});

test("Given an env map and a DNS list in both YAML styles, when read, then they come back", () => {
  const block = parseColimaConfig(`network:\n  dns:\n    - 1.1.1.1\n    - 8.8.8.8\n  mode: shared\nenv:\n  HTTP_PROXY: http://proxy.corp:8080\n  OTHER: "a b"\n`);
  assert.deepEqual(block.dns, ["1.1.1.1", "8.8.8.8"]);
  assert.deepEqual(block.env, { HTTP_PROXY: "http://proxy.corp:8080", OTHER: "a b" });
  assert.deepEqual(parseColimaConfig("network:\n  dns: [9.9.9.9, 1.1.1.1]\n").dns, ["9.9.9.9", "1.1.1.1"]);
});

test("Given text that is not a profile, when read, then nothing is invented", () => {
  assert.deepEqual(parseColimaConfig("not yaml at all {{"), { vmType: "", mountType: "", mounts: [], env: {}, dns: [] });
  assert.deepEqual(parseColimaConfig(""), { vmType: "", mountType: "", mounts: [], env: {}, dns: [] });
});

test("Given a mounts or env list in a style the app doesn't read, when read, then it is unknown (null), never empty", () => {
  assert.equal(parseColimaConfig("mounts: [{location: ~/code, writable: true}]\n").mounts, null);
  assert.equal(parseColimaConfig("env: {HTTP_PROXY: http://p:1}\n").env, null);
  assert.equal(parseColimaConfig("mounts:\n  -\n    location: ~/code\n").mounts, null, "a bare dash is a shape the app does not read");
  assert.equal(parseColimaConfig("mounts:\n  - something: else\n").mounts, null);
  assert.equal(parseColimaConfig("mounts:\n  - location: ~/a\n  - !!weird\n").mounts, null, "one line not read makes the whole list unknown");
});

test("Given comments and quoted values in the lists, when read, then the values are the ones written", () => {
  const c = parseColimaConfig('mounts:\n  # shared on purpose\n  - location: "~/my code" # the repo\n    writable: true\nenv:\n  # proxy\n  TZ: "UTC"\n');
  assert.deepEqual(c.mounts, [{ location: "~/my code", writable: true }]);
  assert.deepEqual(c.env, { TZ: "UTC" });
});

test("Given a list written at the key's own indent, when read, then the folders are found, never an empty list", () => {
  const c = parseColimaConfig("mounts:\n- location: /Volumes/data\n  writable: true\n- location: ~/code\n  writable: false\nenv: {}\n");
  assert.deepEqual(c.mounts, [{ location: "/Volumes/data", writable: true }, { location: "~/code", writable: false }]);
  assert.equal(parseColimaConfig("mounts:\n-\nenv: {}\n").mounts, null);
});

test("Given writable in any case or an odd value, when read, then True and TRUE count and anything else is unknown", () => {
  assert.equal(parseColimaConfig("mounts:\n  - location: /a\n    writable: True\n").mounts?.[0].writable, true);
  assert.equal(parseColimaConfig("mounts:\n  - location: /a\n    writable: FALSE\n").mounts?.[0].writable, false);
  for (const v of ["yes", "1", "on", "maybe"]) assert.equal(parseColimaConfig(`mounts:\n  - location: /a\n    writable: ${v}\n`).mounts, null, v);
});

test("Given a mount location that starts with $, when read, then the list is unknown", () => {
  assert.equal(parseColimaConfig("mounts:\n  - location: $HOME/code\n    writable: true\n").mounts, null);
  assert.equal(parseColimaConfig('mounts:\n  - location: "${DATA}"\n').mounts, null);
  assert.deepEqual(parseColimaConfig("mounts:\n  - location: ~/code\n    writable: true\n").mounts, [{ location: "~/code", writable: true }]);
});

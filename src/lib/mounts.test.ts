import test from "node:test";
import assert from "node:assert/strict";
import { parseColimaConfig } from "./colimaConfig.ts";
import { binds, covering, mountOk, mountPlan, overlaps, readOnlyWrites, rofsFor, sharesOf as shares, slowMountType, tilde, unshared } from "./mounts.ts";
import { toApp } from "./apps.ts";

const HOME = "/Users/me";
const app = (name: string, mounts: { Type: string; Source: string; Destination: string; RW: boolean }[], running = true) =>
  toApp({ Id: `${name}0`, Name: `/${name}`, Image: "sha256:x", State: { Running: running, Status: running ? "running" : "exited" }, Config: { Image: "x", Env: [], Labels: {} }, HostConfig: { NetworkMode: "bridge" }, NetworkSettings: { Networks: { bridge: {} } }, Mounts: mounts } as never);
// The list is readable in every test but the ones for an unreadable list.
const sharesOf = (c: ReturnType<typeof cfg>, home: string) => shares(c, home)!;
const cfg = (yaml = "mounts: []") => parseColimaConfig(`vmType: vz\nmountType: virtiofs\n${yaml}\n`);

test("Given no listed mounts, when the shares are worked out, then it is the home folder, writable", () => {
  assert.deepEqual(sharesOf(cfg(), HOME), [{ path: HOME, writable: true }]);
});

test("Given a bind inside home and one outside every share, when checked, then only the outside one is unshared", () => {
  const apps = [app("api", [{ Type: "bind", Source: "/Users/me/code/api", Destination: "/app", RW: true }]), app("etl", [{ Type: "bind", Source: "/Volumes/data/in", Destination: "/in", RW: false }])];
  const out = unshared(binds(apps), sharesOf(cfg(), HOME));
  assert.deepEqual(out, [{ app: "etl", source: "/Volumes/data/in", dest: "/in", readOnly: true }]);
});

test("Given binds that are VM folders, volumes, tmpfs or on a stopped container, when checked, then none is unshared", () => {
  const apps = [
    app("a", [{ Type: "bind", Source: "/var/run/docker.sock", Destination: "/s", RW: true }, { Type: "bind", Source: "/tmp/x", Destination: "/t", RW: true }, { Type: "volume", Source: "/var/lib/docker/volumes/v/_data", Destination: "/v", RW: true }]),
    app("b", [{ Type: "bind", Source: "/Volumes/gone/x", Destination: "/x", RW: true }], false),
  ];
  assert.deepEqual(unshared(binds(apps), sharesOf(cfg(), HOME)), []);
});

test("Given a folder named like a share but not inside it, when checked, then it is not covered", () => {
  const shares = sharesOf(cfg("mounts:\n  - location: /Volumes/data\n    writable: true"), HOME);
  assert.equal(covering("/Volumes/data2/x", shares), undefined);
  assert.equal(covering("/Volumes/data/x", shares)?.path, "/Volumes/data");
});

test("Given a container that writes into a read-only share, when checked, then it is found, and a :ro bind is not", () => {
  const c = cfg("mounts:\n  - location: ~/code\n    writable: false");
  const apps = [app("w", [{ Type: "bind", Source: "/Users/me/code/a", Destination: "/a", RW: true }]), app("r", [{ Type: "bind", Source: "/Users/me/code/b", Destination: "/b", RW: false }])];
  assert.deepEqual(readOnlyWrites(binds(apps), sharesOf(c, HOME)).map((u) => u.app), ["w"]);
});

test("Given the default home share, when a Volumes folder is added, then the plan keeps home and adds the folder", () => {
  const p = mountPlan(cfg(), HOME, "/Volumes/data/in", false);
  assert.ok("change" in p);
  assert.deepEqual(p.change, { kind: "mounts", mounts: [{ path: HOME, writable: true }, { path: "/Volumes/data/in", writable: false }], before: [{ path: HOME, writable: true }], what: "/Volumes/data/in", makeWritable: false });
});

test("Given a read-only share, when made writable, then only that entry changes", () => {
  const p = mountPlan(cfg("mounts:\n  - location: ~/code\n    writable: false\n  - location: /Volumes/x\n    writable: false"), HOME, "/Users/me/code", true);
  assert.ok("change" in p && p.change.kind === "mounts");
  assert.deepEqual(p.change.mounts, [{ path: "/Users/me/code", writable: true }, { path: "/Volumes/x", writable: false }]);
  assert.equal(p.change.makeWritable, true);
  assert.equal(p.change.what, "~/code");
});

test("Given a folder that overlaps a share or hides under a hidden name, when planned, then it says why instead", () => {
  const over = mountPlan(cfg("mounts:\n  - location: /Volumes/data\n    writable: true"), HOME, "/Volumes/data2", true);
  assert.ok("why" in over && /starts like/.test(over.why));
  const hidden = mountPlan(cfg(), HOME, "/Users/me/.ssh", true);
  assert.ok("why" in hidden);
  const point = mountPlan(cfg("mounts:\n  - location: ~/a\n    writable: true\n    mountPoint: /b"), HOME, "/Volumes/z", true);
  assert.ok("why" in point && /different path/.test(point.why));
});

test("Given paths, when checked for sharing, then system folders, other users, ~/Library, commas and quotes are refused", () => {
  for (const ok of ["/Users/me", "/Users/me/code/api", "/Users/me/My Apps/x", "/Volumes/data/in", "/opt/data/x"]) assert.equal(mountOk(ok, HOME), true, ok);
  for (const bad of ["/", "/Users", "/Users/other/x", "/Users/me/Library/x", "/Users/me/library/x", "/Users/me/.ssh", "/etc/x", "/System/x", "/Volumes", "/a,b/c", '/a"b/c', "rel/x", "/Users/me/../x", "/Users//me"]) assert.equal(mountOk(bad, HOME), false, bad);
});

test("Given path pairs, when checked for overlap, then Colima's string-prefix rule is used", () => {
  assert.equal(overlaps(["/a/b", "/a/bc"]), true);
  assert.equal(overlaps(["/a/b", "/a/c"]), false);
});

test("Given the home folder, when shown, then it is ~", () => {
  assert.equal(tilde("/Users/me/code/api", HOME), "~/code/api");
  assert.equal(tilde("/Users/me", HOME), "~");
  assert.equal(tilde("/Volumes/x", HOME), "/Volumes/x");
});

test("Given mount and VM types, when checked, then only sshfs or 9p on vz is slow by choice", () => {
  assert.equal(slowMountType({ vmType: "vz", mountType: "sshfs" }), true);
  assert.equal(slowMountType({ vmType: "vz", mountType: "9p" }), true);
  assert.equal(slowMountType({ vmType: "vz", mountType: "virtiofs" }), false);
  assert.equal(slowMountType({ vmType: "qemu", mountType: "sshfs" }), false);
});

test("Given a folder list in a shape the app can't read, when planned, then nothing is guessed and the reason is given", () => {
  const flow = parseColimaConfig("mounts: [{location: ~/code, writable: true}]\n");
  assert.equal(flow.mounts, null);
  assert.equal(shares(flow, HOME), null);
  const p = mountPlan(flow, HOME, "/Volumes/data/in", true);
  assert.ok("why" in p && /can't read your shared folders/.test(p.why));
});

test("Given a share that is read-only, when the old list is kept, then the plan remembers it to start the VM the way it was", () => {
  const p = mountPlan(cfg("mounts:\n  - location: ~/code\n    writable: false"), HOME, "/Users/me/code", true);
  assert.ok("change" in p && p.change.kind === "mounts");
  assert.deepEqual(p.change.before, [{ path: "/Users/me/code", writable: false }]);
});

test("Given a container's log, when it names the mount with a read-only error, then only that mount is the one", () => {
  const log = "ok\nwrite /data/out.txt: Read-only file system\nmkdir /other/x: EROFS";
  assert.equal(rofsFor(log, "/data"), true);
  assert.equal(rofsFor(log, "/other"), true);
  assert.equal(rofsFor(log, "/elsewhere"), false);
  assert.equal(rofsFor("listening on /data", "/data"), false);
  assert.equal(rofsFor(log, ""), false);
});

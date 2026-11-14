// Every backend command the UI calls must have a handler in the preview's fake backend.
// Without this, a screen works in the app and crashes in the preview, and the browser checks stop meaning anything.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Commands of the runtime adapters in src/runtime/, which the preview does not fake. WO-4.2 deletes those adapters
// and this list with them. It may only shrink.
const NOT_IN_PREVIEW = ["docker_desktop_version", "orb_delete_vm", "orb_list_vms", "orb_start_vm", "orb_stop_vm", "orb_version", "podman_version", "rdctl_version"];

const root = path.resolve(import.meta.dirname, "../..");
const walk = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));

const called = new Set<string>();
for (const file of walk(path.join(root, "src")).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."))) {
  for (const m of fs.readFileSync(file, "utf8").matchAll(/invoke(?:<[^>]*>)?\(\s*["'`]([a-z_]+)["'`]/g)) called.add(m[1]);
}
const mock = fs.readFileSync(path.join(root, "preview/mock.ts"), "utf8");
const handled = new Set([...mock.matchAll(/case "([a-z_]+)"/g)].map((m) => m[1]));

test("given the commands the UI invokes, when the mock is read, then it handles every one", () => {
  const missing = [...called].filter((c) => !handled.has(c) && !NOT_IN_PREVIEW.includes(c)).sort();
  assert.ok(called.size > 30, `expected to find the UI's commands, found ${called.size}`);
  assert.deepEqual(missing, [], `preview/mock.ts has no handler for: ${missing.join(", ")}`);
});

test("given the list of commands the preview does not fake, when read, then each is still called and still not handled", () => {
  const stale = NOT_IN_PREVIEW.filter((c) => !called.has(c) || handled.has(c));
  assert.deepEqual(stale, [], `remove from NOT_IN_PREVIEW: ${stale.join(", ")}`);
});
// scripts/not-migrated.json lists the files not yet rebuilt on the new components. It may only shrink.
// Fails when a path is in the list here and not in the list on main, or when a listed file no longer exists.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const now = JSON.parse(fs.readFileSync(path.join(root, "scripts/not-migrated.json"), "utf8"));
let failed = 0;
const check = (cond, message) => { console.log(cond ? "ok" : "FAIL", message); if (!cond) failed++; };

check(Array.isArray(now) && now.every((p) => typeof p === "string"), "not-migrated: the file is a JSON array of paths");
check(JSON.stringify(now) === JSON.stringify([...now].sort()), "not-migrated: the list is sorted");
const gone = now.filter((p) => !fs.existsSync(path.join(root, p)));
check(gone.length === 0, `not-migrated: every listed file exists${gone.length ? ` (missing: ${gone.join(", ")})` : ""}`);

let before = null;
try { before = JSON.parse(execFileSync("git", ["show", "main:scripts/not-migrated.json"], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString()); } catch { /* the list is not on main yet: this is the pull request that adds it */ }
if (before) {
  const added = now.filter((p) => !before.includes(p));
  check(added.length === 0, `not-migrated: nothing was added to the list${added.length ? ` (added: ${added.join(", ")})` : ""}`);
} else {
  console.log("ok", "not-migrated: no list on main yet, nothing to compare with");
}
process.exit(failed ? 1 : 0);
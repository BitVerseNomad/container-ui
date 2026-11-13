// Every class name used in a className must exist in src/ui/openpier.css.
// This is the guard against a deleted stylesheet leaving the app unstyled without any test failing.
// Files in scripts/not-migrated.json are skipped until their screen is rebuilt.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const css = fs.readFileSync(path.join(root, "src/ui/openpier.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const skip = new Set(JSON.parse(fs.readFileSync(path.join(root, "scripts/not-migrated.json"), "utf8")));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
const files = walk(path.join(root, "src")).filter((f) => f.endsWith(".tsx") && !f.includes(".test."));

// The text of a className value: a quoted string, or a {...} expression with balanced braces.
const values = (src) => {
  const out = [];
  for (const m of src.matchAll(/className=/g)) {
    let i = m.index + m[0].length;
    if (src[i] === '"') { out.push(src.slice(i, src.indexOf('"', i + 1) + 1)); continue; }
    if (src[i] !== "{") continue;
    let depth = 0, j = i;
    do { if (src[j] === "{") depth++; else if (src[j] === "}") depth--; j++; } while (depth > 0 && j < src.length);
    out.push(src.slice(i, j));
  }
  return out;
};
// Class names inside a value: the words of every string literal, with ${...} parts dropped.
const names = (value) =>
  [...value.matchAll(/"([^"]*)"|'([^']*)'|`([^`]*)`/g)]
    .flatMap((m) => (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, " ").split(/\s+/))
    .filter((w) => /^[a-zA-Z][\w-]*$/.test(w));

let failed = 0, checked = 0;
for (const file of files) {
  const rel = path.relative(root, file);
  if (skip.has(rel)) continue;
  checked++;
  const unknown = [...new Set(values(fs.readFileSync(file, "utf8")).flatMap(names))].filter((n) => !defined.has(n));
  if (unknown.length) { console.log("FAIL", `classes: ${rel} uses classes that openpier.css does not define: ${unknown.join(", ")}`); failed++; }
}
console.log(failed ? "FAIL" : "ok", `classes: ${checked} files checked, ${skip.size} skipped (not migrated), ${failed} with unknown classes`);
process.exit(failed ? 1 : 0);

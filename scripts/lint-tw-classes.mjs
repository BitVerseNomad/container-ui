// Every class written in src/ must produce CSS. A class Tailwind does not know (an invented name such as
// "input-bordered" or "toggle--on", or a daisyUI name) renders nothing, so it is a bug, not a style.
// Builds the preview CSS once, then looks for each class's selector in it.
// Run from the repo root: node scripts/lint-tw-classes.mjs   (exit 1 lists every unknown class)
import { readFileSync, readdirSync, statSync, mkdtempSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";

process.chdir(path.resolve(path.dirname(new URL(import.meta.url).pathname), ".."));
const out = mkdtempSync(path.join(tmpdir(), "tw-classes-"));
const build = spawnSync("npx", ["vite", "build", "--config", "vite.preview.config.ts", "--outDir", out, "--emptyOutDir"], { encoding: "utf8" });
if (build.status !== 0) { console.error("preview build failed:\n" + (build.stderr || build.stdout).slice(-2000)); process.exit(2); }
const cssFiles = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".css")) cssFiles.push(p); } };
walk(out);
const css = cssFiles.map((f) => readFileSync(f, "utf8")).join("\n");

// Classes that are markers for other selectors (group-hover:, peer-checked:) and produce no CSS of their own.
// Hooks with no style of their own: "blank" is found by App.tsx (querySelector(".blank button.primary")), "mark" wraps a row's status icon.
const MARKERS = new Set(["group", "peer", "dark", "sr-only-focusable", "blank", "mark"]);
// Classes the browser checks find elements by (".sidebar" in tests/e2e/*.spec.ts) are hooks, not styles: keep them.
const hooks = new Set();
const walkJs = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walkJs(p); else if (/\.(m?js|ts)$/.test(p)) for (const q of readFileSync(p, "utf8").matchAll(/(["'`])((?:(?!\1).)*)\1/g)) for (const m of q[2].matchAll(/(?:^|[\s,>+~(])\.([a-z][a-z0-9-]*)/g)) hooks.add(m[1]); } };
walkJs("scripts"); walkJs("tests/e2e");
const escape =(c) => c.replace(/[^a-zA-Z0-9_-]/g, (ch) => "\\" + ch);

const files = [];
const walkSrc = (d) => { for (const f of readdirSync(d)) { const p = path.join(d, f); if (statSync(p).isDirectory()) walkSrc(p); else if (/\.tsx$/.test(p) && !/\.test\.tsx$/.test(p)) files.push(p); } };
walkSrc("src");

// Class strings: className="...", className={"..."}, className={`...`} (static parts), and every string
// literal on a line that calls cn( or belongs to a variants map.
const classAttr = /className=(?:"([^"]*)"|\{\s*"([^"]*)"\s*\}|\{\s*`([^`]*)`\s*\})/g;
const literal = /"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`/g;
const unknown = new Map();
for (const f of files) {
  const lines = readFileSync(f, "utf8").split("\n");
  let inVariants = false;
  lines.forEach((line, i) => {
    if (/\bvariants\b.*=\s*\{/.test(line)) inVariants = true;
    const strings = [];
    for (const m of line.matchAll(classAttr)) strings.push(m[1] ?? m[2] ?? m[3]);
    if (/\bcn\(/.test(line) || inVariants) for (const m of line.matchAll(literal)) strings.push(m[1] ?? m[2] ?? m[3]);
    if (inVariants && /^\s*\}\s*(as const)?;?\s*$/.test(line)) inVariants = false;
    for (const s of strings) {
      for (const c of s.replace(/\$\{[^}]*\}/g, " ").split(/\s+/).filter(Boolean)) {
        if (!/^[!-]?[a-z@\[]/.test(c) || /[(){};]/.test(c.replace(/\[[^\]]*\]/g, ""))) continue; // not a class (prose, code)
        if (MARKERS.has(c) || hooks.has(c) ||/^(group|peer)\/[a-z]+$/.test(c)) continue;
        if (css.includes("." + escape(c))) continue;
        if (!unknown.has(c)) unknown.set(c, `${f}:${i + 1}`);
      }
    }
  });
}
if (process.env.SHOW_HOOKS) console.error("hooks kept: " + [...hooks].sort().join(" "));
for (const [c, where] of unknown) console.error(`unknown class "${c}" (first at ${where}): it produces no CSS`);
console.log(unknown.size ? `${unknown.size} unknown classes` : `every class in src produces CSS (${files.length} files)`);
process.exit(unknown.size ? 1 : 0);

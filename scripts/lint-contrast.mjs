// WCAG contrast of the design tokens, light and dark. Text needs 4.5:1, state colours (icons, dots) need 3:1.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const css = fs.readFileSync(path.join(root, "docs/plan/design/container-ui.css"), "utf8");

const block = (selector) => {
  const at = css.indexOf(selector + " {");
  if (at < 0) throw new Error(`contrast: no block "${selector}" in container-ui.css`);
  return css.slice(at, css.indexOf("\n}", at));
};
const tokens = (text) => Object.fromEntries([...text.matchAll(/(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
const light = tokens(block(":root"));
const dark = { ...light, ...tokens(block(':root[data-theme="dark"]')) };

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const TEXT = ["--fg", "--fg-muted", "--fg-faint", "--accent-ink"];
const STATE = ["--ok", "--warn", "--bad", "--info"];
const SURFACES = ["--bg", "--bg-sidebar", "--bg-raised"];
let failed = 0;
for (const [theme, t] of [["light", light], ["dark", dark]]) {
  for (const name of [...TEXT, ...STATE, "--on-accent"]) {
    const need = TEXT.includes(name) || name === "--on-accent" ? 4.5 : 3;
    const surfaces = name === "--on-accent" ? ["--accent"] : SURFACES;
    for (const s of surfaces) {
      if (!t[name] || !t[s]) { console.log("FAIL", `contrast: ${theme} token ${!t[name] ? name : s} is missing or not a #rrggbb colour`); failed++; continue; }
      const r = ratio(t[name], t[s]);
      const ok = r >= need;
      console.log(ok ? "ok" : "FAIL", `contrast: ${theme} ${name} on ${s} is ${r.toFixed(2)}:1 (needs ${need}:1)`);
      if (!ok) failed++;
    }
  }
}
process.exit(failed ? 1 : 0);
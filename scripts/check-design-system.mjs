// The design system gate. Every button, select and text box on a screen must come from src/ui/op (they carry data-op
// or sit inside a .field). A bare one inside .legacy gets the old browser look, which is how the namespace select got its
// arrow in the middle. scripts/design-system-baseline.txt lists the ones not migrated yet: a new one fails here, and a
// migrated one is reported so you delete its line. Goal: an empty baseline.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { open, check, done } from "./lib/check.mjs";

const BASELINE = new URL("./design-system-baseline.txt", import.meta.url);
const routes = ["containers", "images", "volumes", "networks", "settings/machines", "doctor", "kubernetes", "settings"];
const scenarios = ["running", "k8spods", "stopped"];
const seen = new Set();
for (const scn of scenarios) {
  for (const r of routes) {
    const page = await open(`/?scenario=${scn}#/${r}`, { width: 1100, height: 800 });
    await page.waitForTimeout(700);
    const bare = await page.evaluate(() =>
      [...document.querySelectorAll(".legacy button, .legacy select, .legacy textarea, .legacy input:not([type=checkbox]):not([type=radio]):not([type=hidden])")]
        .filter((e) => !e.hasAttribute("data-op") && !e.closest("[data-op]") && !e.closest(".field"))
        .map((e) => `${e.tagName.toLowerCase()}|${(e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || "").trim().slice(0, 40)}`));
    for (const b of bare) seen.add(`${r}|${b}`);
    await page.close();
  }
}
const mine = process.env.UPDATE_BASELINE === "1";
if (mine) writeFileSync(BASELINE, [...seen].sort().join("\n") + "\n");
const baseline = new Set(existsSync(BASELINE) ? readFileSync(BASELINE, "utf8").split("\n").filter(Boolean) : []);
const fresh = [...seen].filter((k) => !baseline.has(k));
const gone = [...baseline].filter((k) => !seen.has(k));
check(fresh.length === 0, `Design system: no new native control outside src/ui/op${fresh.length ? " (use the op component): " + fresh.join("; ") : ""}`);
if (gone.length) console.log(`note: ${gone.length} baseline line(s) are migrated now, delete them: ${gone.slice(0, 6).join("; ")}`);
console.log(`not migrated yet: ${baseline.size}`);
done();

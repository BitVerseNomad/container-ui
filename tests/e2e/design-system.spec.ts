import { test, expect } from "@playwright/test";
import { opener } from "./helpers";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const routes = ["containers", "images", "volumes", "networks", "settings/machines", "doctor", "kubernetes", "settings"];
const scenarios = ["running", "k8spods", "stopped"];
const mine = process.env.UPDATE_BASELINE === "1";

test("The design system gate", async ({ context }) => {
  const open = opener(context);
  const BASELINE = new URL("./design-system-baseline.txt", import.meta.url);
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
  if (mine) writeFileSync(BASELINE, [...seen].sort().join("\n") + "\n");
  const baseline = new Set(existsSync(BASELINE) ? readFileSync(BASELINE, "utf8").split("\n").filter(Boolean) : []);
  const fresh = [...seen].filter((k) => !baseline.has(k));
  const gone = [...baseline].filter((k) => !seen.has(k));
  expect.soft(fresh.length === 0, `Design system: no new native control outside src/ui/op${fresh.length ? " (use the op component): " + fresh.join("; ") : ""}`).toBeTruthy();
  if (gone.length) console.log(`note: ${gone.length} baseline line(s) are migrated now, delete them: ${gone.slice(0, 6).join("; ")}`);
  console.log(`not migrated yet: ${baseline.size}`);
});

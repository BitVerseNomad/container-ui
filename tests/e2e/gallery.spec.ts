import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

test("The gallery shows every component without a page error, in both themes", async ({ page }) => {
  for (const theme of ["light", "dark"]) {
    const p = await openPage(page, "/#/dev/gallery", { colorScheme: theme });
    await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await p.waitForSelector(".group-cap");
    const names = await p.locator(".group-cap").allInnerTexts();
    for (const n of ["Button", "Field", "Select", "Switch", "Chip", "Tabs", "Dot", "Sev", "Banner", "Empty", "SkeletonRows", "Canvas", "Command", "Tile", "Facts", "GroupCaption", "Row", "Problem", "Blocks", "Sparkline", "Meters", "Menu", "Sheet", "ConfirmDialog", "Toast", "Inspector"])
      expect.soft(names.some((x) => x.startsWith(n)), `gallery (${theme}): has a section for ${n}`).toBeTruthy();
    await expect.soft(p.locator("button.primary"), `gallery (${theme}): shows a primary button`).not.toHaveCount(0);
    await p.screenshot({ path: `test-results/gallery-${theme}.png`, fullPage: true });
  }
});

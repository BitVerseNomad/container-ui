// The gallery shows every component without a page error, in both themes.
import { open, check, done } from "./lib/check.mjs";
for (const theme of ["light", "dark"]) {
  const p = await open("/#/dev/gallery", { colorScheme: theme });
  await p.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
  await p.waitForSelector(".group-cap");
  const names = await p.locator(".group-cap").allInnerTexts();
  for (const n of ["Button", "Field", "Select", "Switch", "Chip", "Tabs", "Dot", "Sev", "Banner", "Empty", "SkeletonRows", "Canvas", "Command", "Tile", "Facts", "GroupCaption", "Row", "Problem", "Blocks", "Sparkline", "Meters", "Menu", "Sheet", "ConfirmDialog", "Toast", "Inspector"])
    check(names.some((x) => x.startsWith(n)), `gallery (${theme}): has a section for ${n}`);
  check((await p.locator(".btn.primary").count()) > 0, `gallery (${theme}): shows a primary button`);
  await p.screenshot({ path: `test-results/gallery-${theme}.png`, fullPage: true });
}
await done();
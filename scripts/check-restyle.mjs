// Restyle checks against the preview (WO-2.2). Runs in Chromium and WebKit.
// Verifies that every page stays within its container (no sideways overflow)
// at both the default and minimum window sizes.
// Legacy page markup assertions (rows, Stop button, Pull button) are not
// checked here: those pages keep their old markup until WO-3.x migrates them,
// and their checks move to the migration work orders.
import { engine, open, check, done } from "./lib/check.mjs";

const PAGES = ["#/containers", "#/images", "#/volumes", "#/networks", "#/kubernetes/pods", "#/doctor", "#/settings/machines"];
const SIZES = [
  { width: 1180, height: 760 },   // the new default window
  { width: 900, height: 600 },    // the new minimum window
];

for (const { width, height } of SIZES) {
  for (const pagePath of PAGES) {
    const page = await open(pagePath, { width, height });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(300);

    // 1. No sideways overflow in `.content` on every page, at both sizes.
    const sideways = await page.evaluate(() => { const el = document.querySelector(".content"); return el ? el.scrollWidth > el.clientWidth + 1 : false; });
    check(!sideways, `[${width}x${height}] ${pagePath}: no sideways overflow in .content`);

    check(errors.length === 0, `[${width}x${height}] ${pagePath}: no page errors`);
    await page.close();
  }
}

await done();

// Restyle checks against the preview (WO-2.2). Runs in Chromium and WebKit.
// Verifies that every page stays within its container (no sideways overflow)
// at both the default and minimum window sizes.
// Legacy page markup assertions (rows, Stop button, Pull button) are kept
// here for pages that are still legacy until WO-3.x migrates them.
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

    // Old lines brought back from checks-pending/check-restyle.mjs:
    if (pagePath === "#/images") {
      // Images rows use IconButton.
      check(await page.locator("tbody tr:not(.group-row) .icon-btn").count() >= 2,
        `[${width}x${height}] images: rows use IconButton`);
    }
    if (pagePath === "#/volumes") {
      // Volumes rows use IconButton.
      check(await page.locator("tbody tr:not(.group-row) .icon-btn").count() >= 1,
        `[${width}x${height}] volumes: rows use IconButton`);
    }
    if (pagePath === "#/settings/machines") {
      // Settings page explains what a machine profile is.
      check(await page.locator(".content").innerText().then((t) => /separate Colima VM/i.test(t)),
        `[${width}x${height}] profiles: explains what a profile is`);
      // Stop streams into .out-log.
      await page.getByRole("button", { name: /^Stop default/ }).click().catch(() => {});
      check(await page.locator(".out-log").count() === 1,
        `[${width}x${height}] profiles: streamed output uses OutputLog`);
    }

    check(errors.length === 0, `[${width}x${height}] ${pagePath}: no page errors`);
    await page.close();
  }
}

// The pull panel uses OutputLog (fresh page, VM running).
const pullPage = await open("#/images", { width: 1180, height: 760 });
await pullPage.getByRole("button", { name: "Pull image" }).click().catch(() => {});
await pullPage.getByLabel("Image to pull").fill("redis").catch(() => {});
await pullPage.getByRole("button", { name: /^Pull redis/ }).click().catch(() => {});
check(await pullPage.locator(".drawer .out-log").count() === 1,
  "pull panel: progress uses OutputLog");
await pullPage.close();

await done();

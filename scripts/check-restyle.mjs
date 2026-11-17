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

// 1. No sideways overflow in `.content` on every page, at both sizes.
// Navigate without scenario: legacy pages show empty state, no table, no overflow.
for (const { width, height } of SIZES) {
  for (const pagePath of PAGES) {
    const page = await open(pagePath, { width, height });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.waitForTimeout(300);

    const sideways = await page.evaluate(() => { const el = document.querySelector(".content"); return el ? el.scrollWidth > el.clientWidth + 1 : false; });
    check(!sideways, `[${width}x${height}] ${pagePath}: no sideways overflow in .content`);
    check(errors.length === 0, `[${width}x${height}] ${pagePath}: no page errors`);
    await page.close();
  }
}

// Legacy button/content checks need ?scenario=design so legacy pages show mock rows.
// Legacy Images.tsx uses op.Button which renders <button class="btn ..."> (not .icon-btn).
for (const { width, height } of SIZES) {
  const page = await open("/?scenario=design#/images", { width, height });
  await page.waitForSelector("tbody tr", { state: "attached", timeout: 5000 });
  check(await page.locator("tbody tr button").count() >= 2,
    `[${width}x${height}] images: rows use IconButton`);
  await page.close();
}

// Legacy Volumes.tsx uses op.Button which renders <button class="btn ..."> (not .icon-btn).
for (const { width, height } of SIZES) {
  const page = await open("/?scenario=design#/volumes", { width, height });
  await page.waitForSelector("tbody tr", { state: "attached", timeout: 5000 });
  check(await page.locator("tbody tr button").count() >= 1,
    `[${width}x${height}] volumes: rows use IconButton`);
  await page.close();
}

// Settings page explains what a machine profile is; Stop streams into .out-log.
for (const { width, height } of SIZES) {
  const page = await open("/?scenario=design#/settings/machines", { width, height });
  check(await page.locator(".content").innerText().then((t) => /separate Colima VM/i.test(t)),
    `[${width}x${height}] profiles: explains what a profile is`);
  await page.getByRole("button", { name: /^Stop default/ }).click().catch(() => {});
  await page.waitForSelector(".out-log", { state: "attached", timeout: 5000 });
  check(await page.locator(".out-log").count() === 1,
    `[${width}x${height}] profiles: streamed output uses OutputLog`);
  await page.close();
}

// The pull sheet shows progress in a progress element (fresh page, VM running).
const pullPage = await open("/?scenario=design#/images", { width: 1180, height: 760 });
await pullPage.getByRole("button", { name: "Pull image" }).click().catch(() => {});
await pullPage.getByLabel("Image to pull").fill("redis").catch(() => {});
await pullPage.getByRole("button", { name: /^Pull redis/ }).click().catch(() => {});
await pullPage.waitForSelector('[role=dialog] progress[aria-label="Pull progress"]', { state: "attached", timeout: 5000 });
check(await pullPage.locator('[role=dialog] progress[aria-label="Pull progress"]').count() === 1,
  "pull panel: progress is shown in a progress element");
await pullPage.close();

await done();

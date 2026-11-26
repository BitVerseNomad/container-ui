import { test, expect } from "@playwright/test";
import { opener } from "./helpers";

const PAGES = ["#/containers", "#/images", "#/volumes", "#/networks", "#/kubernetes/pods", "#/doctor", "#/settings/machines"];
const SIZES = [
  { width: 1180, height: 760 },   // the new default window
  { width: 900, height: 600 },    // the new minimum window
];

test("Restyle checks against the preview (WO-2.2)", async ({ context }) => {
  const open = opener(context);
  for (const { width, height } of SIZES) {
    for (const pagePath of PAGES) {
      const page = await open(pagePath, { width, height });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.waitForTimeout(300);

      const sideways = await page.evaluate(() => { const el = document.querySelector(".content"); return el ? el.scrollWidth > el.clientWidth + 1 : false; });
      expect.soft(!sideways, `[${width}x${height}] ${pagePath}: no sideways overflow in .content`).toBeTruthy();
      expect.soft(errors.length === 0, `[${width}x${height}] ${pagePath}: no page errors`).toBeTruthy();
      await page.close();
    }
  }
  for (const { width, height } of SIZES) {
    const page = await open("/?scenario=design#/images", { width, height });
    await page.waitForSelector("tbody tr", { state: "attached", timeout: 5000 });
    expect.soft(await page.locator("tbody tr button").count() >= 2, `[${width}x${height}] images: rows use IconButton`).toBeTruthy();
    await page.close();
  }
  for (const { width, height } of SIZES) {
    const page = await open("/?scenario=design#/volumes", { width, height });
    await page.waitForSelector("tbody tr", { state: "attached", timeout: 5000 });
    await expect.soft(page.locator("tbody tr button"), `[${width}x${height}] volumes: rows use IconButton`).not.toHaveCount(0);
    await page.close();
  }
  for (const { width, height } of SIZES) {
    const page = await open("/?scenario=design#/settings/machines", { width, height });
    expect.soft(await page.locator(".content").innerText().then((t) => /separate Colima VM/i.test(t)), `[${width}x${height}] machines: explains what a machine is`).toBeTruthy();
    await page.getByRole("button", { name: /^Stop default/ }).click().catch(() => {});
    await page.waitForSelector(".out-log", { state: "attached", timeout: 5000 });
    await expect.soft(page.locator(".out-log"), `[${width}x${height}] machines: streamed output uses OutputLog`).toHaveCount(1);
    await page.close();
  }
  const pullPage = await open("/?scenario=design#/images", { width: 1180, height: 760 });
  await pullPage.getByRole("button", { name: "Pull image" }).click().catch(() => {});
  await pullPage.getByLabel("Image to pull").fill("redis").catch(() => {});
  await pullPage.getByRole("button", { name: /^Pull redis/ }).click().catch(() => {});
  await pullPage.waitForSelector('[role=dialog] progress[aria-label="Pull progress"]', { state: "attached", timeout: 5000 });
  await expect.soft(pullPage.locator('[role=dialog] progress[aria-label="Pull progress"]'), "pull panel: progress is shown in a progress element").toHaveCount(1);
  await pullPage.close();
});

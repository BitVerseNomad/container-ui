import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;
const MANY = 300;
const VIEW = { width: 1280, height: 800 };
async function fillLog(page) {
  return page.evaluate((n) => {
    const pre = document.querySelector("pre.out-log");
    if (!pre) return null;
    for (let i = 0; i < n; i++) {
      const line = document.createElement("div");
      line.textContent = `Pulling layer ${i} of ${n}  ...  done`;
      pre.appendChild(line);
    }
    pre.scrollTop = pre.scrollHeight;
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return { height: pre.getBoundingClientRect().height, limit: 15 * rootPx, scrolls: pre.scrollHeight > pre.clientHeight };
  }, MANY);
}

test("1. Stopping on the Containers screen: the strip shows Stopping… with Cancel on the same row.", async ({ page }) => {
  const engine = test.info().project.name;
  await openPage(page, "/?scenario=running#/containers", VIEW);
  await page.locator("[data-slot=engine] button").first().click();
  await page.getByRole("menuitem", { name: /^Stop / }).click();
  const log = page.locator("pre.out-log").first();
  await log.waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  const measured = await fillLog(page);
  expect.soft(measured !== null, `${engine} stopping: the output window shows while the machine stops`).toBeTruthy();
  if (measured) {
      expect.soft(measured.height <= measured.limit, `${engine} stopping: the output window is at most 15rem (${Math.round(measured.height)}px of ${measured.limit}px)`).toBeTruthy();
      expect.soft(measured.scrolls, `${engine} stopping: the output window scrolls inside itself`).toBeTruthy();
    }
  const strip = page.locator(".vm-strip");
  await expect.soft(strip, `${engine} stopping: the status strip is shown`).not.toHaveCount(0);
  const bottom = await page.locator(".vm-strip").boundingBox();
  expect.soft(bottom && bottom.y + bottom.height <= VIEW.height, `${engine} stopping: the strip sits inside the window`).toBeTruthy();
  const rowBox = await page.locator(".list > .row:not(.th):not(.child)").first().boundingBox();
  expect.soft(rowBox && rowBox.y + rowBox.height <= VIEW.height, `${engine} stopping: the first container row stays inside the window`).toBeTruthy();
  const plainButtons = await page.locator(".vm-strip button:not([data-op])").count();
  expect.soft(plainButtons === 0, `${engine} stopping: every button in the strip is an op button (${plainButtons} plain)`).toBeTruthy();
  const cancel = page.locator(".vm-strip").getByRole("button", { name: "Cancel" });
  const word = page.locator(".vm-strip .hint").filter({ hasText: /Stopping/ }).first();
  if (await cancel.count() && await word.count()) {
      const c = await cancel.boundingBox();
      const w = await word.boundingBox();
      expect.soft(Math.abs(c.y + c.height / 2 - (w.y + w.height / 2)) <= 6, `${engine} stopping: Cancel sits on the same row as Stopping…`).toBeTruthy();
    } else {
      expect.soft(false, `${engine} stopping: Cancel and Stopping… both show`).toBeTruthy();
    }
  const copy = page.getByRole("button", { name: "Copy raw output" });
  await expect.soft(copy, `${engine} stopping: Copy raw output is a named button`).not.toHaveCount(0);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/containers-stopping-${engine}.png` });
  await page.close();
});

test("2. Starting on the Machines page: the output stays open while it runs, then folds to Show output.", async ({ page }) => {
  await openPage(page, "/?scenario=stopped#/settings/machines", VIEW);
  const start = page.getByRole("button", { name: /^Start/ }).first();
  await start.click({ timeout: 5000 }).catch(() => {});
  await page.locator("pre.out-log").first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  const measured = await fillLog(page);
  expect.soft(measured !== null, "machines starting: the output window shows while the machine starts").toBeTruthy();
  if (measured) expect.soft(measured.height <= measured.limit, `machines starting: the output window is at most 15rem (${Math.round(measured.height)}px of ${measured.limit}px)`).toBeTruthy();
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/machines-starting-${engine}.png` });
  const folded = page.getByText(/^Show output \(\d+ lines\)$/).first();
  await folded.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  await expect.soft(folded, "machines done: the output folds to Show output (N lines)").not.toHaveCount(0);
  await page.close();
});

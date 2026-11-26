import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

const rowCount = (page) => page.locator(".list > .row:not(.th):not(.child)").count();
const hasButton = (page, name) => page.getByRole("button", { name }).count();

test("---- Windows ----", async ({ page }) => {
  await openPage(page, "/?platform=windows&scenario=running#/containers");
  await page.waitForSelector(".list > .row", { timeout: 8000 }).catch(() => {});
  expect.soft((await rowCount(page)) > 0, "windows: the container list shows").toBeTruthy();
  await expect.soft(page.getByText("Homebrew"), "windows: no Homebrew text").toHaveCount(0);
  await expect.soft(page.getByText("Colima"), "windows: no Colima text").toHaveCount(0);
  expect.soft((await hasButton(page, /Machines/)) === 0, "windows: no Machines button").toBeTruthy();
  expect.soft((await hasButton(page, /^Settings$/)) === 0, "windows: no Settings button").toBeTruthy();
  await expect.soft(page.getByRole("link", { name: /Doctor/ }), "windows: no Doctor in the sidebar").toHaveCount(0);
  const engine = page.locator('[data-slot="engine"] button').first();
  expect.soft(/Docker.*WSL/.test((await engine.getAttribute("aria-label")) ?? ""), "windows: the engine is Docker (WSL)").toBeTruthy();
  await engine.click();
  await expect.soft(page.getByRole("menuitem", { name: /Machines/ }), "windows: the engine menu has no Machines").toHaveCount(0);
  await expect.soft(page.getByRole("menuitem", { name: /^Stop / }), "windows: the engine menu has no Stop").toHaveCount(0);
  await page.keyboard.press("Escape");
  const row = page.locator('.list > .row[aria-label*="web"]').first();
  await row.hover();
  await row.getByRole("button", { name: /More/ }).first().click();
  await expect.soft(page.getByRole("menuitem", { name: /Restart/ }), "windows: the row menu opened").not.toHaveCount(0);
  await expect.soft(page.getByRole("menuitem", { name: /Open a shell/ }), "windows: no Open a shell in the row menu").toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Meta+k");
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 }).catch(() => {});
  await expect.soft(page.locator('[role="dialog"]'), "windows: the palette opened").not.toHaveCount(0);
  await expect.soft(page.getByText("Machines…"), "windows: no Machines… in the palette").toHaveCount(0);
  await expect.soft(page.getByText("Doctor"), "windows: no Doctor in the palette").toHaveCount(0);
  await page.close();
});

test("The setup wall must not show even when the Mac scenario would show it (Homebrew missing).", async ({ page }) => {
  await openPage(page, "/?platform=windows&scenario=nobrew#/containers");
  await page.waitForSelector(".list > .row", { timeout: 8000 }).catch(() => {});
  await expect.soft(page.getByText("Homebrew"), "windows, no brew: no Homebrew wall").toHaveCount(0);
  expect.soft((await rowCount(page)) > 0, "windows, no brew: the container list shows").toBeTruthy();
  await page.close();
});

test("---- macOS stays as it was ----", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers");
  await page.waitForSelector(".list > .row", { timeout: 8000 }).catch(() => {});
  expect.soft((await page.locator('[data-slot="engine"] button').first().getAttribute("aria-label"))?.startsWith("Engine: Colima"), "mac: the engine is Colima").toBeTruthy();
  await page.locator('[data-slot="engine"] button').first().click();
  await expect.soft(page.getByRole("menuitem", { name: /Machines/ }), "mac: the engine menu has Machines").toHaveCount(1);
  await page.keyboard.press("Escape");
  expect.soft((await hasButton(page, /^Settings$/)) === 1, "mac: Settings button is there").toBeTruthy();
  await expect.soft(page.getByRole("link", { name: /Doctor/ }), "mac: Doctor is in the sidebar").not.toHaveCount(0);
  await page.close();
});

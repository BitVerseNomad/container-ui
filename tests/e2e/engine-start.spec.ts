import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

const WAIT = 5000;

test("1. Running scenario: container list shows, not the onboarding.", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers", { width: 1280, height: 800 });
  await page.locator(".list .row .name").filter({ hasText: "web" }).waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
  const webRow = await page.locator(".list .row .name").filter({ hasText: "web" }).count() > 0;
  const onboarding = await page.locator("text=Start your first machine").count() > 0;
  expect.soft(webRow, "running: a row named web shows").toBeTruthy();
  expect.soft(!onboarding, "running: Start your first machine does not show").toBeTruthy();
  await page.close();
});

test("2. None scenario: Colima installed, no machine yet, onboarding shows.", async ({ page }) => {
  await openPage(page, "/?scenario=none#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(300);
  const onboarding = await page.locator("text=Start your first machine").count() > 0;
  expect.soft(onboarding, "none: Start your first machine shows").toBeTruthy();
  await page.close();
});

test("3. Stopped scenario: machine is stopped, Start button shows.", async ({ page }) => {
  await openPage(page, "/?scenario=stopped#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(300);
  const title = await page.locator("text=default is stopped").count() > 0;
  const button = await page.getByRole("button", { name: "Start", exact: true }).count() > 0;
  expect.soft(title, "stopped: default is stopped shows").toBeTruthy();
  expect.soft(button, "stopped: Start button shows").toBeTruthy();
  await page.close();
});

test("4. Unreachable scenario: error banner shows within 5 s.", async ({ page }) => {
  await openPage(page, "/?scenario=unreachable#/containers", { width: 1280, height: 800 });
  const banner = await page.locator("text=Couldn't list containers").waitFor({ state: "attached", timeout: WAIT }).then(() => true).catch(() => false);
  expect.soft(banner, "unreachable: Couldn't list containers shows within 5 s").toBeTruthy();
  await page.close();
});

test("5. Missing scenario: tools missing, install them, then Start; the default machine shows within 5 s.", async ({ page }) => {
  await openPage(page, "/?scenario=missing#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(300);
  const missing = await page.locator("text=isn't installed yet").count() > 0 || await page.locator("text=tools are missing").count() > 0;
  expect.soft(missing, "missing: onboarding install offer shows").toBeTruthy();
  const installBtn = page.getByRole("button", { name: /Install with Homebrew/ });
  if (await installBtn.count() > 0) {
      await installBtn.click();
      // Wait for the install to finish and the "Set up and start" button to appear.
      await page.getByRole("button", { name: /^Set up and start/ }).waitFor({ state: "attached", timeout: 15000 }).catch(() => {});
      await page.getByRole("button", { name: /^Set up and start/ }).click().catch(() => {});
      // Wait up to 5 s for the default machine to show.
      await page.locator("text=Colima · default").waitFor({ state: "attached", timeout: WAIT }).then(() => true).catch(() => false);
    }
  const defaultShows = await page.locator("text=Colima · default").count() > 0;
  expect.soft(defaultShows, "missing: default machine shows after Start").toBeTruthy();
  await page.close();
});

test("6. Slow first answer: a running machine never shows the first-run card while the list loads.", async ({ page }) => {
  await openPage(page, "/?scenario=running&slowprofiles=1#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(500);
  expect.soft(await page.locator("text=Start your first machine").count(), "no first-run card while loading").toBe(0);
  await expect.soft(page.locator("text=Looking for your machines")).toBeVisible();
  await page.locator(".list .row .name").filter({ hasText: "web" }).waitFor({ state: "attached", timeout: 10000 });
  await page.close();
});

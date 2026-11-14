// Engine startup checks against the preview (WO-2.6). Runs in Chromium and WebKit.
// Verifies the app picks an engine at startup and shows containers instead of onboarding.
import { engine, open, check, done } from "./lib/check.mjs";

const WAIT = 5000;

// 1. Running scenario: container list shows, not the onboarding.
{
  const page = await open("/?scenario=running#/containers", { width: 1280, height: 800 });
  await page.locator(".list .row .name").filter({ hasText: "web" }).waitFor({ state: "attached", timeout: 10000 }).catch(() => {});
  const webRow = await page.locator(".list .row .name").filter({ hasText: "web" }).count() > 0;
  const onboarding = await page.locator("text=Start your first VM").count() > 0;
  check(webRow, "running: a row named web shows");
  check(!onboarding, "running: Start your first VM does not show");
  await page.close();
}

// 2. None scenario: Colima installed, no machine yet, onboarding shows.
{
  const page = await open("/?scenario=none#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(300);
  const onboarding = await page.locator("text=Start your first VM").count() > 0;
  check(onboarding, "none: Start your first VM shows");
  await page.close();
}

// 3. Stopped scenario: machine is stopped, Start button shows.
{
  const page = await open("/?scenario=stopped#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(300);
  const title = await page.locator("text=default is stopped").count() > 0;
  const button = await page.locator("text=Start default").count() > 0;
  check(title, "stopped: default is stopped shows");
  check(button, "stopped: Start default button shows");
  await page.close();
}

// 4. Unreachable scenario: error banner shows within 5 s.
{
  const page = await open("/?scenario=unreachable#/containers", { width: 1280, height: 800 });
  const banner = await page.locator("text=Couldn't list containers").waitFor({ state: "attached", timeout: WAIT }).then(() => true).catch(() => false);
  check(banner, "unreachable: Couldn't list containers shows within 5 s");
  await page.close();
}

// 5. Missing scenario: tools missing, onboarding offers install, then machine shows.
{
  const page = await open("/?scenario=missing#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(300);
  const missing = await page.locator("text=isn't installed yet").count() > 0 || await page.locator("text=tools are missing").count() > 0;
  check(missing, "missing: onboarding install offer shows");
  await page.close();
}

await done();

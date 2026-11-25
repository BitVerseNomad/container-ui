// Windows (docker inside WSL2): no Colima or Homebrew screens, no Machines, no Mac-only actions; the containers show.
// ?platform=windows makes the preview's platform_info answer as Windows. Run once against / to prove the Mac still has them.
import { open, check, done } from "./lib/check.mjs";

const rowCount = (page) => page.locator(".list > .row:not(.th):not(.child)").count();
const hasButton = (page, name) => page.getByRole("button", { name }).count();

// ---- Windows ----
{
  const page = await open("/?platform=windows&scenario=running#/containers");
  await page.waitForSelector(".list > .row", { timeout: 8000 }).catch(() => {});
  check((await rowCount(page)) > 0, "windows: the container list shows");
  check((await page.getByText("Homebrew").count()) === 0, "windows: no Homebrew text");
  check((await page.getByText("Colima").count()) === 0, "windows: no Colima text");
  check((await hasButton(page, /Machines/)) === 0, "windows: no Machines button");
  check((await hasButton(page, /^Settings$/)) === 0, "windows: no Settings button");
  check((await page.getByRole("link", { name: /Doctor/ }).count()) === 0, "windows: no Doctor in the sidebar");
  const engine = page.locator('[data-slot="engine"] button').first();
  check(/Docker.*WSL/.test((await engine.getAttribute("aria-label")) ?? ""), "windows: the engine is Docker (WSL)");
  await engine.click();
  check((await page.getByRole("menuitem", { name: /Machines/ }).count()) === 0, "windows: the engine menu has no Machines");
  check((await page.getByRole("menuitem", { name: /^Stop / }).count()) === 0, "windows: the engine menu has no Stop");
  await page.keyboard.press("Escape");
  // A running container's row menu: opened for real, then it must have its usual items but no Open a shell.
  const row = page.locator('.list > .row[aria-label*="web"]').first();
  await row.hover();
  await row.getByRole("button", { name: /More/ }).first().click();
  check((await page.getByRole("menuitem", { name: /Restart/ }).count()) > 0, "windows: the row menu opened");
  check((await page.getByRole("menuitem", { name: /Open a shell/ }).count()) === 0, "windows: no Open a shell in the row menu");
  await page.keyboard.press("Escape");
  // The palette: opened for real, then no Machines… and no Doctor.
  await page.keyboard.press("Control+k");
  await page.keyboard.press("Meta+k");
  await page.waitForSelector('[role="dialog"]', { timeout: 3000 }).catch(() => {});
  check((await page.locator('[role="dialog"]').count()) > 0, "windows: the palette opened");
  check((await page.getByText("Machines…").count()) === 0, "windows: no Machines… in the palette");
  check((await page.getByText("Doctor").count()) === 0, "windows: no Doctor in the palette");
  await page.close();
}
// The setup wall must not show even when the Mac scenario would show it (Homebrew missing).
{
  const page = await open("/?platform=windows&scenario=nobrew#/containers");
  await page.waitForSelector(".list > .row", { timeout: 8000 }).catch(() => {});
  check((await page.getByText("Homebrew").count()) === 0, "windows, no brew: no Homebrew wall");
  check((await rowCount(page)) > 0, "windows, no brew: the container list shows");
  await page.close();
}
// ---- macOS stays as it was ----
{
  const page = await open("/?scenario=running#/containers");
  await page.waitForSelector(".list > .row", { timeout: 8000 }).catch(() => {});
  check((await page.locator('[data-slot="engine"] button').first().getAttribute("aria-label"))?.startsWith("Engine: Colima"), "mac: the engine is Colima");
  await page.locator('[data-slot="engine"] button').first().click();
  check((await page.getByRole("menuitem", { name: /Machines/ }).count()) === 1, "mac: the engine menu has Machines");
  await page.keyboard.press("Escape");
  check((await hasButton(page, /^Settings$/)) === 1, "mac: Settings button is there");
  check((await page.getByRole("link", { name: /Doctor/ }).count()) > 0, "mac: Doctor is in the sidebar");
  await page.close();
}
await done();

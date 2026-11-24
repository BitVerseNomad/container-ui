// The command output window (OutputLog) while a machine stops or starts. It keeps a fixed height, scrolls
// inside itself, and the page below it stays on screen. Runs in Chromium and WebKit against the preview.
// The preview's fake backend prints only a few lines, so the check adds many more to the open log by hand.
// The height limit is CSS, so this tests the part that matters.
import { open, check, done } from "./lib/check.mjs";

const SHOTS = process.env.SHOTS_DIR;
const MANY = 300;
const VIEW = { width: 1280, height: 800 };

// Adds MANY lines to the open log and returns its height in px next to the 15rem limit.
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

// 1. Stopping on the Containers screen: the strip shows Stopping… with Cancel on the same row.
// PW_ENGINE picks the engine (lib/check.mjs reads it once), so run this file once per engine.
const engine = process.env.PW_ENGINE || "chromium";
{
  const page = await open("/?scenario=running#/containers", VIEW);
  await page.locator("[data-slot=engine] button").first().click();
  await page.getByRole("menuitem", { name: /^Stop / }).click();
  const log = page.locator("pre.out-log").first();
  await log.waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  const measured = await fillLog(page);
  check(measured !== null, `${engine} stopping: the output window shows while the machine stops`);
  if (measured) {
    check(measured.height <= measured.limit, `${engine} stopping: the output window is at most 15rem (${Math.round(measured.height)}px of ${measured.limit}px)`);
    check(measured.scrolls, `${engine} stopping: the output window scrolls inside itself`);
  }
  const strip = page.locator(".vm-strip");
  check(await strip.count() > 0, `${engine} stopping: the status strip is shown`);
  const bottom = await page.locator(".vm-strip").boundingBox();
  check(bottom && bottom.y + bottom.height <= VIEW.height, `${engine} stopping: the strip sits inside the window`);
  const rowBox = await page.locator(".list > .row:not(.th):not(.child)").first().boundingBox();
  check(rowBox && rowBox.y + rowBox.height <= VIEW.height, `${engine} stopping: the first container row stays inside the window`);
  const plainButtons = await page.locator(".vm-strip button:not([data-op])").count();
  check(plainButtons === 0, `${engine} stopping: every button in the strip is an op button (${plainButtons} plain)`);
  const cancel = page.locator(".vm-strip").getByRole("button", { name: "Cancel" });
  const word = page.locator(".vm-strip .hint").filter({ hasText: /Stopping/ }).first();
  if (await cancel.count() && await word.count()) {
    const c = await cancel.boundingBox();
    const w = await word.boundingBox();
    check(Math.abs(c.y + c.height / 2 - (w.y + w.height / 2)) <= 6, `${engine} stopping: Cancel sits on the same row as Stopping…`);
  } else {
    check(false, `${engine} stopping: Cancel and Stopping… both show`);
  }
  const copy = page.getByRole("button", { name: "Copy raw output" });
  check(await copy.count() > 0, `${engine} stopping: Copy raw output is a named button`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/containers-stopping-${engine}.png` });
  await page.close();
}

// 2. Starting on the Machines page: the output stays open while it runs, then folds to Show output.
{
  const page = await open("/?scenario=stopped#/settings/machines", VIEW);
  const start = page.getByRole("button", { name: /^Start/ }).first();
  await start.click({ timeout: 5000 }).catch(() => {});
  await page.locator("pre.out-log").first().waitFor({ state: "attached", timeout: 3000 }).catch(() => {});
  const measured = await fillLog(page);
  check(measured !== null, "machines starting: the output window shows while the machine starts");
  if (measured) check(measured.height <= measured.limit, `machines starting: the output window is at most 15rem (${Math.round(measured.height)}px of ${measured.limit}px)`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/machines-starting-${engine}.png` });
  const folded = page.getByText(/^Show output \(\d+ lines\)$/).first();
  await folded.waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  check(await folded.count() > 0, "machines done: the output folds to Show output (N lines)");
  await page.close();
}

await done();

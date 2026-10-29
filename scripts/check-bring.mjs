// "Bring them over" from Docker Desktop, on the Doctor page (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
async function open(dd) {
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=desktop&dd=${dd}`);
  await page.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
  await page.getByRole("button", { name: /^Doctor/ }).click();
  await page.locator('.setup [data-setup="desktop_data"]').waitFor({ timeout: 4000 }).catch(() => {});
  return page;
}
const panel = (p) => p.getByRole("dialog", { name: "Bring over from Docker Desktop" });
const go = (p) => panel(p).locator(".actions button").last();

let p = await open("running");
const row = p.locator('.setup [data-setup="desktop_data"]');
check(!/Copy|docker run/.test(await row.innerText()), "Doctor: nothing to copy, no command to paste");
await row.getByRole("button", { name: /^Bring them over: / }).click();
const d = panel(p);
await d.locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
const names = await d.locator(".bring-name").allInnerTexts();
check(names.join(",") === "redis-data,shop_db,uploads,acme/api:dev,postgres:16", `panel: named volumes, then images, nothing untagged (${names.join(",")})`);
check(/1 unnamed volume left out/.test(await d.innerText()), "panel: says it left the unnamed volume out");
const redis = d.locator(".bring-item", { hasText: "redis-data" });
check(await redis.getByRole("checkbox").count() === 0 && /Already in Colima/.test(await redis.innerText()), "panel: a volume Colima already has can't be picked");
const checkedNames = await d.locator(".bring-item").evaluateAll((li) => li.filter((x) => x.querySelector("input:checked")).map((x) => x.querySelector(".bring-name").textContent));
check(checkedNames.join(",") === "shop_db,uploads", `panel: volumes are picked, images are not (${checkedNames.join(",")})`);
check(/^Bring 2 volumes over \(2\.\d GiB\)$/.test(await go(p).innerText()), `panel: the button says what and how much (${await go(p).innerText()})`);
await d.locator(".bring-item", { hasText: "acme/api" }).getByRole("checkbox").check();
check(/^Bring 2 volumes and 1 image over/.test(await go(p).innerText()), "panel: picking an image updates the button");
check(/shop-db-1 uses it in Docker Desktop and will be stopped first/.test(await d.locator(".bring-item", { hasText: "shop_db" }).innerText()), "panel: a volume a running container writes to says it will be stopped first");
await go(p).click();
const ask = await p.getByRole("alertdialog").innerText().catch(() => "");
check(/^Stop shop-db-1 in Docker Desktop\?/.test(ask), "panel: it asks before stopping the container in Docker Desktop");
await p.getByRole("alertdialog").getByRole("button", { name: "Stop and bring over" }).click();
await d.getByRole("progressbar").first().waitFor({ timeout: 2000 }).catch(() => {});
check(await d.getByRole("progressbar").count() === 1, "panel: one bar, under the item being copied");
check(await d.getByRole("button", { name: "Stop" }).count() === 1 && await d.getByRole("button", { name: "Close" }).getAttribute("aria-disabled") === "true", "panel: Stop is offered and Close waits");
check(await p.evaluate(() => document.activeElement?.textContent) === "Stop", "panel: focus stays on the button, now Stop");
await d.locator(".bring-result").waitFor({ timeout: 8000 }).catch(() => {});
const doneLines = await d.locator(".bring-result p").allInnerTexts().catch(() => []);
check(doneLines.map((l) => l.trim()).join(" | ") === "2 volumes and 1 image are in Colima now. | shop-db-1 is stopped in Docker Desktop.", `panel: short lines say what moved and what was stopped there (${doneLines.join(" | ")})`);
check(await d.locator(".bring-item", { hasText: "shop_db" }).innerText().then((t) => /Copied/.test(t)) && await d.locator(".bring-item", { hasText: "shop_db" }).getByRole("checkbox").count() === 0, "panel: once across, a volume reads as Copied, with a tick instead of a box");
check(await go(p).innerText() === "Done", "panel: with nothing left to pick, the button is Done");
check(await p.evaluate(() => document.activeElement?.textContent === "Done" && document.getElementById(document.activeElement.getAttribute("aria-describedby"))?.classList.contains("bring-result")), "panel: focus is on Done, which is described by the result line");
await d.getByRole("button", { name: "Start shop-db-1 in Docker Desktop" }).click();
await p.waitForTimeout(300);
check(/shop-db-1 is running again in Docker Desktop/.test(await d.locator(".bring-result").innerText()) && (await p.evaluate(() => window.__started ?? [])).join() === "shop-db-1", "panel: one click starts the stopped container again");
await go(p).click();
await p.waitForTimeout(400);
check(await d.count() === 0 && await p.locator('.setup section [data-setup="desktop_data"]').count() === 0 && /Docker Desktop volumes are in Colima/.test(await p.locator(".setup details.passing").first().textContent()), "Doctor: after a copy the row moves to the passing checks");
check(p.errors.length === 0, `running: no page errors ${p.errors.join("; ")}`);
await p.close();

p = await open("running");
await p.locator('.setup [data-setup="desktop_data"]').getByRole("button", { name: /^Bring them over/ }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
await go(p).click();
await p.getByRole("alertdialog").getByRole("button", { name: "Stop and bring over" }).click();
await panel(p).getByRole("button", { name: "Stop" }).click();
await panel(p).locator(".bring-result").waitFor({ timeout: 4000 }).catch(() => {});
check(/You stopped the rest\./.test(await panel(p).locator(".bring-result").innerText().catch(() => "")), "stop: the line says the rest was stopped");
await p.close();

p = await open("fail");
await p.locator('.setup [data-setup="desktop_data"]').getByRole("button", { name: /^Bring them over/ }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
await go(p).click();
await p.getByRole("alertdialog").getByRole("button", { name: "Stop and bring over" }).click();
await panel(p).locator(".bring-result").waitFor({ timeout: 6000 }).catch(() => {});
const up = panel(p).locator(".bring-item", { hasText: "uploads" });
check(/Colima's disk is full/.test(await up.innerText()) && (await panel(p).locator(".bring-result p").allInnerTexts()).slice(0, 2).join(" ") === "1 volume is in Colima now. uploads didn't copy.", "fail: the failed one says what to do, and the others still copied");
check(/uploads failed: Colima's disk is full/.test(await panel(p).locator('[role="alert"]').first().textContent()) || /didn't copy/.test(await panel(p).locator('[role="alert"]').first().textContent()), "fail: the failure is announced");
check(await panel(p).locator(".actions button.primary").first().innerText() === "Open Profiles" && /^Try uploads again/.test(await panel(p).locator(".actions button:not(.primary)").last().innerText()), "fail: after a full disk, Profiles is the main button and the retry says it is one");
await p.close();

p = await open("closed");
await p.locator('.setup [data-setup="desktop_data"]').getByRole("button", { name: /^Bring them over/ }).click();
await panel(p).getByText(/Docker Desktop is closed/).waitFor({ timeout: 3000 }).catch(() => {});
check(/Docker Desktop is closed/.test(await panel(p).innerText()), "closed: says Docker Desktop is closed");
await panel(p).getByRole("button", { name: "Open Docker Desktop" }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 8000 }).catch(() => {});
check(await panel(p).locator(".bring-item").count() === 5, "closed: after opening it, the list shows up on its own");
await p.close();

p = await open("gone");
await p.locator('.setup [data-setup="desktop_data"]').getByRole("button", { name: /^Bring them over/ }).click();
await panel(p).getByText(/still on this Mac/).waitFor({ timeout: 3000 }).catch(() => {});
const gone = await panel(p).innerText();
check(/still on this Mac \(about 30 GiB\)/.test(gone) && await panel(p).getByRole("button", { name: "Download Docker Desktop" }).count() === 1, "gone: says the data is still there, how big, and how to get it back");
check(p.errors.length === 0, `gone: no page errors ${p.errors.join("; ")}`);
await p.close();

await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

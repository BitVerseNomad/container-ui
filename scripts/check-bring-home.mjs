// "Bring over" from home: the empty state, the New menu, and the line under a project whose volume came up empty
// (run after: node scripts/build-preview.mjs). Needs playwright resolvable. SHOTS=dir saves r23-<state>.png.
import { createRequire } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shots = process.env.SHOTS;
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };
const BRING = "Bring over from Docker Desktop";

const browser = await chromium.launch();
async function open(query) {
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?${query}`);
  await page.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
  await page.locator(".blank, .apps li").first().waitFor({ timeout: 4000 }).catch(() => {});
  // The setup checks and the one read of Docker Desktop answer a moment after the container list.
  await page.waitForTimeout(700);
  return page;
}
// Returns the picture's md5 too, so two states that must differ can be told apart even without SHOTS.
// Every state's md5 is kept: two states that save the same picture mean one of them shows the wrong thing.
const md5s = new Map();
const keep = (state, buf) => { const h = createHash("md5").update(buf).digest("hex"); md5s.set(state, h); return h; };
const shot = async (p, state) => keep(state, await p.screenshot(shots ? { path: path.join(shots, `r23-${state}.png`) } : {}));
// One row on its own, for states that share a screen (Doctor's rows both fit in one viewport, so a page shot of each
// after scrolling to it was the same picture).
const shotOf = async (el, state) => keep(state, await el.screenshot(shots ? { path: path.join(shots, `r23-${state}.png`) } : {}));
const headClose = (p) => panel(p).locator(".drawer-head button");
const describedBy = (b) => b.evaluate((el) => (el.getAttribute("aria-describedby") ?? "").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim());
const blankButtons = (p) => p.locator(".blank .actions-inline button").evaluateAll((b) => b.map((x) => `${x.textContent}${x.classList.contains("primary") ? "*" : ""}`));
const newItems = async (p) => { await p.locator(".home-new").click(); const t = await p.getByRole("menuitem").allInnerTexts(); await p.keyboard.press("Escape"); return t.map((x) => x.trim()); };
const panel = (p) => p.getByRole("dialog", { name: BRING });
const checkedNames = (d) => d.locator(".bring-item").evaluateAll((li) => li.filter((x) => x.querySelector("input:checked")).map((x) => x.querySelector(".bring-name").textContent));
const badge = (p) => p.getByRole("button", { name: /^Doctor/ }).innerText().then((t) => t.replace(/\D/g, ""));
async function copyAndClose(p) {
  const d = panel(p);
  await d.locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
  await d.locator(".actions button").last().click();
  await p.getByRole("alertdialog").getByRole("button", { name: /and bring over$/ }).click().catch(() => {});
  await d.locator(".bring-result").waitFor({ timeout: 8000 }).catch(() => {});
  const res = await d.locator(".bring-result").innerText().catch(() => "");
  // With the result shown the footer's Done is the one way out.
  await d.locator(".actions button").last().click();
  await p.waitForTimeout(400);
  return res;
}
const status = (p) => p.locator('[data-app-announcer]').textContent();

// 1. Just switched: Colima is empty and Docker Desktop's data is still on the Mac.
let p = await open("scenario=desktop&empty=1&dd=running");
check((await blankButtons(p)).join(" | ") === `${BRING}* | Run an image | Start a Compose project`, `empty: Bring over is the one main action, the others stay as plain buttons (${(await blankButtons(p)).join(" | ")})`);
const tops = await p.locator(".blank .actions-inline button").evaluateAll((b) => b.map((x) => Math.round(x.getBoundingClientRect().top)));
check(new Set(tops).size === 1, `empty: the three buttons sit in one row (${tops.join(",")})`);
check(/^Your Docker Desktop volumes are still on this Mac\. Bring them over first, so your projects start with their data\.$/.test((await p.locator(".blank .hint").innerText()).trim()), "empty: the why-line names volumes only");
check(await p.locator(".vm-note").count() === 0 && await p.locator(".setup-strip").count() === 0, "empty: still no VM note and no setup strip on home");
await shot(p, "home-empty-offer");
check((await newItems(p)).slice(-1)[0] === `${BRING}…`, "empty: New ends with Bring over from Docker Desktop…");
await p.getByRole("button", { name: BRING }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
check(await panel(p).count() === 1 && (await checkedNames(panel(p))).join(",") === "shop_db,uploads", "empty: the button opens the shared panel with the default picks");
const res = await copyAndClose(p);
check(/are in Colima now/.test(res), "empty: the copy runs from home");
check(await p.evaluate(() => document.activeElement?.textContent) === "Run an image", "after: focus lands on the empty state's main button");
check((await blankButtons(p)).join(" | ") === "Run an image* | Start a Compose project" && !(await newItems(p)).some((t) => /Docker Desktop/.test(t)), "after: nothing is left to bring, so the offer and the menu item are gone");
check(await status(p) === "Volumes are in Colima now.", `after: the app says it once (${await status(p)})`);
await shot(p, "home-after");
check(p.errors.length === 0, `empty: no page errors ${p.errors.join("; ")}`);
await p.close();

// 2. Only part of it came over: the rest is still offered.
p = await open("scenario=desktop&empty=1&dd=running");
await p.getByRole("button", { name: BRING }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
await panel(p).locator(".bring-item", { hasText: "uploads" }).getByRole("checkbox").uncheck();
await copyAndClose(p);
check((await blankButtons(p))[0] === `${BRING}*`, "partial: uploads is still missing, so home keeps offering it");
await p.getByRole("button", { name: /^Doctor/ }).click();
await p.waitForTimeout(300);
check(await p.locator('.setup [data-setup="desktop_data"]').first().evaluate((li) => !li.classList.contains("ok")).catch(() => false), "partial: Doctor's row still offers it too");
await p.close();

// A flag left from an earlier run doesn't hide what is still missing while Docker Desktop can be asked.
p = await open("scenario=desktop&empty=1&brought=1&dd=running");
check((await blankButtons(p))[0] === `${BRING}*`, "flag: what is missing wins over an old 'brought over' flag");
await p.close();
// With Docker Desktop closed it can't be asked; the flag from the last run decides.
p = await open("scenario=desktop&empty=1&brought=1&dd=closed");
check((await blankButtons(p)).join(" | ") === "Run an image* | Start a Compose project", "flag: with Docker Desktop closed, the last run's answer stands");
await p.close();

// No Docker Desktop on this Mac: the empty state is as before, and so is New.
p = await open("scenario=running&empty=1");
check((await blankButtons(p)).join(" | ") === "Run an image* | Start a Compose project" && !(await newItems(p)).some((t) => /Docker Desktop/.test(t)), "no Docker Desktop: the empty state and New are unchanged");
await p.close();

// Docker Desktop data, no empty volume under a home row: nothing new among the rows.
p = await open("scenario=desktop&dd=running");
check(await p.locator(".apps li").count() > 0 && await p.locator(".apps .problem", { hasText: "Docker Desktop" }).count() === 0, "busy home: no Docker Desktop line among the rows");
check(await p.locator(".vm-note").count() === 0 && await p.locator(".setup-strip").count() === 0, "busy home: no VM note and no setup strip");
await p.close();

// 3. The first morning: `compose up` ran in Colima first, so shop's pg service runs on a 12 MB shop_db.
p = await open("scenario=desktop&dd=morning");
const shop = p.locator(".apps > li", { has: p.locator(".app-name", { hasText: /^shop$/ }) }).first();
const shopCount = () => shop.locator(".app-row").innerText().then((t) => (t.match(/\d+ of \d+ running/) ?? [""])[0]);
const lines = await p.locator(".apps .problem", { hasText: "nearly empty" }).allInnerTexts();
check(lines.length === 1 && /shop_db is nearly empty here; Docker Desktop has 392\.9 MiB\./.test(lines[0]), `morning: one line says it (${lines.join(" / ")})`);
check(await shop.locator(".problem").first().innerText().then((t) => /nearly empty/.test(t)), "morning: the line sits under the shop row, first among its problem lines");
check(await shop.locator(".problem", { hasText: "nearly empty" }).locator("code").first().innerText().catch(() => "") === "shop_db", "morning: the volume name is in the code font");
const gapButton = p.getByRole("button", { name: "Bring it over: shop_db from Docker Desktop" });
check(await gapButton.count() === 1 && (await gapButton.innerText()).trim() === "Bring it over…", "morning: one volume, so the button says Bring it over…, and its name starts with those words");
check(/, 4 problems$/.test(await shop.locator(".app-name").getAttribute("aria-label")), `morning: the row's problem count includes the line (${await shop.locator(".app-name").getAttribute("aria-label")})`);
check(await badge(p) === "7", `morning: Doctor's badge counts it (${await badge(p)})`);
check(await p.locator(".vm-note").count() === 0 && await p.locator(".setup-strip").count() === 0, "morning: no VM note and no setup strip");
const before = await shopCount();
await shot(p, "home-morning");
const calls = await p.evaluate(() => window.__calls.filter((c) => c === "desktop_state").length);
await p.waitForTimeout(3500);
check(await p.evaluate(() => window.__calls.filter((c) => c === "desktop_state").length) === calls, "morning: Docker Desktop is read once, not on every poll");
await gapButton.click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
check((await checkedNames(panel(p))).join(",") === "shop_db", "morning: the panel opens with only that volume picked");
await shot(p, "home-morning-panel");
await copyAndClose(p);
// The replace stops shop-db-1 and starts it again; the list is read when the copy ends, not at the next poll.
check(await shopCount() === before, `morning: right after the replace shop counts the same as before (${before} then ${await shopCount()})`);
check(await p.locator(".apps .problem", { hasText: "nearly empty" }).count() === 0, "morning: after the replace the line is gone");
check(await p.evaluate(() => document.activeElement?.classList.contains("app-name") && document.activeElement.textContent === "shop"), "morning: with its line gone, focus lands on the shop row's name, not the page");
await shot(p, "home-morning-after");
check((await newItems(p)).slice(-1)[0] === `${BRING}…`, "morning: uploads is still missing, so New still offers it");
check(await badge(p) === "6", `morning: the badge drops by one (${await badge(p)})`);
await p.getByRole("button", { name: /^Doctor/ }).click();
await p.waitForTimeout(300);
check(await p.locator('.setup [data-setup="desktop_data"]').first().evaluate((li) => li.classList.contains("info")).catch(() => false), "morning: Doctor's row is a note again once nothing is nearly empty");
check(p.errors.length === 0, `morning: no page errors ${p.errors.join("; ")}`);
await p.close();

// Doctor's row as a warning: same words as home, and it picks only the volume it names.
p = await open("scenario=desktop&dd=morning");
await p.getByRole("button", { name: /^Doctor/ }).click();
await p.waitForTimeout(300);
const warnRow = p.locator('.setup [data-setup="desktop_data"]').first();
check(await warnRow.evaluate((li) => li.classList.contains("warn")).catch(() => false) && await warnRow.locator("b code").innerText().catch(() => "") === "shop_db" && /^shop_db is nearly empty in Colima$/.test(await warnRow.locator("b").innerText()), "Doctor: the row is a warning, with shop_db in the code font in its title");
check((await warnRow.locator(".hint").first().innerText()).trim() === "11.4 MiB here; Docker Desktop has 392.9 MiB. Colima's copy is backed up first.", `Doctor: the warning says the two sizes and the backup (${await warnRow.locator(".hint").first().innerText()})`);
check((await warnRow.locator(".finding-actions button").innerText()).trim() === "Bring it over…", "Doctor: one volume, so its button says Bring it over…");
const oom = p.locator(".setup li", { hasText: "report-job ran out of memory" }).first();
check(await oom.locator(".finding-actions button:not(.more)").count() === 1 && /Other numbers\? Change in Profiles/.test(await oom.locator("div").first().innerText()), "Doctor: the out-of-memory row has one button; Change in Profiles is in its text");
await shotOf(warnRow, "doctor-warn");
await shotOf(oom, "doctor-oom");
await warnRow.getByRole("button", { name: /^Bring it over/ }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
check((await checkedNames(panel(p))).join(",") === "shop_db", "Doctor: the panel opens with only that volume picked, like home");
await copyAndClose(p);
check(await p.evaluate(() => document.activeElement?.textContent) === "Run checks again", `Doctor: with its opener gone, focus lands on Run checks again (${await p.evaluate(() => document.activeElement?.textContent)})`);
await p.close();

// The volume filled up after home looked: the panel re-checks, doesn't pick it, and home follows at once.
p = await open("scenario=desktop&dd=morning&grow=1");
check(await badge(p) === "7", "stale: before the panel, the badge counts the line");
await p.getByRole("button", { name: "Bring it over: shop_db from Docker Desktop" }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
await p.waitForTimeout(300);
check((await checkedNames(panel(p))).length === 0, `stale: a volume over 64 MiB now is not picked (${(await checkedNames(panel(p))).join(",")})`);
check(/Colima's shop_db grew to 300\.4 MiB since we checked, so it isn't replaced\./.test(await panel(p).locator(".bring-item", { hasText: "shop_db" }).innerText()), "stale: its row says it grew and isn't replaced");
const foot = panel(p).locator(".actions button").last();
check(await foot.innerText() === "Done" && await foot.evaluate((b) => b.classList.contains("primary") && b.getAttribute("aria-disabled") !== "true"), "stale: the footer's main button is Done, not a disabled Bring over");
check(await p.locator(".apps .problem", { hasText: "nearly empty" }).count() === 0, "stale: home's line is gone while the panel is still open");
check(await badge(p) === "6", `stale: the badge drops while the panel is still open (${await badge(p)})`);
check(/^Colima's shop_db grew to 300\.4 MiB since we checked, so it isn't replaced\.$/.test(await describedBy(foot)), `stale: Done is described by the stale note (${await describedBy(foot)})`);
check(await headClose(p).count() === 0, "stale: with Done in the footer the header Close is gone, one way out");
const staleMd5 = await shot(p, "stale-panel");
await p.keyboard.press("Escape");
await p.waitForTimeout(300);
check(await panel(p).count() === 0, "stale: Escape still closes the panel");
check(p.errors.length === 0, `stale: no page errors ${p.errors.join("; ")}`);
await p.close();

// It grew after the list but before the confirm: the sizes are read again first, so nothing is asked or replaced.
p = await open("scenario=desktop&dd=morning&grow=2");
await p.getByRole("button", { name: "Bring it over: shop_db from Docker Desktop" }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
check((await checkedNames(panel(p))).join(",") === "shop_db", "late: the list still shows it nearly empty, so it is picked");
check(await headClose(p).count() === 1, "late: while a pick waits the header Close is there");
const titleY = () => panel(p).locator(".drawer-head h3").evaluate((h) => h.getBoundingClientRect().y);
const yWithClose = await titleY();
const lateFoot = panel(p).locator(".actions button").last();
await lateFoot.click();
await panel(p).locator(".bring-late").waitFor({ timeout: 3000 }).catch(() => {});
await p.waitForTimeout(200);
const LATE = "Nothing was replaced. Colima's shop_db grew to 300.4 MiB while you were picking.";
check(await p.getByRole("alertdialog").count() === 0, "late: no confirm asks to replace a copy that grew");
check((await panel(p).locator(".bring-late").innerText().catch(() => "")).trim() === LATE, `late: the footer says nothing was replaced and why (${await panel(p).locator(".bring-late").innerText().catch(() => "none")})`);
check(await lateFoot.innerText() === "Done" && await lateFoot.evaluate((b) => b.classList.contains("primary")) && await describedBy(lateFoot) === LATE, "late: Done is the primary and is described by that line");
check(await lateFoot.evaluate((b) => document.activeElement === b), "late: focus is on Done");
check((await panel(p).locator('[role="alert"]').first().textContent()) === LATE, "late: the alert reads the same line once");
check(await headClose(p).count() === 0, "late: the header Close is gone; Done is the one way out");
check(Math.abs((await titleY()) - yWithClose) < 0.5, `late: the title stays where it was when Close goes (${yWithClose} then ${await titleY()})`);
check(!/since we checked/.test(await panel(p).locator(".bring-item", { hasText: "shop_db" }).innerText()), "late: the row drops its own note; the footer answers the click");
check(await p.evaluate(() => (window.__replaced ?? []).length) === 0, "late: nothing was replaced");
const lateMd5 = await shot(p, "late-panel");
check(lateMd5 !== staleMd5, `late: its picture differs from the stale one (${lateMd5} vs ${staleMd5})`);
await p.close();

// One pick grew and another still needs a confirm (files-1 writes to uploads): the grown one is the confirm's first
// body line, not an alert the dialog would cut short.
p = await open("scenario=desktop&dd=morning&grow=2&upl=1");
await p.locator(".home-new").click();
await p.getByRole("menuitem", { name: `${BRING}…` }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
await panel(p).locator(".bring-item", { hasText: "uploads" }).getByRole("checkbox").check().catch(() => {});
const picks2 = (await checkedNames(panel(p))).join(",");
await panel(p).locator(".actions button").last().click();
const ask = p.getByRole("alertdialog");
await ask.waitFor({ timeout: 3000 }).catch(() => {});
const askTitle = (await ask.locator("#confirm-title").innerText().catch(() => "")).trim();
const askBody = (await ask.locator("#confirm-body p, #confirm-body li").allInnerTexts().catch(() => [])).map((t) => t.trim());
const notice = ask.locator("#confirm-body p.confirm-notice");
check(/shop_db/.test(picks2) && askTitle === "Bring uploads over?", `both: the confirm names what comes over (${picks2} | ${askTitle || "no confirm"})`);
check(askBody[0] === "files-1 in Docker Desktop is stopped first, so the copy is clean. You can start it again from here after.", `both: the body says who stops first (${askBody[0]})`);
check(askBody[askBody.length - 1] === "shop_db isn't replaced: Colima's copy grew to 300.4 MiB since we checked." && await notice.count() === 1 && await notice.locator("svg").count() === 1, `both: the grown one is last, as a notice with a warning mark (${askBody[askBody.length - 1]})`);
check(await ask.getByRole("button", { name: "Stop and bring over" }).count() === 1, "both: the button stays Stop and bring over");
check(((await panel(p).locator('[role="alert"]').first().textContent()) ?? "") === "", "both: no alert is said under the confirm");
await shot(p, "both-confirm");
await ask.getByRole("button", { name: "Cancel" }).click().catch(() => {});
check(p.errors.length === 0, `both: no page errors ${p.errors.join("; ")}`);
await p.close();

// Nothing left to confirm but something still to copy (uploads has no user): the alert says the grown one.
p = await open("scenario=desktop&dd=morning&grow=2");
await p.locator(".home-new").click();
await p.getByRole("menuitem", { name: `${BRING}…` }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
await panel(p).locator(".bring-item", { hasText: "uploads" }).getByRole("checkbox").check().catch(() => {});
await p.evaluate(() => { window.__alerts = []; const el = document.querySelector('.drawer [role="alert"]'); new MutationObserver(() => window.__alerts.push(el.textContent)).observe(el, { childList: true, characterData: true, subtree: true }); });
await panel(p).locator(".actions button").last().click();
await p.waitForTimeout(600);
const heard = await p.evaluate(() => window.__alerts);
check(await p.getByRole("alertdialog").count() === 0 && heard.includes("Colima's shop_db grew to 300.4 MiB since we checked, so it isn't replaced.") && heard[heard.length - 1] !== "", `alone: with no confirm the alert says it, and the copy starting doesn't wipe it (${JSON.stringify(heard)})`);
await p.close();

// Colima's shop_db is a folder on the Mac (a bind volume): never offered, never picked, and the row says why.
p = await open("scenario=desktop&dd=morning&bind=1");
check(await p.locator(".apps .problem", { hasText: "nearly empty" }).count() === 0, "bind: home shows no line for a folder on the Mac");
await p.locator(".home-new").click();
await p.getByRole("menuitem", { name: `${BRING}…` }).click();
await panel(p).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
const bindRow = panel(p).locator(".bring-item", { hasText: "shop_db" });
check(await bindRow.getByRole("checkbox").count() === 0 && /Colima's shop_db is a folder on your Mac \(~\/code\/shop\/data\), so it isn't replaced\. Docker Desktop's 392\.9 MiB stays there\./.test(await bindRow.innerText()), `bind: its row can't be picked, names the folder and says Docker Desktop's copy stays (${(await bindRow.innerText()).replace(/\n/g, " | ")})`);
await shot(p, "bind-panel");
check(p.errors.length === 0, `bind: no page errors ${p.errors.join("; ")}`);
await p.close();

// Docker Desktop opened after the app: the next window focus, 10 minutes on, looks again.
{
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  await page.clock.install();
  await page.goto(`file://${root}/preview/index.html?scenario=desktop&dd=morning&later=1`);
  await page.locator(".apps li").first().waitFor({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(700);
  check(await page.locator(".apps .problem", { hasText: "nearly empty" }).count() === 0, "later: with Docker Desktop closed there is no line");
  await page.evaluate(() => window.__mock.openDesktop());
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.waitForTimeout(500);
  check(await page.locator(".apps .problem", { hasText: "nearly empty" }).count() === 0, "later: a focus right away doesn't read again");
  await page.clock.fastForward("11:00");
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.locator(".apps .problem", { hasText: "nearly empty" }).waitFor({ timeout: 3000 }).catch(() => {});
  check(await page.locator(".apps .problem", { hasText: "nearly empty" }).count() === 1, "later: a focus 11 minutes on reads again and the line shows");
  await page.close();
}

const byMd5 = new Map();
for (const [state, h] of md5s) byMd5.set(h, [...(byMd5.get(h) ?? []), state]);
const same = [...byMd5.values()].filter((states) => states.length > 1);
check(same.length === 0, `shots: every state's picture is different (${md5s.size} pictures${same.length ? `; same: ${same.map((x) => x.join(" = ")).join("; ")}` : ""})`);
await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

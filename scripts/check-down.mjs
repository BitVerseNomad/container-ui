// Home says what is down: under a partly running project, what is only stopped (no problem line of its own) shares
// one plain line, last, so every container "N of M running" is short of is on a line (run after:
// node scripts/build-preview.mjs). Needs playwright resolvable. SHOTS=dir saves r34-<state>.png; every picture must differ.
import { createRequire } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shots = process.env.SHOTS;
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };
const md5s = new Map();
const shot = async (el, state) => md5s.set(state, createHash("md5").update(await el.screenshot(shots ? { path: path.join(shots, `r34-${state}.png`) } : {})).digest("hex"));

const browser = await chromium.launch();
async function open(query) {
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?${query}`);
  await page.locator(".apps li").first().waitFor({ timeout: 4000 }).catch(() => {});
  // The Doctor's inspect decides what is finished and what is down; it answers a moment after the list.
  await page.waitForTimeout(1200);
  return page;
}
const shop = (p) => p.locator("ul.apps > li.app").filter({ has: p.locator(".app-name", { hasText: /^shop$/ }) });
const lines = (p) => shop(p).locator(":scope > .problem").allInnerTexts().then((l) => l.map((t) => t.replace(/\s+/g, " ").trim()));
const label = (p) => shop(p).locator(".app-name").getAttribute("aria-label");

// 1. Default: shop is 5 of 7. report-job ran out of memory (its own line); cache is simply stopped.
// The desktop scenario: the same 2 GiB VM as check-resize, so report-job's line offers the same button there and here.
let p = await open("scenario=desktop");
const l1 = await lines(p);
check(/5 of 7 running/.test(await shop(p).locator(".app-state").innerText()), "one: shop reads 5 of 7 running");
check(l1[l1.length - 1] === "cache is stopped Start", `one: the last line says cache is stopped, with Start (${l1.join(" | ")})`);
check(l1.filter((t) => /report-job/.test(t)).length === 1 && !l1.slice(0, -1).some((t) => /is stopped|are stopped/.test(t)), "one: report-job keeps its own problem line, before the plain one");
check(/, 3 problems, 1 stopped$/.test(await label(p)), `one: the row's name counts the stopped one apart from the problems (${await label(p)})`);
check(await shop(p).getByRole("button", { name: /^Give the VM 8 GiB…: .*report-job/ }).count() === 1, "one: report-job's line offers Give the VM 8 GiB…, as on the Doctor's screen");
check(await shop(p).getByRole("button", { name: "Start cache" }).count() === 1, "one: the button says what it starts");
await shot(shop(p), "down-one");
await shop(p).getByRole("button", { name: "Start cache" }).click();
// Focus goes to the body when the button's line goes; the row's name takes it.
await p.evaluate(() => document.activeElement?.blur());
await p.waitForTimeout(3500);
const after = await lines(p);
const stateAfter = await shop(p).locator(".app-state").innerText();
check(!after.some((t) => /is stopped|are stopped/.test(t)) && /6 of 7 running/.test(stateAfter), `one: Start starts cache, and the line goes (${stateAfter}: ${after.join(" | ")})`);
check(/cache started/.test(await p.locator(".sr-only[role=status]").first().innerText()) && !/shop started/.test(await p.locator(".sr-only[role=status]").first().innerText()), `one: the done line names what started (${await p.locator(".sr-only[role=status]").first().innerText()})`);
check(await p.evaluate(() => document.activeElement?.classList.contains("app-name") && document.activeElement.textContent === "shop"), `one: focus is on shop's name once the line goes (${await p.evaluate(() => document.activeElement?.className)})`);
check(JSON.stringify((await p.evaluate(() => window.__dockerStarted ?? [])).pop()) === JSON.stringify([await p.evaluate(() => window.__mock.state().ctrs.find((c) => c.name === "cache").id.slice(0, 12))]), "one: it starts exactly cache, by ID");
await shot(shop(p), "down-started");
check(p.errors.length === 0, `one: no page errors ${p.errors.join("; ")}`);
await p.close();

// 2. Two simply down: one shared line, "Start them".
p = await open("scenario=desktop&down2=1");
const l2 = await lines(p);
check(/4 of 7 running/.test(await shop(p).locator(".app-state").innerText()), "two: shop reads 4 of 7 running");
check(l2[l2.length - 1] === "cache and db are stopped Start them", `two: one line names both, with Start them (${l2.join(" | ")})`);
check(await shop(p).getByRole("button", { name: "Start them: cache and db", exact: true }).count() === 1, "two: its label starts with the words on the button, then names both");
check(/, 3 problems, 2 stopped$/.test(await label(p)), `two: the row's name says 2 stopped (${await label(p)})`);
await shot(shop(p), "down-two");
await shop(p).getByRole("button", { name: "Start them: cache and db", exact: true }).click();
await p.waitForFunction(() => /cache and db started/.test(document.querySelector(".sr-only[role=status]")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
check(/^cache and db started$/.test((await p.locator(".sr-only[role=status]").first().innerText()).trim()), `two: done says "cache and db started" (${await p.locator(".sr-only[role=status]").first().innerText()})`);
await p.close();

// 2b. The menu's "Start the 2 stopped (…)" says the same names when done.
p = await open("scenario=desktop&down2=1");
await p.getByRole("button", { name: "More actions for shop", exact: true }).click();
const item = p.getByRole("menuitem", { name: /^Start the \d+ stopped/ });
const named = ((await item.innerText()).match(/\((.*)\)/)?.[1] ?? "").split(", ");
await item.click();
await p.waitForFunction(() => /started/.test(document.querySelector(".sr-only[role=status]")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
const menuSaid = (await p.locator(".sr-only[role=status]").first().innerText()).trim();
const expect = `${named.length > 1 ? `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}` : named[0]} started`;
check(menuSaid === expect && !/shop/.test(menuSaid), `menu: done names what the item started, not "shop started" (${menuSaid}; expected ${expect})`);
await p.close();

// 3. Everything stopped: the row says Stopped and its main button is Start, so there is no extra line.
p = await open("scenario=desktop");
await p.getByRole("button", { name: "Stop shop", exact: true }).click();
await p.waitForTimeout(3500);
check(/^Stopped$/.test((await shop(p).locator(".app-state").innerText()).trim()) && !(await lines(p)).some((t) => /is stopped|are stopped/.test(t)), "all: a project that is all stopped gets no extra line");
await p.close();

const byMd5 = new Map();
for (const [name, h] of md5s) byMd5.set(h, [...(byMd5.get(h) ?? []), name]);
const same = [...byMd5.values()].filter((n) => n.length > 1);
check(same.length === 0, `shots: every state's picture is different (${md5s.size} pictures${same.length ? `; same: ${same.map((x) => x.join(" = ")).join("; ")}` : ""})`);

await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

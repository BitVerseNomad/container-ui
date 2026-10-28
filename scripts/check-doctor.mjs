// Doctor page checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shots = process.env.SHOTS;
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 980, height: 720 } });
p.errors = [];
p.on("pageerror", (e) => p.errors.push(e.message));
await p.goto(`file://${root}/preview/index.html?scenario=doctor`);
await p.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
// The Containers list: no panel on top; each broken row has one always-visible button in its Fix column
await p.waitForSelector("td.row-fix button", { timeout: 4000 }).catch(() => {});
check(await p.locator(".doctor-panel").count() === 0, "rows: nothing about problems sits above the table");
const rowOf = (name) => p.locator("table.list tbody tr").filter({ has: p.locator(`button[aria-label^="${name},"]`) });
const btn = async (name) => (await rowOf(name).locator("td.row-fix button").allInnerTexts()).join("|");
check(await btn("orders") === "Fix…", `rows: the localhost problem offers Fix… (${await btn("orders")})`);
check(await btn("billing") === "Connect…", `rows: the name problem offers Connect… (${await btn("billing")})`);
check(await btn("pg") === "Logs", `rows: a crash with no one-click fix offers Logs (${await btn("pg")})`);
check(await btn("db") === "", "rows: a healthy row has no button");
const widths = await p.locator("table.list thead th").evaluateAll((l) => l.map((e) => Math.round(e.getBoundingClientRect().width)));
check(widths[6] >= 80 && widths[7] >= 130, `rows: at 980 wide the Fix and tools columns keep their room (${widths.join(",")})`);
check(await rowOf("orders").locator("td.row-actions .row-tools").evaluate((e) => e.scrollWidth <= e.parentElement.clientWidth + 1), "rows: the row tools are not clipped");
check(await rowOf("orders").locator("td.row-fix button").evaluate((b) => getComputedStyle(b).opacity) === "1", "rows: the Fix button shows without hovering");
await rowOf("orders").locator("td.row-fix button").click();
check(/orders/.test(await p.getByRole("alertdialog").innerText().catch(() => "")), "rows: Fix… asks before changing anything");
await p.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
// The fix itself, from the row: Fixing… then Fixed in the same row, with Done to clear it
await rowOf("orders").locator("td.row-fix button").click();
await p.getByRole("alertdialog").getByRole("button", { name: "Fix" }).click();
// While it runs, the sidebar's profile menu can't stop the VM under it.
await p.getByRole("button", { name: /Switch profile/ }).click();
const sideStop = p.getByRole("menuitem", { name: /^Stop / }).or(p.getByRole("button", { name: /^Stop default$/ }));
check(await sideStop.first().isDisabled().catch(() => false), "rows: during a Fix the sidebar's Stop is disabled");
await p.keyboard.press("Escape");
await p.waitForFunction(() => [...document.querySelectorAll("table.list tbody tr")].some((tr) => /orders/.test(tr.textContent) && /Fixed\./.test(tr.textContent)), null, { timeout: 30000 }).catch(() => {});
check(/Fixed\./.test(await rowOf("orders").innerText().catch(() => "")) && await btn("orders") === "Done", `rows: after the fix the row says Fixed, with Done (${await btn("orders")})`);
await rowOf("orders").locator("td.row-fix button").click();
check(await btn("orders") === "", "rows: Done puts the row back to normal");
await rowOf("pg").locator("td.row-fix button").click();
await p.waitForTimeout(300);
check(/pg/.test(await p.locator(".content h2, .content h1").first().innerText().catch(() => "")), "rows: Logs opens the container page");
if (shots) await p.screenshot({ path: `${shots}/doctor-rows.png` });

await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(400);
const text = () => p.locator(".doctor").innerText();
const item = (title) => p.locator(".doctor .finding").filter({ hasText: title });
if (shots) await p.screenshot({ path: `${shots}/doctor-1.png`, fullPage: true });

// Groups and counts
const action = p.locator('section[aria-label="Needs action"] > ul > li');
const n = await action.count();
check(n > 0, `the page lists ${n} things that need action`);
check(new RegExp(`^${n} things? needs? action`).test(await p.locator(".doctor-head .hint").innerText()), "the summary counts the same items");
check(await p.locator(".nav-badge").innerText().catch(() => "") === String(n), "the sidebar badge counts the same items");
check(await p.locator('section[aria-label="Worth knowing"]').count() === 1, "there is a Worth knowing group");
check(await p.locator(".doctor details.passing").first().evaluate((d) => !d.open), "passed checks start folded");

// One of each new check, with the evidence in the text
const t = await text();
check(/orders looks for db at localhost/.test(t) && /DATABASE_URL is mysql:\/\/root@localhost:3306\/orders/.test(t), "localhost: names the setting and the container it meant");
check(/billing can't find sessions by name/.test(t) && /default network/.test(t), "names: explains the default network has no name lookup");
check(/pg stopped, probably because it has no POSTGRES_PASSWORD/.test(t), "postgres: names the missing setting, as a likely cause");
check(/orders runs an amd64 image on your arm64 VM/.test(t), "CPU: the amd64 image is worth knowing, not an alarm");
check(/pg keeps its data inside the container/.test(t), "storage: the database without a volume is worth knowing");

// Connect fix: asks first, then adds both to a new network and the problem goes away
await item("billing can't find sessions").getByRole("button", { name: "Connect", exact: true }).click();
check(/Create the network sessions-net and connect billing and sessions\?/.test(await p.getByRole("alertdialog").innerText().catch(() => "")), "Connect asks before changing anything");
await p.getByRole("alertdialog").getByRole("button", { name: "Connect", exact: true }).click();
await p.waitForFunction(() => /Connected\. billing and sessions are on sessions-net/.test(document.querySelector(".doctor")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
check(/Connected\. billing and sessions are on sessions-net/.test(await text()), "Connect reports what it did, at the top of the page");
const nets = await p.evaluate(() => window.__mock.state().ctrs.filter((c) => ["billing", "sessions"].includes(c.name)).map((c) => c.networks.join(",")));
check(nets.every((x) => x === "bridge,sessions-net"), `both joined sessions-net and kept bridge (${nets.join(" / ")})`);
await p.getByRole("button", { name: "Run checks again" }).click();
await p.waitForTimeout(900);
check(!/billing can't find sessions/.test(await text()), "after the next check the name problem is gone");

// Not an issue: hides it here and in the badge, and can be undone
const before = await action.count();
await item("pg stopped, probably").getByRole("button", { name: "Not an issue" }).click();
await p.waitForTimeout(200);
check(await action.count() === before - 1, "Not an issue takes it out of Needs action");
check(await p.locator(".nav-badge").innerText().catch(() => "0") === String(before - 1), "and out of the badge");
await p.getByText(/1 marked not an issue/).click();
await p.getByRole("button", { name: "Show it again" }).click();
await p.waitForTimeout(200);
check(await action.count() === before, "Show it again brings it back");

// Open a container from a finding
await item("pg stopped, probably").getByRole("button", { name: "Open pg" }).click();
await p.waitForTimeout(500);
check(/pg/.test(await p.locator(".content h2, .content h1").first().innerText().catch(() => "")), "Open pg goes to its container page");
check(/pg stopped, probably because it has no POSTGRES_PASSWORD/.test(await p.locator(".content").innerText()), "the container page shows the same finding");

// Test a connection opens the network tester
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.getByRole("button", { name: "Test a connection…" }).click();
check(await p.locator(".drawer, [role=dialog]").count() > 0, "Test a connection opens the tester");

const noH = await p.evaluate(() => { const c = document.querySelector(".content"); return c.scrollWidth <= c.clientWidth + 1; });
check(noH, "no horizontal scroll at 980 wide");
check(p.errors.length === 0, `no page errors ${p.errors.join("; ")}`);
await browser.close();
process.exit(failed ? 1 : 0);

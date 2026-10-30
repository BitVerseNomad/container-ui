// Doctor page checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shots = process.env.SHOTS;
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
let p = await browser.newPage({ viewport: { width: 980, height: 720 } });
p.errors = [];
p.on("pageerror", (e) => p.errors.push(e.message));
await p.goto(`file://${root}/preview/index.html?scenario=doctor`);
await p.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
await p.waitForSelector("ul.apps > li.app", { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(900);
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(400);
const text = () => p.locator(".doctor").innerText();
const item = (title) => p.locator(".doctor .finding").filter({ hasText: title });
if (shots) await p.screenshot({ path: `${shots}/doctor-1.png`, fullPage: true });

// Groups and counts. Container problems are shown under their rows on home and listed here uncounted, under their own
// heading; the badge and the summary count the same thing (setup problems and findings that are not about one container).
const onHome = p.locator('section[aria-label="On the Containers screen"] > ul > li');
const n = await onHome.count();
check(n >= 8 && await p.locator('section[aria-label="On the Containers screen"] h3').innerText() === "On the Containers screen", `the page lists ${n} container problems under "On the Containers screen"`);
const counted = async () => { const m = /^(\d+) problems? needs? action/.exec(await p.locator(".doctor-head .hint").innerText()); return m ? Number(m[1]) : 0; };
const badge = async () => { const l = await p.locator('.sidebar nav button[aria-label^="Doctor"]').getAttribute("aria-label"); const m = /^Doctor, (\d+) problems?$/.exec(l ?? ""); return m ? Number(m[1]) : 0; };
check(await badge() === await counted(), `the sidebar badge and the page summary count the same (${await badge()} and ${await counted()})`);
check(await counted() === 0 && await p.locator('section[aria-label="Needs action"]').count() === 0 && /Nothing needs action here\. 8 container problems are on the Containers screen/.test(await p.locator(".doctor-head .hint").innerText()), "container problems are not counted: nothing else needs action, and the summary says where they are");
check(await p.locator('section[aria-label="Needs action"] .finding', { hasText: /orders|billing|kafka|pg|api|worker|report-job/ }).count() === 0, "no container problem is listed under Needs action");
check(await p.locator('section[aria-label="Worth knowing"]').count() === 1, "there is a Worth knowing group");
check(await p.locator(".doctor details.passing").first().evaluate((d) => !d.open), "passed checks start folded");

// Kafka and Kafka UI are fixed together, so the page offers that fix once, on Kafka UI, and Kafka says so.
check(await p.locator(".doctor button", { hasText: /^Fix kafka and kafka-ui/ }).count() === 1, "one Kafka fix on the page, not one per container");
check(/Fixed together with kafka-ui\./.test(await item("Other containers can't use this Kafka").innerText()), "the Kafka row points to the shared fix");
check(await item("Other containers can't use this Kafka").locator(".finding-actions button.small").count() === 0, "the Kafka row has no button of its own");

// One of each new check, with the evidence in the text
const t = await text();
check(/orders looks for db at localhost/.test(t) && /DATABASE_URL is mysql:\/\/root@localhost:3306\/orders/.test(t), "localhost: names the setting and the container it meant");
check(/billing can't find sessions by name/.test(t) && /default network/.test(t), "names: explains the default network has no name lookup");
check(/pg stopped, probably because it has no POSTGRES_PASSWORD/.test(t), "postgres: names the missing setting, as a likely cause");
check(/orders runs an amd64 image on your arm64 VM/.test(t), "CPU: the amd64 image is worth knowing, not an alarm");
check(/pg keeps its data inside the container/.test(t), "storage: the database without a volume is worth knowing");

// Connect fix: asks first, then adds both to a new network and the problem goes away
await item("billing can't find sessions").getByRole("button", { name: /^Connect…: / }).click();
check(/Create the network sessions-net and connect billing and sessions\?/.test(await p.getByRole("alertdialog").innerText().catch(() => "")), "Connect asks before changing anything");
await p.getByRole("alertdialog").getByRole("button", { name: "Connect", exact: true }).click();
await p.waitForFunction(() => /Connected\. billing and sessions are on sessions-net/.test(document.querySelector(".doctor")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
check(/Connected\. billing and sessions are on sessions-net/.test(await text()), "Connect reports what it did, at the top of the page");
const nets = await p.evaluate(() => window.__mock.state().ctrs.filter((c) => ["billing", "sessions"].includes(c.name)).map((c) => c.networks.join(",")));
check(nets.every((x) => x === "bridge,sessions-net"), `both joined sessions-net and kept bridge (${nets.join(" / ")})`);
await p.getByRole("button", { name: "Run checks again" }).click();
await p.waitForTimeout(900);
check(!/billing can't find sessions/.test(await text()), "after the next check the name problem is gone");

// Not an issue: hides it here and on the home screen, never changes the count, and can be undone
const before = await onHome.count();
await p.getByRole("button", { name: "More actions for pg stopped, probably because it has no POSTGRES_PASSWORD" }).click();
await p.getByRole("menuitem", { name: "Not an issue" }).click();
await p.waitForTimeout(200);
check(await onHome.count() === before - 1 && new RegExp(`${before - 1} container problems are on the Containers`).test(await p.locator(".doctor-head .hint").innerText()), "Not an issue takes it out of the Containers screen group and its count");
check(await badge() === await counted() && await badge() === 0, "and the badge and summary still agree");
await p.getByText(/1 marked not an issue/).click();
await p.getByRole("button", { name: "Show it again" }).click();
await p.waitForTimeout(200);
check(await onHome.count() === before, "Show it again brings it back");

// Open a container from a finding
await item("pg stopped, probably").getByRole("button", { name: "Open pg" }).click();
await p.waitForTimeout(500);
check(/pg/.test(await p.locator(".content h2, .content h1").first().innerText().catch(() => "")), "Open pg goes to its container page");
check(/pg stopped, probably because it has no POSTGRES_PASSWORD/.test(await p.locator(".content").innerText()), "the container page shows the same finding");

// Test a connection opens the network tester
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.getByRole("button", { name: "More Doctor actions" }).click();
await p.getByRole("menuitem", { name: "Test a connection…" }).click();
check(await p.locator(".drawer, [role=dialog]").count() > 0, "Test a connection opens the tester");

check(p.errors.length === 0, `no page errors on the Doctor page ${p.errors.join("; ")}`);
// The rows, on a fresh page, because the fix below really changes orders
await p.close();
p = await browser.newPage({ viewport: { width: 980, height: 720 } });
p.errors = [];
p.on("pageerror", (e) => p.errors.push(e.message));
await p.goto(`file://${root}/preview/index.html?scenario=doctor`);
// The Containers home: no panel on top; each app with a problem has one line under its row with one button
const home = "ul.apps > li.app";
await p.waitForSelector(`${home} .problem button`, { timeout: 4000 }).catch(() => {});
check(await p.locator(".doctor-panel").count() === 0, "rows: nothing about problems sits above the list");
const rowOf = (name) => p.locator("li.app", { has: p.locator(".app-row .app-name", { hasText: new RegExp(`^${name}$`) }) });
const btn = async (name) => (await rowOf(name).locator(".problem button").allInnerTexts()).join("|");
check(await btn("orders") === "Fix…", `rows: the localhost problem offers Fix… (${await btn("orders")})`);
check(await btn("billing") === "Connect…", `rows: the name problem offers Connect… (${await btn("billing")})`);
check(await btn("pg") === "See why", `rows: a crash with no one-click fix offers See why (${await btn("pg")})`);
check(await rowOf("sessions").locator(".problem").count() === 0, "rows: a healthy row has no problem line and no button");
check(await rowOf("pg").locator(".problem").count() === 1 && await rowOf("orders").locator(".problem").count() === 1, "rows: each problem shows once, under its own row");
const fit = await p.locator(`${home} .app-row`).evaluateAll((rows) => rows.every((r) => { const m = r.querySelector("button.more").getBoundingClientRect(), main = r.querySelector("button.main, span:last-child"), box = r.getBoundingClientRect(); return m.width >= 28 && m.right <= box.right + 1 && (!main || main.getBoundingClientRect().right <= m.left + 1); }));
check(fit, "rows: at 980 wide the main and … buttons keep their room on every row");
check(await p.locator(`${home} .problem`).evaluateAll((l) => l.every((e) => { const btn = e.querySelector("button"), box = e.getBoundingClientRect(), b = btn ? btn.getBoundingClientRect() : null; return (!b || (b.right <= box.right + 1 && b.width > 0)) && e.scrollWidth <= e.clientWidth + 1; })), "rows: every problem button is inside its line, not clipped");
check(await rowOf("orders").locator(".problem button").evaluate((b) => getComputedStyle(b).opacity) === "1", "rows: the Fix button shows without hovering");
await rowOf("orders").locator(".problem button").click();
check(/orders/.test(await p.getByRole("alertdialog").innerText().catch(() => "")), "rows: Fix… asks before changing anything");
await p.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
check(await rowOf("orders").locator(".problem").count() === 1 && /Fix…/.test(await btn("orders")), "rows: Cancel leaves the problem as it was");
// The fix itself, from the row: Fixing… then Fixed in the same line, with Done to clear it
await rowOf("orders").locator(".problem button").click();
await p.getByRole("alertdialog").getByRole("button", { name: /^Replace/ }).click();
await p.waitForSelector(`li.app .problem.busy`, { timeout: 4000 }).catch(() => {});
check(/Fixing…/.test(await btn("orders")) && await rowOf("orders").locator(".problem button").getAttribute("aria-disabled") === "true" && await rowOf("orders").locator(".problem.busy").count() === 1, "rows: while the fix runs the line is busy and its button says Fixing…");
check(await rowOf("orders").locator("button.main").getAttribute("aria-disabled") === "true", "rows: while the fix runs the row's Stop is aria-disabled");
// While it runs, the sidebar's profile menu can't stop the VM under it.
await p.getByRole("button", { name: /Switch profile/ }).click();
const sideStop = p.getByRole("menuitem", { name: /^Stop / }).or(p.getByRole("button", { name: /^Stop default$/ }));
check(await sideStop.first().isDisabled().catch(() => false), "rows: during a Fix the sidebar's Stop is disabled");
await p.keyboard.press("Escape");
await p.waitForFunction(() => [...document.querySelectorAll("li.app")].some((li) => /orders/.test(li.querySelector(".app-name")?.textContent ?? "") && /Fixed\./.test(li.querySelector(".problem")?.textContent ?? "")), null, { timeout: 30000 }).catch(() => {});
check(/Fixed\./.test(await rowOf("orders").locator(".problem").innerText().catch(() => "")) && await rowOf("orders").locator(".problem.ok").count() === 1 && await btn("orders") === "Done", `rows: after the fix the line says Fixed., green, with Done (${await btn("orders")})`);
await rowOf("orders").locator(".problem button").click();
await rowOf("orders").locator(".problem").waitFor({ state: "detached", timeout: 8000 }).catch(() => {});
check(await rowOf("orders").locator(".problem").count() === 0, "rows: Done puts the row back to normal");
await rowOf("pg").locator(".problem button").click();
await p.waitForTimeout(300);
check(/pg/.test(await p.locator(".content h2, .content h1").first().innerText().catch(() => "")), "rows: See why opens the container page");
if (shots) await p.screenshot({ path: `${shots}/doctor-rows.png` });

const noH = await p.evaluate(() => { const c = document.querySelector(".content"); return c.scrollWidth <= c.clientWidth + 1; });
check(noH, "no horizontal scroll at 980 wide");
check(p.errors.length === 0, `no page errors ${p.errors.join("; ")}`);
await browser.close();
process.exit(failed ? 1 : 0);

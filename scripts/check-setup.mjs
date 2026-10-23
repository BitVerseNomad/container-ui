// Setup screen checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
async function open(scenario) {
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=${scenario}`);
  await page.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
  return page;
}
const statuses = (p) => p.locator(".setup .finding").evaluateAll((els) => els.map((e) => e.className.replace("finding ", "")));

// missing tools: no false all-clear
let m = await open("missing");
await m.getByRole("button", { name: "Setup", exact: true }).click();
await m.getByText("Install Colima and Docker first").first().waitFor({ timeout: 4000 }).catch(() => {});
check(/Install Colima and Docker first/.test(await m.locator(".content").innerText()), "missing: Setup asks for the tools instead of showing green");
await m.close();

// healthy: no strip on home, every Setup row is ok
let p = await open("running");
await p.waitForTimeout(500);
check(await p.locator(".setup-strip").count() === 0, "healthy: no leftover strip on home");
await p.getByRole("button", { name: "Setup", exact: true }).click();
await p.waitForSelector(".setup .finding", { timeout: 3000 }).catch(() => {});
check((await statuses(p)).every((s) => s === "ok"), "healthy: every check passes");
check(/Everything Docker Desktop used to handle/.test(await p.locator(".setup").innerText()), "healthy: says all is in place");
check(!/until you click/.test(await p.locator(".setup").innerText()), "healthy: no talk of clicking when there is nothing to click");
check(p.errors.length === 0, `healthy: no page errors ${p.errors.join("; ")}`);
await p.close();

// desktop: strip on home, fails first, commands shown, fixes clear them
p = await open("desktop");
await p.waitForSelector(".setup-strip", { timeout: 3000 }).catch(() => {});
await p.waitForSelector(".nav-badge", { timeout: 3000 }).catch(() => {});
const stripN = (/(\d+) setup problems/.exec(await p.locator(".setup-strip").innerText().catch(() => "")) ?? [])[1];
check(!!stripN && stripN === await p.locator(".nav-badge").innerText().catch(() => ""), "desktop: home strip and sidebar badge show the same count");
await p.locator(".setup-strip").click();
await p.waitForSelector(".setup .finding", { timeout: 3000 }).catch(() => {});
const s = await statuses(p);
check(s[0] === "fail" && s.indexOf("fail") < s.indexOf("ok"), "desktop: failures sorted first");
check(/rm ~\/\.docker\/cli-plugins\/docker-buildx/.test(await p.locator(".setup").innerText()), "desktop: shows the exact command before fixing");
const cmds = await p.locator(".setup .cmd").allInnerTexts();
check(cmds.length > 0 && cmds.every((c) => !/backup is kept/.test(c)), "desktop: command boxes hold no English like (a backup is kept)");
check(/backup is kept/.test(await p.locator(".setup .steps").first().innerText()), "desktop: config edits show as steps above the box");
check(await p.locator(".setup details.passing").evaluate((d) => !d.open), "desktop: passing checks are collapsed");
check(await p.locator(".setup .finding.ok").first().isVisible() === false, "desktop: passing rows are hidden until expanded");
check(/\d+ checks? pass/.test(await p.locator(".setup details.passing summary").innerText()), "desktop: one row says how many checks pass");
check(await p.locator(".content .primary:visible").count() === 1, "desktop: one primary, Fix all");
check(/^\d+$/.test(await p.locator(".nav-badge").innerText().catch(() => "")), "desktop: Setup shows a count in the sidebar");
await p.waitForFunction((n) => new RegExp(`^${n} things need attention`).test(document.querySelector(".setup > .hint")?.textContent ?? ""), stripN, { timeout: 3000 }).catch(() => {});
check(new RegExp(`^${stripN} things need attention`).test(await p.locator(".setup > .hint").innerText()), "desktop: Setup intro shows the same count");
await p.getByRole("button", { name: "Fix all", exact: true }).click();
await p.waitForTimeout(3500);
check((await statuses(p)).every((x) => x !== "fail"), "desktop: every failure clears after its fix");
const rows = await p.locator(".setup .finding.info").allInnerTexts();
check(rows.some((t) => /doesn't start at login/.test(t)), "desktop: Fix all leaves the start-at-login info row alone");
check(!/Colima starts at login/.test(await p.locator(".setup").innerText()), "desktop: start at login stayed off after Fix all");
const left = (await statuses(p)).filter((x) => x === "warn").length;
check(new RegExp(`^${left} thing`).test(await p.locator(".setup > .hint").innerText()), "desktop: after fixes the intro counts only what is left (the copy-only warning)");
check(await p.getByRole("button", { name: /^Fix all/ }).count() === 0, "desktop: Fix all goes away when nothing is left to fix");
const noH = await p.evaluate(() => { const c = document.querySelector(".content"); return c.scrollWidth <= c.clientWidth + 1; });
check(noH, "desktop: no horizontal scroll at 980x640");
await p.getByRole("button", { name: "Containers", exact: true }).click();
check(await p.locator(".setup-strip").count() === 0, "desktop: strip gone after fixes");
check(p.errors.length === 0, `desktop: no page errors ${p.errors.join("; ")}`);

// terminal on another colima VM: not blocking, but the home strip says so and Setup fixes it
let mm = await open("mismatch");
await mm.waitForSelector(".setup-strip", { timeout: 3000 }).catch(() => {});
check(/different VMs|talks to "colima-work"/.test(await mm.locator(".setup-strip").innerText().catch(() => "")), "mismatch: home strip names the other context");
await mm.locator(".setup-strip").click();
await mm.getByRole("button", { name: "Use colima", exact: true }).click();
await mm.waitForTimeout(1200);
await mm.getByRole("button", { name: "Containers", exact: true }).click();
check(await mm.locator(".setup-strip").count() === 0, "mismatch: strip gone after switching context");
await mm.close();

await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

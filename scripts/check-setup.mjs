// Setup checks on the Doctor page (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
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
const statuses = (p) => p.locator(".setup .finding[data-setup]").evaluateAll((els) => els.map((e) => e.className.replace("finding ", "")));

// missing tools: no false all-clear
let m = await open("missing");
await m.getByRole("button", { name: "Doctor", exact: true }).click();
await m.getByText("Install Colima and Docker first").first().waitFor({ timeout: 4000 }).catch(() => {});
check(/Install Colima and Docker first/.test(await m.locator(".content").innerText()), "missing: Setup asks for the tools instead of showing green");
await m.close();

// healthy: no strip on home, every Setup row is ok
let p = await open("running");
await p.waitForTimeout(500);
check(await p.locator(".vm-note").count() === 0 && await p.locator(".setup-strip").count() === 0, "healthy: no terminal note and no strip on home");
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".setup .finding[data-setup]", { timeout: 3000 }).catch(() => {});
check((await statuses(p)).every((s) => s === "ok"), "healthy: every check passes");
check(await p.locator(".setup section .finding[data-setup]").count() === 0, "healthy: no setup row outside Passed");
check(p.errors.length === 0, `healthy: no page errors ${p.errors.join("; ")}`);
await p.close();

// desktop: strip on home, fails first, commands shown, fixes clear them
p = await open("desktop");
await p.waitForSelector(".vm-note", { timeout: 3000 }).catch(() => {});
await p.waitForSelector(".nav-badge", { timeout: 3000 }).catch(() => {});
const note = await p.locator(".vm-note").innerText().catch(() => "");
const stripN = (/docker in your terminal is broken \((\d+) problems\)/.exec(note) ?? [])[1];
const badgeN = await p.locator(".nav-badge").innerText().catch(() => "");
check(!!stripN && Number(badgeN) >= Number(stripN), "desktop: the VM row says the terminal is broken, and the badge counts at least those");
check(await p.locator(".vm-strip-wrap .vm-note").count() === 1, "desktop: the note sits in the VM row, not above the page");
await p.locator(".vm-note").getByRole("button", { name: "Fix all" }).click();
check(/backed up first/.test(await p.getByRole("alertdialog").innerText().catch(() => "")), "desktop: Fix all from the VM row asks first");
await p.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
await p.locator(".vm-note").getByRole("button", { name: "Details" }).click();
await p.waitForSelector(".setup .finding[data-setup]", { timeout: 3000 }).catch(() => {});
const s = await statuses(p);
check(s[0] === "fail" && s.indexOf("fail") < s.indexOf("ok"), "desktop: failures sorted first");
check(/rm ~\/\.docker\/cli-plugins\/docker-buildx/.test(await p.locator(".setup").innerText()), "desktop: shows the exact command before fixing");
const cmds = await p.locator(".setup .cmd").allInnerTexts();
check(cmds.length > 0 && cmds.every((c) => !/backup is kept/.test(c)), "desktop: command boxes hold no English like (a backup is kept)");
check(/backup is kept/.test(await p.locator(".setup .steps").first().innerText()), "desktop: config edits show as steps above the box");
check(await p.locator(".setup details.passing").evaluate((d) => !d.open), "desktop: passing checks are collapsed");
check(await p.locator(".setup .finding.ok").first().isVisible() === false, "desktop: passing rows are hidden until expanded");
check(/\d+ checks? pass/.test(await p.locator(".setup details.passing summary").innerText()), "desktop: one row says how many checks pass");
check(await p.locator(".fix-all .primary:visible").count() === 1, "desktop: one Fix all for the setup problems");
await p.waitForFunction((n) => new RegExp(`^${n} things need action`).test(document.querySelector(".doctor-head .hint")?.textContent ?? ""), badgeN, { timeout: 3000 }).catch(() => {});
check(new RegExp(`^${badgeN} things? needs? action`).test(await p.locator(".doctor-head .hint").innerText()), "desktop: the page summary shows the badge's count");
await p.getByRole("button", { name: "Fix all setup problems", exact: true }).click();
await p.waitForTimeout(3500);
check((await statuses(p)).every((x) => x !== "fail"), "desktop: every failure clears after its fix");
const rows = await p.locator(".setup .finding.info[data-setup]").allInnerTexts();
check(rows.some((t) => /doesn't start at login/.test(t)), "desktop: Fix all leaves the start-at-login info row alone");
check(!/Colima starts at login/.test(await p.locator(".setup").innerText()), "desktop: start at login stayed off after Fix all");
const left = (await statuses(p)).filter((x) => x === "warn").length;
check(left === 1 && await p.locator(".setup section .finding.warn[data-setup]").count() === 1, "desktop: after fixes only the copy-only setup warning is left");
check(await p.getByRole("button", { name: /^Fix all/ }).count() === 0, "desktop: Fix all goes away when nothing is left to fix");
const noH = await p.evaluate(() => { const c = document.querySelector(".content"); return c.scrollWidth <= c.clientWidth + 1; });
check(noH, "desktop: no horizontal scroll at 980x640");
await p.getByRole("button", { name: "Containers", exact: true }).click();
check(!/terminal is broken/.test(await p.locator(".vm-note").innerText().catch(() => "")), "desktop: the VM row note goes away after fixes");
check(p.errors.length === 0, `desktop: no page errors ${p.errors.join("; ")}`);

// terminal on another colima VM: not blocking, but the home strip says so and Setup fixes it
let mm = await open("mismatch");
await mm.waitForSelector(".vm-note", { timeout: 3000 }).catch(() => {});
const first = mm.locator(".vm-note");
check(/different VMs|colima-work/.test(await first.innerText().catch(() => "")), "mismatch: the VM row names the other context");
await first.getByRole("button", { name: "Use colima", exact: true }).click();
await mm.getByRole("alertdialog").getByRole("button", { name: "Use colima" }).click();
await mm.waitForTimeout(1200);
check(await mm.locator(".vm-note").count() === 0, "mismatch: the note goes away after switching context");
await mm.close();

await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

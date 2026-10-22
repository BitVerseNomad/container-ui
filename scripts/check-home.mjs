// Home screen (Containers) scenario checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const ok = (m) => console.log("ok", m);
const bad = (m) => { failed++; console.log("FAIL", m); };
const check = (cond, m) => (cond ? ok(m) : bad(m));

const browser = await chromium.launch();
async function open(scenario) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 680 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=${scenario}`);
  await page.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
  return page;
}
const text = (page, sel) => page.locator(sel).first().innerText({ timeout: 3000 }).catch(() => "");
const primaries = (page) => page.locator(".content .primary:visible").count();
const noHScroll = (page) => page.evaluate(() => { const c = document.querySelector(".content"); return !c || c.scrollWidth <= c.clientWidth + 1; });

// running: VM strip with controls and meters, the container table, one primary button
let p = await open("running");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.waitForSelector("table.list tbody tr", { timeout: 4000 }).catch(() => {});
check(await p.locator(".home .vm-strip").count() === 1, "running: VM strip shown");
check(await p.getByRole("button", { name: /Restart the .* VM/ }).count() === 1 && await p.getByRole("button", { name: /Stop the .* VM/ }).count() === 1, "running: Restart and Stop offered");
check(await p.locator(".vm-strip").getByRole("meter").count() === 3, "running: three meters (CPU, memory, disk)");
check(/web/.test(await text(p, "table.list")) && /db/.test(await text(p, "table.list")), "running: containers listed");
check(await primaries(p) === 1, "running: exactly one primary button");
check(await p.getByRole("button", { name: "Run image" }).evaluate((b) => b.classList.contains("primary")).catch(() => false), "running: Run image is the primary");
await p.waitForTimeout(800);
const rows = await p.locator("table.list tbody tr").allInnerTexts();
check(rows.length >= 2 && /Its health check is failing|ran out of memory|keeps restarting/i.test(rows[0]), "running: a container with a problem is sorted first");
check(await p.locator("table.list .port-link").count() > 0, "running: published ports have a quick link");
check(await p.getByRole("button", { name: /Needs attention/ }).count() === 1, "running: the Needs attention filter shows");
await p.getByRole("button", { name: /Needs attention/ }).click();
const flagged = await p.locator("table.list tbody tr").count();
check(flagged > 0 && flagged < rows.length, "running: Needs attention narrows the table");
await p.getByRole("button", { name: /^All/ }).click();
await p.fill(".search-field input", "mysql");
check(await p.locator("table.list tbody tr").count() === 1, "running: search filters by image");
check(await noHScroll(p), "running: no sideways scroll");
await p.screenshot({ path: "/tmp/home-running.png" });
check(p.errors.length === 0, `running: no page errors ${p.errors.join("|")}`);
await p.close();

// stopped: exactly one primary and it is Start
p = await open("stopped");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
check(await primaries(p) === 1 && /^Start$/.test((await p.locator(".content .primary:visible").first().innerText()).trim()), "stopped: the only primary is Start");
check(await p.getByRole("button", { name: "Run image" }).count() === 0, "stopped: no Run image while the VM is off");
await p.screenshot({ path: "/tmp/home-stopped.png" });
await p.close();

// starting: output log visible, strip says Starting
p = await open("stopped");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Start", exact: true }).click();
await p.waitForSelector(".out-log", { timeout: 4000 }).catch(() => {});
check(await p.locator(".out-log").count() === 1, "starting: output log shown");
check(/Starting/.test(await text(p, ".vm-state")), "starting: strip says Starting");
await p.waitForTimeout(1500);
check(!/time=|\x1b|level=/.test(await text(p, ".out-log")), "starting: log text is cleaned (no logfmt, no escape codes)");
await p.screenshot({ path: "/tmp/home-starting.png" });
await p.close();

// failed: headline and Retry
p = await open("failed");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Start", exact: true }).click();
await p.waitForSelector(".out-fail", { timeout: 9000 }).catch(() => {});
check(/exit status 1|Could not|failed/i.test(await text(p, ".out-fail")), "failed: failure headline shown");
check(await p.getByRole("button", { name: "Retry", exact: true }).count() === 1, "failed: Retry offered");
await p.screenshot({ path: "/tmp/home-failed.png" });
await p.close();

// missing: install card with the exact command, only on click
p = await open("missing");
await p.waitForSelector(".install-card", { timeout: 4000 }).catch(() => {});
check(/brew install colima docker/.test(await text(p, ".install-card")), "missing: shows the exact brew command");
check(await p.locator(".vm-strip").count() === 0, "missing: no VM strip");
check(await primaries(p) === 1, "missing: one primary button");
await p.screenshot({ path: "/tmp/home-missing.png" });
await p.getByRole("button", { name: /Install with Homebrew/ }).click();
await p.getByRole("button", { name: /Start Colima/ }).waitFor({ timeout: 9000 }).catch(() => {});
check(await p.getByRole("button", { name: /Start Colima/ }).count() > 0, "missing: after install the app re-checks and offers Start");
await p.close();
// partly installed (docker present, colima missing): only the missing one is listed, install succeeds
p = await open("partial");
await p.waitForSelector(".install-card", { timeout: 4000 }).catch(() => {});
check(/brew install colima/.test(await text(p, ".install-card")) && !/brew install colima docker/.test(await text(p, ".install-card")), "partial: command lists only what is missing");
await p.close();

// no homebrew: bootstrap command with copy, never a Run button for it
p = await open("nobrew");
await p.waitForSelector(".install-card", { timeout: 4000 }).catch(() => {});
check(/Homebrew/.test(await text(p, ".install-card")) && await p.getByRole("button", { name: /Copy/ }).count() > 0, "nobrew: shows the bootstrap command with a copy button");
check(await p.getByRole("button", { name: /Install with Homebrew/ }).count() === 0, "nobrew: no one-click install");
await p.close();

// none: no profile yet
p = await open("none");
await p.waitForSelector(".content", { timeout: 4000 });
await p.waitForTimeout(600);
check(/first|start|create/i.test(await text(p, ".content")) && p.errors.length === 0, "none: start-first-VM state, no errors");
await p.screenshot({ path: "/tmp/home-none.png" });
await p.close();

// retry repeats the failed operation (a failed stop must not start the VM)
p = await open("stopfail");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: /Stop the .* VM/ }).click();
await p.waitForSelector(".out-fail", { timeout: 9000 }).catch(() => {});
await p.getByRole("button", { name: "Retry", exact: true }).click();
await p.waitForTimeout(1200);
const calls = await p.evaluate(() => window.__calls);
check(calls.filter((c) => c === "stop_profile").length === 2 && !calls.includes("start_profile"), "stopfail: Retry repeats the stop, it does not start the VM");
await p.close();

// a stale failure clears once the VM is running again (started elsewhere)
p = await open("failed");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Start", exact: true }).click();
await p.waitForSelector(".out-fail", { timeout: 9000 }).catch(() => {});
await p.evaluate(() => window.__mock.setStatus("Running"));
await p.waitForSelector(".out-fail", { state: "detached", timeout: 6000 }).catch(() => {});
check(await p.locator(".out-fail").count() === 0 && /Running/.test(await text(p, ".vm-state")), "failed: the failure clears once the VM is running");
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

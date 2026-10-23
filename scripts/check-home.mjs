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
await p.waitForSelector("table.list tbody tr:not(.group-row)", { timeout: 4000 }).catch(() => {});
check(await p.locator(".home .vm-strip").count() === 1, "running: VM strip shown");
check(await p.getByRole("button", { name: /Restart the .* VM/ }).count() === 1 && await p.getByRole("button", { name: /Stop the .* VM/ }).count() === 1, "running: Restart and Stop offered");
check(await p.locator(".vm-strip").getByRole("meter").count() === 3, "running: three meters (CPU, memory, disk)");
check(/Stop VM/.test(await text(p, ".vm-strip")) && !/\bdefault\b/.test(await text(p, ".vm-strip")), "running: the VM line says Stop VM in words and leaves the name to the sidebar switcher");
check(/web/.test(await text(p, "table.list")) && /db/.test(await text(p, "table.list")), "running: containers listed");
check(await primaries(p) === 1, "running: exactly one primary button");
check(await p.getByRole("button", { name: "New" }).evaluate((b) => b.classList.contains("primary")).catch(() => false), "running: New is the primary");
await p.getByRole("button", { name: "New" }).click();
check(JSON.stringify(await p.getByRole("menuitem").allInnerTexts().then((t) => t.map((x) => x.split("\n")[0].trim()))) === JSON.stringify(["Run image", "Pull image", "Compose projects"]), "running: New offers Run image, Pull image and Compose projects");
await p.keyboard.press("Escape");
check(await p.getByRole("menu").count() === 0 && await p.evaluate(() => document.activeElement?.getAttribute("aria-label") === "New"), "running: Escape closes the menu and focus goes back to New");
const actionsHidden = await p.locator("table.list tbody tr:not(.group-row)").first().locator("td.row-actions > *").first().evaluate((el) => getComputedStyle(el).opacity);
await p.locator("table.list tbody tr:not(.group-row)").first().hover();
await p.waitForTimeout(200);
const actionsShown = await p.locator("table.list tbody tr:not(.group-row)").first().locator("td.row-actions > *").first().evaluate((el) => getComputedStyle(el).opacity);
check(actionsHidden === "0" && actionsShown === "1", `running: row tools stay hidden until the row is hovered (${actionsHidden} then ${actionsShown})`);
const rowH = await p.locator("table.list tbody tr:not(.group-row)").first().evaluate((el) => el.getBoundingClientRect().height);
check(rowH <= 38, `running: rows are one line (${Math.round(rowH)}px)`);
await p.getByRole("button", { name: "Hide the sidebar" }).click();
await p.waitForTimeout(400);
const side = await p.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().width);
check(side <= 60 && await p.getByRole("button", { name: "Containers", exact: true }).isVisible(), `running: the sidebar folds to icons (${Math.round(side)}px) and stays usable`);
await p.reload();
await p.waitForSelector(".sidebar", { timeout: 4000 });
check(await p.getByRole("button", { name: "Show the sidebar" }).count() === 1, "running: the folded sidebar is remembered after a reload");
await p.getByRole("button", { name: "Show the sidebar" }).click();
await p.waitForSelector("table.list tbody tr:not(.group-row)", { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(800);
const rows = await p.locator("table.list tbody tr:not(.group-row)").allInnerTexts();
check(rows.length >= 2 && /Its health check is failing|ran out of memory|keeps restarting/i.test(rows[0]), "running: a container with a problem is sorted first");
check(await p.locator("table.list .port-link").count() > 0, "running: published ports have a quick link");
check(await p.getByRole("button", { name: "Open web at localhost:8080 in your browser" }).count() === 1, "running: a web port (nginx 80) opens in the browser");
check(await p.getByRole("button", { name: "Copy localhost:3306" }).count() === 1 && await p.getByRole("button", { name: /Open db at localhost:3306/ }).count() === 0, "running: a database port is a copy chip, not a web link");
check(/GiB/.test(await text(p, ".vm-strip")) && !/\bGB\b/.test(await text(p, ".vm-strip")), "running: the VM strip uses GiB");
check(await p.getByRole("button", { name: /Needs attention/ }).count() === 1, "running: the Needs attention filter shows");
await p.getByRole("button", { name: /Needs attention/ }).click();
const flagged = await p.locator("table.list tbody tr:not(.group-row)").count();
check(flagged > 0 && flagged < rows.length, "running: Needs attention narrows the table");
await p.getByRole("button", { name: /^All/ }).click();
await p.fill(".search-field input", "mysql");
check(await p.locator("table.list tbody tr:not(.group-row)").count() === 1, "running: search filters by image");
check(await noHScroll(p), "running: no sideways scroll");
await p.screenshot({ path: "/tmp/home-running.png" });
check(p.errors.length === 0, `running: no page errors ${p.errors.join("|")}`);
await p.close();

// stopped: exactly one primary and it is Start
p = await open("stopped");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
check(await primaries(p) === 1 && /^Start default$/.test((await p.locator(".content .primary:visible").first().innerText()).trim()), "stopped: the only primary is Start, inside the stopped card");
check((await p.locator(".stopped-card .primary").count()) === 1 && (await p.locator(".vm-strip .primary").count()) === 0, "stopped: Start sits in the card, not also in the strip");
check(await p.getByRole("button", { name: "New" }).count() === 0, "stopped: no New menu while the VM is off");
await p.screenshot({ path: "/tmp/home-stopped.png" });
await p.close();

// starting: output log visible, strip says Starting
p = await open("stopped");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: /^Start default$/ }).click();
await p.waitForSelector(".out-log", { timeout: 4000 }).catch(() => {});
check(await p.locator(".out-log").count() === 1, "starting: output log shown");
check(/Starting/.test(await text(p, ".vm-state")), "starting: strip says Starting");
await p.waitForTimeout(1500);
check(!/time=|\x1b|level=/.test(await text(p, ".out-log")), "starting: log text is cleaned (no logfmt, no escape codes)");
await p.screenshot({ path: "/tmp/home-starting.png" });
await p.close();

// compose: containers group under their project, loose ones last, groups collapse and act together
p = await open("running");
await p.waitForSelector("table.list .group-row", { timeout: 4000 }).catch(() => {});
const heads = await p.locator("table.list .group-row").allInnerTexts();
check(heads.length === 2 && /shop/.test(heads[0]) && /Other containers/.test(heads[1]), "compose: shop project first, loose containers last");
check(/~\/code\/shop/.test(heads[0]), "compose: the project folder is shown with ~");
const before = await p.locator("table.list tbody tr:not(.group-row)").count();
await p.getByRole("button", { name: /shop/ }).first().click();
check(await p.locator("table.list tbody tr:not(.group-row)").count() < before, "compose: collapsing a project hides its rows");
await p.getByRole("button", { name: /shop/ }).first().click();
await p.getByRole("button", { name: "Stop all in shop" }).click();
await p.waitForTimeout(3500);
check(/0 of 7 running/.test(await p.locator("table.list .group-row").first().innerText()), "compose: Stop all stops every container in the project");
await p.screenshot({ path: "/tmp/compose.png" });
await p.close();

// stopped: other tabs name the stopped VM and start it from there
p = await open("stopped");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Images", exact: true }).click();
check(/default is stopped/.test(await text(p, ".empty")), "stopped: Images names the stopped VM");
await p.getByRole("button", { name: "Start default" }).click();
await p.waitForTimeout(2500);
check(/Running/.test(await text(p, ".vm-state")), "stopped: Start from Images brings the VM up on Containers");
await p.close();

// failed: one card with the reason and a retry
p = await open("failed");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: /^Start default$/ }).click();
await p.waitForSelector(".start-why", { timeout: 9000 }).catch(() => {});
check(await p.locator(".out-fail").count() === 0 && await p.locator(".out").count() === 0, "failed: the error shows once, in the card, not again below it");
check(await p.getByRole("button", { name: "Try starting again", exact: true }).count() === 1, "failed: Try starting again offered");
check(/couldn't start the VM/i.test(await text(p, ".start-why")) && /ha\.stderr\.log/.test(await text(p, ".start-why")), "failed: a plain reason and the log path are shown");
check(/stopped unexpectedly/.test(await text(p, ".start-why pre")), "failed: the telling line from the VM log is shown");
check(await primaries(p) === 1, "failed: exactly one primary button");
check(await p.getByRole("button", { name: "Force stop, then start" }).count() === 0, "failed: no force stop without lock-file evidence");
await p.close();

// stuck: the VM log names a stale instance, so force stop is the one fix
p = await open("stuck");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: /^Start default$/ }).click();
await p.waitForSelector(".start-why", { timeout: 4000 }).catch(() => {});
check(/stuck from an earlier run/.test(await text(p, ".start-why")), "stuck: says the VM is stuck from an earlier run");
await p.getByRole("button", { name: "Force stop, then start" }).click();
await p.waitForTimeout(1200);
check(await p.locator(".start-why").count() === 0 && /Running/.test(await text(p, ".vm-state")), "stuck: force stop then start brings the VM up");
await p.close();

// missing: install card with the exact command, only on click
p = await open("missing");
await p.waitForSelector(".install-card", { timeout: 4000 }).catch(() => {});
check(/brew install colima docker docker-compose docker-buildx/.test(await text(p, ".install-card")), "missing: shows the exact brew command, compose and buildx included");
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
check(await p.getByRole("button", { name: "Start Colima (6 CPUs, 8 GiB)" }).count() === 1, "none: the first VM is sized from the Mac and says so");
await p.getByRole("button", { name: "Customize first" }).click();
await p.waitForTimeout(300);
check(await p.locator("dialog[open]").count() === 1 && await p.locator('dialog[open] input[name="cpus"]').inputValue() === "6", "none: Customize first opens the form, prefilled");
await p.screenshot({ path: "/tmp/home-none.png" });
await p.close();

// retry repeats the failed operation (a failed stop must not start the VM)
p = await open("stopfail");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: /Stop the .* VM/ }).click();
await p.waitForSelector(".start-why", { timeout: 9000 }).catch(() => {});
check(/Couldn't stop default/.test(await text(p, ".start-why")) && !/start the VM/.test(await text(p, ".start-why")), "stopfail: the card says the stop failed, not the start");
check(!/Failed/.test(await text(p, ".vm-state")) && await p.locator(".vm-strip .sdot.warn").count() === 1, "stopfail: state shows the VM as it really is, amber, not red Failed");
check(await p.getByRole("button", { name: "Force stop", exact: true }).count() === 1 && await p.locator(".start-why .primary").count() === 1, "stopfail: Force stop is the card's one primary fix");
await p.getByRole("button", { name: "Try stopping again", exact: true }).click();
await p.waitForTimeout(1200);
const calls = await p.evaluate(() => window.__calls);
check(calls.filter((c) => c === "stop_profile").length === 2 && !calls.includes("start_profile"), "stopfail: Try again repeats the stop, it does not start the VM");
await p.getByRole("button", { name: "Force stop", exact: true }).click();
await p.waitForTimeout(800);
check(/Stopped/.test(await text(p, ".vm-state")) && await p.locator(".start-why").count() === 0, "stopfail: Force stop stops the VM and clears the card");
await p.close();

// a stale failure clears once the VM is running again (started elsewhere)
p = await open("failed");
await p.waitForSelector(".vm-strip", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: /^Start default$/ }).click();
await p.waitForSelector(".start-why", { timeout: 9000 }).catch(() => {});
await p.evaluate(() => window.__mock.setStatus("Running"));
await p.waitForSelector(".start-why", { state: "detached", timeout: 6000 }).catch(() => {});
check(await p.locator(".start-why").count() === 0 && /Running/.test(await text(p, ".vm-state")), "failed: the failure clears once the VM is running");
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

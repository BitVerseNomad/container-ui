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

const home = "ul.apps > li.app";
const settle = async (page) => { await page.waitForSelector(home, { timeout: 4000 }).catch(() => {}); await page.waitForTimeout(900); };
const appRow = (page, name) => page.locator("li.app", { has: page.locator(".app-row .app-name", { hasText: new RegExp(`^${name}$`) }) });
const open_ = async (page, name) => { const b = appRow(page, name).locator(".app-row .app-name"); if (await b.getAttribute("aria-expanded") === "false") await b.click(); };
const profileMenu = async (page) => { await page.getByRole("button", { name: "Switch profile" }).click(); };

// running: the home is a list of apps; the VM strip, meters and VM buttons are gone while the VM simply runs
let p = await open("running");
await settle(p);
check(await p.locator(".home .vm-strip, .home .vm-strip-wrap").count() === 0, "running: no VM strip while the VM is simply running");
check(await p.locator(".home").getByRole("meter").count() === 0 && await p.locator(".home table, .home th").count() === 0 && !/\bCPU\b|\bMemory\b/.test(await text(p, ".home")), "running: no usage meters and no CPU or Memory columns on home");
check(await p.getByRole("button", { name: /Restart the .* VM/ }).count() === 0 && await p.getByRole("button", { name: /Stop the .* VM/ }).count() === 0, "running: no Restart or Stop VM button on home");
await profileMenu(p);
check(await p.getByRole("menuitem", { name: /^Restart (the VM )?default$/ }).count() === 1 && await p.getByRole("menuitem", { name: /^Stop (the VM )?default$/ }).count() === 1, "running: Restart and Stop live in the profile menu");
await p.keyboard.press("Escape");
check(/default/.test(await text(p, ".sidebar .brand")) && /Running/.test(await text(p, ".sidebar .brand")), "running: the sidebar switcher names the VM and says Running");
check(await p.locator("ul.apps").getAttribute("aria-label") === "Containers" && await p.locator(home).count() === 3, "running: one row per app (kafka, kafka-ui and the shop project)");
const names = await p.locator(`${home} > .app-row .app-name`).allInnerTexts();
check(JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b))), `running: apps are alphabetical, so a row never moves (${names.join(", ")})`);
await open_(p, "shop");
const svcText = await text(p, "ul.svc");
check(/api/.test(svcText) && /web/.test(svcText) && /db/.test(svcText) && await p.locator("ul.svc > li").count() === 7, "running: the shop project lists its 7 services when opened");
check(await primaries(p) === 1 + await p.locator(".content .problem .primary:visible").count() && await p.locator(".content > * .primary:visible, .content .primary:visible").first().evaluate((b) => b.textContent.includes("New")), "running: New is the one primary outside the problem lines");
check(await p.getByRole("button", { name: "New" }).evaluate((b) => b.classList.contains("primary")).catch(() => false), "running: New is the primary");
await p.getByRole("button", { name: "New" }).click();
check(JSON.stringify(await p.getByRole("menuitem").allInnerTexts().then((t) => t.map((x) => x.split("\n")[0].trim()))) === JSON.stringify(["Run an image…", "Pull an image…", "Start a Compose project…"]), "running: New offers Run an image…, Pull an image… and Start a Compose project…");
await p.keyboard.press("Escape");
check(await p.getByRole("menu").count() === 0 && await p.evaluate(() => document.activeElement?.getAttribute("aria-label") === "New"), "running: Escape closes the menu and focus goes back to New");
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /Start a Compose project/ }).click();
check(await p.locator(".drawer").count() === 1, "running: Start a Compose project… opens the Compose projects drawer");
await p.keyboard.press("Escape");
await p.waitForTimeout(300);
// The "..." button is always there: visible and focusable with no hover at all.
const reach = async (page, sel) => page.locator(sel).first().evaluate((el) => {
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  el.focus();
  return { shown: cs.opacity === "1" && cs.visibility === "visible" && cs.display !== "none" && r.width > 0 && r.height > 0, focused: document.activeElement === el };
});
const rt = await reach(p, `${home} > .app-row button.more`);
check(rt.shown && rt.focused, "running: a row's … button is visible and focusable without hovering");
const st = await reach(p, "ul.svc .svc-row button.more");
check(st.shown && st.focused, "running: a service's … button is visible and focusable without hovering");
const rowH = await p.locator(`${home} > .app-row`).first().evaluate((el) => el.getBoundingClientRect().height);
const svcH = await p.locator("ul.svc .svc-row").first().evaluate((el) => el.getBoundingClientRect().height);
check(rowH <= 41 && svcH <= 33, `running: rows are one line (app ${Math.round(rowH)}px, service ${Math.round(svcH)}px)`);
await p.getByRole("button", { name: "Hide the sidebar" }).click();
await p.waitForTimeout(400);
const side = await p.locator(".sidebar").evaluate((el) => el.getBoundingClientRect().width);
check(side <= 60 && await p.getByRole("button", { name: "Containers", exact: true }).isVisible(), `running: the sidebar folds to icons (${Math.round(side)}px) and stays usable`);
await p.reload();
await p.waitForSelector(".sidebar", { timeout: 4000 });
check(await p.getByRole("button", { name: "Show the sidebar" }).count() === 1, "running: the folded sidebar is remembered after a reload");
await p.getByRole("button", { name: "Show the sidebar" }).click();
await settle(p);
// Problems sit under their own row, once. Container problems do not reorder anything.
check(/Only reachable from your Mac|Can't reach Kafka/.test(await text(p, `${home}:nth-child(1), ${home}:nth-child(2)`)) || await appRow(p, "kafka").locator(".problem").count() + await appRow(p, "kafka-ui").locator(".problem").count() >= 1, "running: a loose container's problem shows under its own row");
const shopLines = await appRow(p, "shop").locator(".problem").allInnerTexts();
check(shopLines.length >= 3 && shopLines.some((l) => /health check is failing/.test(l)) && shopLines.some((l) => /ran out of memory/.test(l)) && shopLines.some((l) => /keeps restarting/.test(l)), "running: a folded project shows its services' problems under its row, each naming its service");
const lines = await p.locator(`${home} .problem`).evaluateAll((els) => els.map((e) => ({ buttons: e.querySelectorAll("button").length, text: e.querySelector(".problem-text")?.textContent ?? "" })));
const together = lines.filter((l) => l.buttons === 0);
check(lines.length >= 4 && lines.every((l) => l.buttons <= 1 && l.text.length > 0) && together.every((l) => /Fixed together with [\w-]+\./.test(l.text)) && together.length <= 1, `running: every problem line has one button; the only line without one says which row fixes it (${together.map((l) => l.text).join("")})`);
check(await appRow(p, "kafka-ui").locator(".problem button").first().innerText().then((t) => /^Fix kafka and kafka-ui…$/.test(t.trim())), "running: the shared fix is offered once, on the row that owns it, naming both containers");
// Ports: a web port is a link on the row; a database port is a copy chip on the service, never a web link.
check(await p.getByRole("button", { name: "Open shop at localhost:8080 in your browser" }).count() === 1 && await p.getByRole("button", { name: "Open kafka-ui at localhost:8082 in your browser" }).count() === 1, "running: published web ports have a quick link on the row");
check(await appRow(p, "shop").locator(".app-port .port-link").allInnerTexts().then((t) => t.join("").includes(":8080")) && await p.getByRole("button", { name: /localhost:3306/ }).count() === 0, "running: the row shows the first web port, and hides the database port while folded");
await open_(p, "shop");
check(await p.getByRole("button", { name: "Open web at localhost:8080 in your browser" }).count() === 1, "running: a web port (nginx 80) opens in the browser");
check(await p.getByRole("button", { name: "Copy localhost:3306" }).count() === 1 && await p.getByRole("button", { name: /Open db at localhost:3306/ }).count() === 0, "running: a database port is a copy chip, not a web link");
const chip = p.getByRole("button", { name: "Copy localhost:3306" });
check((await chip.innerText()).trim() === ":3306" && await chip.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= el.closest(".svc-ports").getBoundingClientRect().right + 1), "running: the database port chip shows just the port (:3306) and is not clipped");
// Removed on purpose from home
check(await p.getByRole("button", { name: /Needs attention/ }).count() === 0 && await p.getByRole("button", { name: /^(All|Running)\b/ }).count() === 0, "running: no All, Running or Needs attention filters");
check(await p.getByRole("checkbox").count() === 0 && await p.getByRole("region", { name: "Selected containers" }).count() === 0, "running: no checkboxes and no bulk bar");
check(await p.locator(".toolbar").getByRole("button", { name: /^Compose projects/ }).count() === 0 && await p.locator(".home .vm-note").count() === 0 && !/Free space|reclaim/i.test(await text(p, ".home")), "running: no Compose projects button, no terminal note, no free-space nudge on home");
check(await noHScroll(p), "running: no sideways scroll");
check(await p.locator(".sr-only[role=status]:not([data-resize-announcer])").count() === 1 && await p.locator(".sr-only[role=alert]:not([data-resize-announcer])").count() === 1, "running: both live regions exist from the first render");
await p.screenshot({ path: "/tmp/home-running.png" });
check(p.errors.length === 0, `running: no page errors ${p.errors.join("|")}`);
await p.close();

// Search (doctor scenario: 7 apps, so the field is there however rows are counted): a name, an image or a port
p = await open("doctor");
await settle(p);
await p.fill(".search-field input", "mysql");
check(await p.locator(home).count() === 1 && await p.locator("ul.svc > li").count() === 1, "search: filters by image (shop with just db)");
await p.fill(".search-field input", "3306");
check(await p.locator(home).count() === 1 && await p.locator("ul.svc > li").count() === 1, "search: a number finds the container that publishes that port");
await p.fill(".search-field input", "8082");
check(await p.locator(home).count() === 1 && await appRow(p, "kafka-ui").count() === 1, "search: another port number finds kafka-ui");
await p.fill(".search-field input", "zzzz");
check(await p.locator(home).count() === 0 && /Nothing matches/.test(await text(p, ".content")), "search: no match says Nothing matches");
await p.fill(".search-field input", "blog");
check(/Nothing matches/.test(await text(p, ".content")) && await p.getByRole("button", { name: /Show (it|them)/ }).count() === 1, "search: a search for a project that is not running links to the Compose projects");
await p.getByRole("button", { name: /Show (it|them)/ }).click();
check(await p.locator(".drawer").count() === 1, "search: that link opens the Compose projects drawer");
await p.keyboard.press("Escape");
await p.fill(".search-field input", "");
await p.close();

// the search field earns its place only from 7 rows (a service counts as a row)
p = await open("running");
await settle(p);
const removeVia = async (page, label, who) => {
  await page.getByRole("button", { name: `More actions for ${label}`, exact: true }).click();
  await page.getByRole("menuitem", { name: /^Remove/ }).click();
  await page.locator("[role=alertdialog]").getByRole("button", { name: "Remove" }).click();
  await page.waitForFunction((w) => ![...document.querySelectorAll(".app-name, .svc-name")].some((e) => (e.getAttribute("aria-label") || "").startsWith(w + ",")), who, { timeout: 6000 }).catch(() => {});
};
check(await p.getByRole("textbox", { name: "Search containers" }).count() === 1, "search: shown with 9 rows (shop's 7 services plus 2 loose containers)");
await removeVia(p, "kafka", "kafka");
await removeVia(p, "kafka-ui", "kafka-ui");
await p.waitForTimeout(3500);
check(await p.getByRole("textbox", { name: "Search containers" }).count() === 1, "search: still shown at exactly 7 rows (the shop services)");
await open_(p, "shop");
await p.getByRole("button", { name: "More actions for cache", exact: true }).click();
await p.getByRole("menuitem", { name: /^Remove/ }).click();
await p.locator("[role=alertdialog]").getByRole("button", { name: "Remove" }).click();
await p.waitForTimeout(3500);
check(await p.getByRole("textbox", { name: "Search containers" }).count() === 0, "search: gone at 6 rows");
await p.close();

// stopped: one blank state with one primary, Start VM; no strip, no New menu
p = await open("stopped");
await p.waitForSelector(".blank", { timeout: 4000 }).catch(() => {});
check(await p.locator(".home .vm-strip").count() === 0 && await p.locator(home).count() === 0, "stopped: no VM strip and no app list while the VM is off");
check(/is stopped/.test(await text(p, ".blank h2")) && /default/.test(await text(p, ".blank h2")), "stopped: the heading names the VM and says it is stopped");
check(await primaries(p) === 1 && /^Start VM$/.test((await p.locator(".content .primary:visible").first().innerText()).trim()), "stopped: the only primary is Start VM");
check((await p.locator(".blank .primary").count()) === 1, "stopped: Start VM sits in the blank state");
check(await p.getByRole("button", { name: "New" }).count() === 0, "stopped: no New menu while the VM is off");
await profileMenu(p);
check(await p.getByRole("menuitem", { name: /^Start (the VM )?default$/ }).count() === 1 && await p.getByRole("menuitem", { name: /^Restart/ }).count() === 0, "stopped: the profile menu offers Start, and no Restart");
await p.keyboard.press("Escape");
await p.screenshot({ path: "/tmp/home-stopped.png" });
await p.close();

// starting: the strip comes back while the VM starts: output log visible, strip says Starting
p = await open("stopped");
await p.waitForSelector(".blank", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Start VM", exact: true }).click();
await p.waitForSelector(".out-log", { timeout: 4000 }).catch(() => {});
check(await p.locator(".out-log").count() === 1, "starting: output log shown");
check(/Starting/.test(await text(p, ".vm-state")) && await p.locator(".blank").count() === 0, "starting: the strip says Starting and the stopped state is gone");
await p.waitForTimeout(1500);
check(!/time=|\x1b|level=/.test(await text(p, ".out-log")), "starting: log text is cleaned (no logfmt, no escape codes)");
await p.screenshot({ path: "/tmp/home-starting.png" });
await p.waitForSelector(home, { timeout: 8000 }).catch(() => {});
check(await p.locator(home).count() > 0 && await p.locator(".home .vm-strip").count() === 0, "starting: once the VM runs the strip goes and the apps show");
await p.close();

// compose: containers group under their project, loose ones are rows of their own, projects open and act together
p = await open("running");
await settle(p);
check(await p.locator("ul.svc").count() === 0 && await appRow(p, "shop").locator(".app-name").getAttribute("aria-expanded") === "false", "compose: a project starts folded");
check(/~\/code\/shop/.test(await appRow(p, "shop").locator(".app-name").getAttribute("title")), "compose: the project folder is shown with ~");
check((await appRow(p, "kafka").locator(".app-name").getAttribute("aria-expanded")) === null, "compose: a loose container is a row of its own, not a group");
await appRow(p, "shop").locator(".app-name").click();
check(await p.locator("ul.svc > li").count() === 7 && await appRow(p, "shop").locator(".app-name").getAttribute("aria-expanded") === "true", "compose: opening a project shows its services");
await appRow(p, "shop").locator(".app-name").click();
check(await p.locator("ul.svc").count() === 0, "compose: folding a project hides its services");
check(/5 of 6 running/.test(await appRow(p, "shop").locator(".app-state").innerText()), "compose: the project row counts what runs");
await p.getByRole("button", { name: "Stop shop", exact: true }).click();
check(/Stopping/.test(await appRow(p, "shop").locator("button.main").innerText()), "compose: the main button says Stopping… while it works");
await p.waitForTimeout(3500);
check(/^Stopped$/.test((await appRow(p, "shop").locator(".app-state").innerText()).trim()) && /^Start$/.test((await appRow(p, "shop").locator("button.main").innerText()).trim()), "compose: Stop stops every container in the project (Stopped, button back to Start)");
await p.screenshot({ path: "/tmp/compose.png" });
await p.close();

// a service stopped from its own menu is said aloud
p = await open("running");
await settle(p);
await open_(p, "shop");
await p.getByRole("button", { name: "More actions for web", exact: true }).click();
await p.getByRole("menuitem", { name: "Stop", exact: true }).click();
await p.waitForFunction(() => /web stopped/.test(document.querySelector(".sr-only[role=status]")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
check(/web stopped/.test(await text(p, ".sr-only[role=status]")), "live region: stopping a service says \"web stopped\" in the status region");
await p.close();

// stopped: other tabs name the stopped VM and start it from there
p = await open("stopped");
await p.waitForSelector(".blank", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Images", exact: true }).click();
check(/default is stopped/.test(await text(p, ".empty")), "stopped: Images names the stopped VM");
await p.getByRole("button", { name: "Start default" }).click();
await p.waitForSelector(home, { timeout: 8000 }).catch(() => {});
await p.waitForTimeout(500);
check(await p.locator(home).count() > 0 && /Running/.test(await text(p, ".sidebar .brand")) && await p.locator(".home .vm-strip").count() === 0, "stopped: Start from Images brings the VM up on Containers");
await p.close();

// failed: one card with the reason and a retry
p = await open("failed");
await p.waitForSelector(".blank", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Start VM", exact: true }).click();
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
await p.waitForSelector(".blank", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Start VM", exact: true }).click();
await p.waitForSelector(".start-why", { timeout: 4000 }).catch(() => {});
check(/stuck from an earlier run/.test(await text(p, ".start-why")), "stuck: says the VM is stuck from an earlier run");
await p.getByRole("button", { name: "Force stop, then start" }).click();
await p.waitForSelector(home, { timeout: 8000 }).catch(() => {});
check(await p.locator(".start-why").count() === 0 && await p.locator(home).count() > 0 && /Running/.test(await text(p, ".sidebar .brand")), "stuck: force stop then start brings the VM up");
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
await settle(p);
await profileMenu(p);
await p.getByRole("menuitem", { name: /^Stop (the VM )?default$/ }).click();
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
await p.waitForSelector(".blank", { timeout: 4000 }).catch(() => {});
check(/is stopped/.test(await text(p, ".blank h2")) && await p.locator(".start-why").count() === 0 && await p.locator(".home .vm-strip").count() === 0, "stopfail: Force stop stops the VM, clears the card and the strip");
await p.close();

// a stale failure clears once the VM is running again (started elsewhere)
p = await open("failed");
await p.waitForSelector(".blank", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "Start VM", exact: true }).click();
await p.waitForSelector(".start-why", { timeout: 9000 }).catch(() => {});
await p.evaluate(() => window.__mock.setStatus("Running"));
await p.waitForSelector(".start-why", { state: "detached", timeout: 6000 }).catch(() => {});
await p.waitForSelector(home, { timeout: 6000 }).catch(() => {});
check(await p.locator(".start-why").count() === 0 && await p.locator(home).count() > 0 && await p.locator(".home .vm-strip").count() === 0, "failed: the failure clears once the VM is running, and the strip goes with it");
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

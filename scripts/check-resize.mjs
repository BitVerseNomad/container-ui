// Doctor's VM size row resizes the VM in one click (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
// SHOTS=<dir> also saves a screenshot of each state (r14-*.png).
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shots = process.env.SHOTS;
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };
const shot = (p, name) => (shots ? p.screenshot({ path: path.join(shots, `r14-${name}.png`) }) : null);

const browser = await chromium.launch();
async function open(query, doctor = true, viewport = { width: 980, height: 640 }) {
  const page = await browser.newPage({ viewport });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=desktop${query}`);
  await page.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
  // The home list first, as on opening the app, so its rows have been seen.
  await page.waitForSelector("ul.apps > li.app", { timeout: 4000 }).catch(() => {});
  // Watch for a command toast during the whole run: the row is the one place that reports it.
  await page.evaluate(() => { window.__toasts = 0; new MutationObserver(() => { if (document.querySelector(".cmd-toast")) window.__toasts++; }).observe(document.body, { childList: true, subtree: true }); });
  if (!doctor) return page;
  await page.getByRole("button", { name: /^Doctor/ }).click();
  await page.locator('.setup [data-setup="resources"]').waitFor({ timeout: 4000 }).catch(() => {});
  // The container checks fill the confirm's count; wait for them.
  await page.locator(".setup [data-key]").first().waitFor({ timeout: 4000 }).catch(() => {});
  return page;
}
const row = (p) => p.locator('.setup section [data-setup="resources"]');
const dialog = (p) => p.getByRole("alertdialog");
const focused = (p) => p.evaluate(() => ({ text: document.activeElement?.textContent ?? "", cls: document.activeElement?.className ?? "", tag: document.activeElement?.tagName, outline: getComputedStyle(document.activeElement).outlineStyle }));
const mock = (p) => p.evaluate(() => window.__mock.state());
const runningNames = async (p) => (await mock(p)).ctrs.filter((c) => c.state === "running").map((c) => c.name).sort().join(",");
const badge = (p) => p.locator(".nav-badge").innerText().catch(() => "");
const go = async (p) => { await row(p).getByRole("button", { name: /^Give it/ }).click(); await dialog(p).getByRole("button", { name: "Restart the VM" }).click(); };

// 1. The row: names the Mac and the size it offers, one button, Profiles as a link, not in Fix all.
let p = await open("");
const text = await row(p).innerText();
check(/The VM has 2 CPUs and 2 GiB/.test(text), "row: names the size");
check(/Your Mac has 32 GB, so the VM can have 6 CPUs and 8 GiB/.test(text), "row: the sentence names the Mac and the same numbers as the button");
const main = row(p).getByRole("button", { name: /^Give it 6 CPUs and 8 GiB: The VM has 2 CPUs and 2 GiB$/ });
check(await main.count() === 1, "row: one button that resizes");
check(!/primary/.test(await main.getAttribute("class")) && await p.locator(".setup button.primary").count() === 1, "row: Fix all stays the page's one green button");
check(await row(p).getByRole("button", { name: /^Change in Profiles: / }).evaluate((b) => b.classList.contains("link")), "row: Profiles is only a quiet link");
check(await p.locator(".setup [data-key='vm-memory']").count() === 0, "row: the kafka memory note doesn't repeat the row that fixes it");
const fixAll = p.getByRole("button", { name: /^Fix \d+ of \d+ problems$/ });
check(await fixAll.count() === 1, "Fix all: says one problem is left out of it");
await fixAll.click();
check(!/CPUs|restart/i.test(await dialog(p).innerText()), "Fix all: never restarts the VM");
await dialog(p).getByRole("button", { name: "Cancel" }).click();
await shot(p, "row");

// 2. The confirm: how many stop, that they start again, no restart-policy words.
const before = await runningNames(p);
await main.click();
const ask = await dialog(p).innerText();
check(/^Give the VM 6 CPUs and 8 GiB\?/.test(ask), "confirm: asks first, with the new size");
check(/Your 7 running containers stop and start again after \(about a minute\)\./.test(ask), `confirm: says they stop and come back (${ask.replace(/\n/g, " | ")})`);
check(!/on-failure|unless-stopped|restart setting/.test(ask), "confirm: no restart-policy jargon");
check(/Images, volumes and containers stay/.test(ask), "confirm: says nothing is lost");
await shot(p, "confirm");
await dialog(p).getByRole("button", { name: "Cancel" }).click();
check((await focused(p)).text === "Give it 6 CPUs and 8 GiB", "confirm: Cancel puts focus back on the button");

// 3. Running: progress in the row, everything that touches the VM locked, counts held still, even on another tab.
const badgeBefore = await badge(p);
const summaryBefore = await p.locator(".doctor-head .hint").innerText();
await main.click();
await dialog(p).getByRole("button", { name: "Restart the VM" }).click();
await p.waitForTimeout(400);
check(await row(p).locator(".mark .spin").count() === 1, "running: a spinner takes the row's icon");
check(/Restarting the VM with 6 CPUs and 8 GiB… about a minute/.test(await row(p).innerText()), "running: the row says what is happening and how long");
check(/Restarting the VM with 6 CPUs and 8 GiB/.test(await row(p).locator("[role=status]").innerText()), "running: one status line says it to VoiceOver");
check(await p.locator(".setup > .out-log, .doctor-head ~ .out-log").count() === 0 && await row(p).locator("details.out-more").evaluate((d) => !d.open), "running: Colima's output is folded inside the row, not a dark block above");
const btn = row(p).getByRole("button", { name: /^Restarting…/ });
check(await btn.count() === 1 && await btn.getAttribute("aria-disabled") === "true", "running: the pressed button stays, says Restarting…, and is locked");
await p.waitForTimeout(500);
check(await row(p).count() === 1, "running: the row stays while the VM is stopped");
check(!/Start the VM to also check/.test(await p.locator(".doctor-head .hint").innerText()), "running: the header doesn't ask to start the VM");
check(await p.locator(".doctor-head .hint").innerText() === summaryBefore && await badge(p) === badgeBefore, `running: the count and the badge hold still (${badgeBefore})`);
check(/Restarting/.test(await p.locator(".sidebar").innerText()), "running: the sidebar says the VM is restarting");
await shot(p, "running");
await p.evaluate(() => { window.__flips = []; new MutationObserver(() => { for (const b of document.querySelectorAll("ul.apps li.app")) { const t = b.querySelector(".app-state")?.textContent; const v = b.querySelector("button.main")?.textContent; if (t === "Stopped" || v === "Start") window.__flips.push(`${t}/${v}`); } }).observe(document.body, { childList: true, subtree: true, characterData: true }); });
await p.getByRole("button", { name: "Containers", exact: true }).click();
await p.waitForTimeout(300);
const strip = p.locator(".vm-strip-wrap");
check(/Restarting the VM with 6 CPUs and 8 GiB… about a minute/.test(await strip.innerText().catch(() => "")), "other tab: the VM strip shows the same line as Doctor");
check(await strip.locator(".vm-strip .mark .spin").count() === 1 && await strip.locator(".sdot").count() === 0, "other tab: a spinner, not a green dot, while the VM restarts");
check(await strip.getByRole("button", { name: "Cancel" }).count() === 0 && await strip.locator(".out-log").count() === 0, "other tab: no Cancel and no dark output block");
await p.locator(".sidebar [aria-haspopup=menu]").first().click().catch(() => {});
const vmItem = p.getByRole("menuitem", { name: /(Start|Stop) the VM default/ }).first();
check(await vmItem.count() === 1 && await vmItem.getAttribute("aria-disabled") === "true", "other tab: the sidebar's VM Start/Stop is locked");
await p.keyboard.press("Escape");
await shot(p, "other-tab");
// The starting phase: the VM is back, Compose and docker start are bringing the containers up.
// Wait until the VM runs again but Compose is still bringing shop up (the mock's up takes 1.2 s).
await p.waitForFunction(() => window.__mock.state().profiles[0].status === "Running" && !document.querySelector(".vm-strip-wrap .vm-line") && !window.__mock.state().ctrs.some((c) => c.name === "web" && c.state === "running"), null, { timeout: 8000 }).catch(() => {});
const phase = await p.evaluate(() => ({ vm: window.__mock.state().profiles[0].status, line: !!document.querySelector(".vm-strip-wrap .vm-line"), shopUp: window.__mock.state().ctrs.some((c) => c.name === "web" && c.state === "running") }));
await p.locator("ul.apps > li.app").first().waitFor({ timeout: 2000 }).catch(() => {});
await p.waitForTimeout(100);
const stepSaid = await p.locator("[data-resize-announcer][role=status]").innerText();
check(stepSaid === "Starting your 7 containers again…", `starting: the app says the step change, since its page is closed (${stepSaid})`);
check(phase.vm === "Running" && !phase.line && !phase.shopUp, `starting: caught the phase after the VM is back, before the containers are (${JSON.stringify(phase)})`);
const appsText = await p.locator("ul.apps").innerText().catch(() => "");
check(/Restarting…/.test(appsText) && !/Restarting with/.test(appsText), "starting: the Containers rows say Restarting…, on one line");
const stopNow = p.locator("ul.apps button.main", { hasText: /^Stop$/ });
check(await stopNow.count() >= 1 && (await stopNow.evaluateAll((l) => l.every((b) => b.getAttribute("aria-disabled") === "true"))), "starting: the buttons keep the label last seen (Stop), locked");
check(await p.locator("ul.apps .app-state").evaluateAll((l) => l.every((e) => getComputedStyle(e).whiteSpace === "nowrap")), "starting: the state word never wraps");
const stopBtn = p.locator("ul.apps button.main").first();
check(await stopBtn.getAttribute("aria-disabled") === "true", "starting: the rows' main buttons are locked");
const lockedLook = await p.locator("ul.apps button.small").evaluateAll((l) => l.every((b) => b.getAttribute("aria-disabled") !== "true" || Number(getComputedStyle(b).opacity) < 1));
check(lockedLook, "starting: every locked row button also looks locked");
await p.locator(".sidebar [aria-haspopup=menu]").first().click().catch(() => {});
check(await p.getByRole("menuitem", { name: /(Start|Stop) the VM default/ }).first().getAttribute("aria-disabled") === "true", "starting: the sidebar's VM Start/Stop is still locked after the VM is back");
await p.keyboard.press("Escape");
await shot(p, "starting-home");
await p.waitForFunction(() => [...document.querySelectorAll("[data-resize-announcer]")].some((e) => /running again/.test(e.textContent)), null, { timeout: 10000 }).catch(() => {});
const said = await p.locator("[data-resize-announcer]").allInnerTexts();
check(said.join(" ").includes("Your 7 containers are running again"), `other tab: the result is announced once by the app (${said.join(" / ")})`);
await p.waitForTimeout(400);
const afterRun = await p.locator("ul.apps").innerText().catch(() => "");
check(!/Stopped|Restarting/.test(afterRun), `other tab: right after, the rows say Running, not a stale Stopped (${afterRun.replace(/\n/g, " ").slice(0, 120)})`);
check((await p.evaluate(() => window.__flips)).length === 0, `other tab: no row ever flipped to Stopped or Start during the run (${(await p.evaluate(() => window.__flips)).slice(0, 3).join(", ")})`);
await p.getByRole("button", { name: /^Doctor/ }).click();
await p.locator(".setup .resize-result").waitFor({ timeout: 8000 }).catch(() => {});

// 4. Done: containers started again by the app, Compose first in its own order, result under the title.
const done = await row(p).innerText().catch(() => "");
check(/The VM has 6 CPUs and 8 GiB now\. Your 7 containers are running again\./.test(done), `done: one line says the size and that everything runs (${done.replace(/\n/g, " | ")})`);
check(await runningNames(p) === before, "done: every container that ran before runs again, with no click");
check((await p.evaluate(() => window.__composed ?? [])).length === 0, "done: no compose command ran (nothing recreated or rebuilt)");
const started = await p.evaluate(() => (window.__dockerStarted ?? []).map((w) => [...w].sort().join(",")));
check(started.join(" | ") === "db,queue | api,worker | kafka,kafka-ui,web", `done: plain docker start in waves, each service after what it depends on (${started.join(" | ")})`);
await p.waitForFunction(() => (window.__dbHealthAtStart ?? []).length >= 3, null, { timeout: 5000 }).catch(() => {});
const health = await p.evaluate(() => window.__dbHealthAtStart ?? []);
check(health[1] === "healthy", `done: api waited until db reported healthy (${JSON.stringify(health)})`);
check(await p.evaluate(() => window.__toasts) === 0, "done: no command toast during the whole run");
await p.getByRole("button", { name: /^Commands/ }).click().catch(() => {});
check(/colima stop default && colima start default --cpu 6 --memory 8/.test(await p.locator("body").innerText()), "done: the commands are still in All commands");
await p.keyboard.press("Escape");
await p.waitForTimeout(200);
check((await row(p).getAttribute("class")).includes("ok") && /The VM has 6 CPUs and 8 GiB$/m.test(await row(p).locator("b").innerText()), "done: the row passes with the new size, where it was");
check(await p.locator(".setup .fix-result.bad, .setup .error").count() === 0, "done: no red banner");
await shot(p, "done");
await row(p).getByRole("button", { name: "Dismiss" }).click();
await p.waitForTimeout(200);
const afterDismiss = await focused(p);
check(afterDismiss.tag === "BUTTON" && afterDismiss.text !== "Dismiss", `dismiss: focus moves on to the next button (${afterDismiss.text})`);
check(await row(p).count() === 0 && /The VM has 6 CPUs and 8 GiB/.test(await p.locator(".setup details.passing").first().textContent()), "dismiss: the row joins the passing checks");
check(p.errors.length === 0, `resize: no page errors ${p.errors.join("; ")}`);
await p.close();

// 5. Focus: on the result after a step, with a ring for the keyboard but not after a mouse click; in view above the toast.
p = await open("", true, { width: 965, height: 626 });
await go(p);
await p.locator(".setup .resize-result").waitFor({ timeout: 10000 }).catch(() => {});
await p.waitForTimeout(300);
const f = await focused(p);
check(/resize-result/.test(f.cls), "focus: moves to the result line");
check(f.outline === "none", "focus: no ring after a mouse click");
const inView = await p.evaluate(() => { const r = document.querySelector(".resize-status").getBoundingClientRect(); return r.bottom <= innerHeight - 60 && r.top >= 0; });
check(inView, "focus: at 965x626 the result and its buttons sit in view, clear of the toast's place");
await p.close();
p = await open("");
await row(p).getByRole("button", { name: /^Give it/ }).focus();
await p.keyboard.press("Enter");
await dialog(p).getByRole("button", { name: "Restart the VM" }).focus();
await p.keyboard.press("Enter");
await p.locator(".setup .resize-result").waitFor({ timeout: 10000 }).catch(() => {});
await p.waitForTimeout(300);
check((await focused(p)).outline !== "none", "focus: a visible ring when the run was started from the keyboard");
await p.close();

// 6. A container that won't start: named in plain words, with its own Start and See why.
p = await open("&start=fail");
await go(p);
await p.locator(".setup .resize-result").waitFor({ timeout: 10000 }).catch(() => {});
await p.waitForTimeout(300);
const part = await row(p).innerText();
check(/The VM has 6 CPUs and 8 GiB now\. 6 of 7 containers are running again\. web didn't start: port 8080 is in use on your Mac\./.test(part), `start fails: one line names the one that didn't start and why (${part.replace(/\n/g, " | ")})`);
check((part.match(/web didn't start/g) ?? []).length === 1, "start fails: the name isn't repeated");
const acts = row(p).locator(".resize-actions");
check((await acts.locator("button").allInnerTexts()).join(",") === "Start web,See why,Dismiss" && await acts.locator("button:not(.small)").count() === 0, "start fails: one row of small buttons, Start web, See why, Dismiss");
const why = acts.getByRole("button", { name: "See why web didn't start" });
const whyId = await why.getAttribute("aria-controls");
check(await p.locator(`#${whyId}`).isHidden(), "start fails: the reason is folded until asked for");
await why.click();
const whyText = await p.locator(`#${whyId}`).innerText();
check(await why.getAttribute("aria-expanded") === "true" && /press Start web\./.test(whyText) && !/Start again/.test(whyText), `start fails: See why opens the help it controls, naming the real button (${whyText})`);
check(await p.evaluate(() => window.__toasts) === 0, "start fails: no toast that could disagree with the row");
await shot(p, "start-fail");
const webLine = acts;
await webLine.getByRole("button", { name: "Start web" }).click();
check(await row(p).getByRole("button", { name: "Starting…" }).count() === 1, "start fails: the pressed Start web stays, saying Starting…");
await p.waitForTimeout(800);
check(/Your 7 containers are running again/.test(await row(p).innerText()) && /resize-result/.test((await focused(p)).cls), "start fails: Start web starts it, and focus is on the new result");
await p.close();

// 7. Not enough memory: plain words, the row stops offering 8 GiB, one step down first, the old size second.
p = await open("&resize=fail");
const before2 = await runningNames(p);
await go(p);
await p.locator(".setup .resize-result").waitFor({ timeout: 10000 }).catch(() => {});
const bad = await row(p).innerText().catch(() => "");
check(/8 GiB didn't fit in free memory\. The VM is stopped\./.test(bad), `fail: says why in one plain line (${bad.replace(/\n/g, " | ")})`);
check(!/can have 6 CPUs and 8 GiB|Your Mac has/.test(bad), "fail: the row sentence is hidden while the result shows");
check((await row(p).locator(".resize-actions button").allInnerTexts()).join(",") === "Try 6 CPUs and 6 GiB,Start it as it was (2 CPUs and 2 GiB),Dismiss", "fail: one row: Try 6 CPUs and 6 GiB, Start it as it was, Dismiss");
check(await row(p).getByRole("button", { name: /8 GiB/ }).count() === 0, "fail: no button names 8 GiB any more");
check(!/FATA|exit status/.test(bad.replace(/Show output[\s\S]*/, "")), "fail: no raw Colima output in the row");
check(/resize-result/.test((await focused(p)).cls), "fail: focus moves to the result line");
check(await p.locator(".setup [role=alert]").evaluateAll((l) => l.every((x) => !/memory/.test(x.textContent))) && (await p.locator("[data-resize-announcer]").allInnerTexts()).join("") === "", "fail: said once (focus on its page), not also by an alert");
const step = row(p).getByRole("button", { name: "Try 6 CPUs and 6 GiB" });
check(await step.count() === 1 && /primary/.test(await step.getAttribute("class")), "fail: the main button tries one step down");
check(await row(p).getByRole("button", { name: "Start it as it was (2 CPUs and 2 GiB)" }).count() === 1, "fail: the old size is the second button");
await shot(p, "fail");
await step.click();
await p.waitForTimeout(300);
check(await row(p).getByRole("button", { name: "Restarting…" }).count() === 1, "fail: the pressed button stays, saying Restarting…");
await p.locator(".setup .resize-result.ok").waitFor({ timeout: 10000 }).catch(() => {});
await p.waitForTimeout(300);
const prof = (await mock(p)).profiles[0];
check(prof.status === "Running" && prof.memory === 6 * 1024 ** 3, "fail: one step down fits");
check(/The VM has 6 CPUs and 6 GiB now\. Your 7 containers are running again\./.test(await row(p).innerText()) && await runningNames(p) === before2, "fail: after the step down, everything runs again");
await shot(p, "step-down");
check(p.errors.length === 0, `fail: no page errors ${p.errors.join("; ")}`);
await p.close();

// 8. Start it as it was, after a failure.
p = await open("&resize=fail");
await go(p);
await p.locator(".setup .resize-result").waitFor({ timeout: 10000 }).catch(() => {});
await row(p).getByRole("button", { name: /^Start it as it was/ }).click();
await p.locator(".setup .resize-result.ok").waitFor({ timeout: 10000 }).catch(() => {});
await p.waitForTimeout(300);
const prof2 = (await mock(p)).profiles[0];
check(prof2.status === "Running" && prof2.cpus === 2 && /Your 7 containers are running again/.test(await row(p).innerText()), "as it was: the VM is back at its old size and the containers run again");
await p.close();

// 8b. Kubernetes pods are left to Kubernetes: not counted, not started by hand, and the lines say so.
p = await open("&pods=1");
await row(p).getByRole("button", { name: /^Give it/ }).click();
const askK = await dialog(p).innerText();
check(/Your 7 running containers stop and start again after \(about a minute\)\. Kubernetes brings its pods back on its own\./.test(askK), `pods: the confirm doesn't count the pod and says Kubernetes brings it back (${askK.replace(/\n/g, " | ")})`);
await dialog(p).getByRole("button", { name: "Restart the VM" }).click();
await p.locator(".setup .resize-result").waitFor({ timeout: 15000 }).catch(() => {});
check(/Your 7 containers are running again\. Kubernetes brings its pods back on its own\./.test(await row(p).innerText()), "pods: the done line counts 7 and says Kubernetes brings its pods back");
check(!(await p.evaluate(() => window.__dockerStarted ?? [])).flat().some((n) => /^k8s_/.test(n)), "pods: the pod's container is never started by hand");
await p.close();

// 9. Out of memory on the Containers screen: one control, named for the VM.
p = await open("", false);
await p.waitForSelector("ul.apps > li.app", { timeout: 4000 }).catch(() => {});
const oom = p.getByRole("button", { name: /^Give the VM 8 GiB: .*report-job/ });
await oom.first().waitFor({ timeout: 3000 }).catch(() => {});
check(await oom.count() === 1, "out of memory: the container's line offers Give the VM 8 GiB");
check(await p.getByRole("button", { name: /^Change in Profiles: .*report-job/ }).count() === 0, "out of memory: one control on the line, no Profiles link");
await shot(p, "oom-home");
await oom.click();
check(/^Give the VM 8 GiB of memory\?/.test(await dialog(p).innerText()), "out of memory: the confirm names only the memory");
await dialog(p).getByRole("button", { name: "Cancel" }).click();
await p.close();

await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

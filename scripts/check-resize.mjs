// Doctor's VM size row resizes the VM in one click (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
// SHOTS=<dir> also saves a screenshot of each state (r39-*.png). Every state's picture must differ (md5).
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
const shot = async (p, name) => { const b = await p.screenshot(shots ? { path: path.join(shots, `r39-${name}.png`) } : {}); md5s.set(name, createHash("md5").update(b).digest("hex")); };

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
const main = row(p).getByRole("button", { name: /^Give it 6 CPUs and 8 GiB…: The VM has 2 CPUs and 2 GiB$/ });
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
check((await focused(p)).text === "Give it 6 CPUs and 8 GiB…", "confirm: Cancel puts focus back on the button");

// 3. Running: progress in the row, everything that touches the VM locked, counts held still, even on another tab.
const badgeBefore = await badge(p);
const summaryBefore = await p.locator(".doctor-head .hint").innerText();
await main.click();
await dialog(p).getByRole("button", { name: "Restart the VM" }).click();
await p.waitForTimeout(400);
check(await row(p).locator(".mark .spin").count() === 1, "running: a spinner takes the row's icon");
check(/Restarting the VM with 6 CPUs and 8 GiB… about a minute/.test(await row(p).innerText()), "running: the row says what is happening and how long");
check(/Restarting the VM with 6 CPUs and 8 GiB/.test(await row(p).locator("[role=status]").first().innerText()), "running: one status line says it to VoiceOver");
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
check(stepSaid === "Starting everything that was running…", `starting: the app says the step change, since its page is closed (${stepSaid})`);
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
// The ring on the switcher is this check's own Escape (the menu hands focus back to its button), shown only as
// :focus-visible. Moved off it, nothing in the app puts focus back there for the rest of the run.
check(await p.evaluate(() => document.activeElement?.classList.contains("profile-switch") && document.activeElement.matches(":focus-visible")), "starting: the switcher's ring is the check's keyboard Escape, as :focus-visible");
await p.evaluate(() => { document.activeElement?.blur(); window.__switchFocus = 0; document.querySelector(".profile-switch")?.addEventListener("focus", () => { window.__switchFocus += 1; }); });
check(await p.locator("ul.apps").innerText().then((t) => !/is stopped|are stopped/.test(t)), "starting: no 'is stopped' line while the VM is resized (what ran is about to start)");
await shot(p, "starting-home");
await p.waitForFunction(() => [...document.querySelectorAll("[data-resize-announcer]")].some((e) => /is running again/.test(e.textContent)), null, { timeout: 10000 }).catch(() => {});
const said = await p.locator("[data-resize-announcer]").allInnerTexts();
check(await p.evaluate(() => window.__switchFocus) === 0, "other tab: the app never moves focus to the VM switcher during the restart");
check(said.join(" ").includes("Everything that was running is running again"), `other tab: the result is announced once by the app (${said.join(" / ")})`);
await p.waitForTimeout(400);
const afterRun = await p.locator("ul.apps").innerText().catch(() => "");
check(!/Stopped|Restarting/.test(afterRun), `other tab: right after, the rows say Running, not a stale Stopped (${afterRun.replace(/\n/g, " ").slice(0, 120)})`);
check((await p.evaluate(() => window.__flips)).length === 0, `other tab: no row ever flipped to Stopped or Start during the run (${(await p.evaluate(() => window.__flips)).slice(0, 3).join(", ")})`);
await p.getByRole("button", { name: /^Doctor/ }).click();
await p.locator(".setup .resize-result").waitFor({ timeout: 8000 }).catch(() => {});

// 4. Done: containers started again by the app, Compose first in its own order, result under the title.
const done = await row(p).innerText().catch(() => "");
check(/The VM has 6 CPUs and 8 GiB now\. Everything that was running is running again\./.test(done), `done: one line says the size and that everything runs (${done.replace(/\n/g, " | ")})`);
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
check(/The VM has 6 CPUs and 8 GiB now\. Everything else that was running is running again\. web didn't start: port 8080 is in use on your Mac\./.test(part), `start fails: one line names the one that didn't start and why (${part.replace(/\n/g, " | ")})`);
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
check(/Everything that was running is running again/.test(await row(p).innerText()) && /resize-result/.test((await focused(p)).cls), "start fails: Start web starts it, and focus is on the new result");
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
check(/The VM has 6 CPUs and 6 GiB now\. Everything that was running is running again\./.test(await row(p).innerText()) && await runningNames(p) === before2, "fail: after the step down, everything runs again");
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
check(prof2.status === "Running" && prof2.cpus === 2 && /Everything that was running is running again/.test(await row(p).innerText()), "as it was: the VM is back at its old size and the containers run again");
await p.close();

// 8b. Kubernetes pods are left to Kubernetes: not counted, not started by hand, and the lines say so.
p = await open("&pods=1");
await row(p).getByRole("button", { name: /^Give it/ }).click();
const askK = await dialog(p).innerText();
check(/Your 7 running containers stop and start again after \(about a minute\)\. Kubernetes brings its pods back on its own\./.test(askK), `pods: the confirm doesn't count the pod and says Kubernetes brings it back (${askK.replace(/\n/g, " | ")})`);
await dialog(p).getByRole("button", { name: "Restart the VM" }).click();
await p.locator(".setup .resize-result").waitFor({ timeout: 15000 }).catch(() => {});
check(/Everything that was running is running again\. Kubernetes brings its pods back on its own\./.test(await row(p).innerText()), "pods: the done line counts 7 and says Kubernetes brings its pods back");
check(!(await p.evaluate(() => window.__dockerStarted ?? [])).flat().some((n) => /^k8s_/.test(n)), "pods: the pod's container is never started by hand");
await p.close();

// 9. Out of memory on the Containers screen: one control, named for the VM.
p = await open("", false);
await p.waitForSelector("ul.apps > li.app", { timeout: 4000 }).catch(() => {});
const oom = p.getByRole("button", { name: /^Give the VM 8 GiB…: .*report-job/ });
await oom.first().waitFor({ timeout: 3000 }).catch(() => {});
check(await oom.count() === 1, "out of memory: the container's line offers Give the VM 8 GiB…");
check(await p.getByRole("button", { name: /^Change in Profiles: .*report-job/ }).count() === 0, "out of memory: one control on the line, no Profiles link");
await shot(p, "oom-home");
await oom.click();
check(/^Give the VM 8 GiB of memory\?/.test(await dialog(p).innerText()), "out of memory: the confirm names only the memory");
await dialog(p).getByRole("button", { name: "Restart the VM" }).click();
const oomRow = p.locator("ul.apps > li.app", { hasText: "shop" }).first();
const kafkaLines = async () => (await p.locator("ul.apps .problem").allInnerTexts()).filter((t) => /kafka/i.test(t)).length;
// Kafka's lines are about Kafka, not the VM: the same before and after.
const kafkaBefore = await kafkaLines();
// Once report-job runs, its red line goes and the result has its own row under the project.
await oomRow.locator(".problem.result .resize-result").waitFor({ timeout: 20000 }).catch(() => {});
const oomDone = await oomRow.locator(".problem.result .resize-result").innerText().catch(() => "");
check(/^The VM has (\d+ CPUs and )?8 GiB now\. Everything that was running is running again, and report-job started again\.$/.test(oomDone.trim()), `out of memory: the result says what changed, counts what ran, and that report-job started again (${oomDone})`);
check(!/CPUs/.test(oomDone) || (await mock(p)).cpus !== 2, "out of memory: CPUs are named only when they changed");
check(await oomRow.locator(".problem.bad", { hasText: "report-job" }).count() === 0, "out of memory: report-job's red line is gone once it runs");
const okRow = await oomRow.locator(".problem.result").evaluate((el) => ({ bg: getComputedStyle(el).backgroundColor, ink: getComputedStyle(el.querySelector(".resize-result")).color, icon: getComputedStyle(el.querySelector(".resize-result svg")).color, ok: el.querySelector(".resize-result").classList.contains("ok"), dismissRight: Math.round(el.querySelector(".fix-dismiss").getBoundingClientRect().right), rowRight: Math.round(el.getBoundingClientRect().right - parseFloat(getComputedStyle(el).paddingRight)) })).catch(() => null);
const offBg = await p.evaluate(() => { const d = document.createElement("div"); d.className = "problem off"; document.querySelector("ul.apps li.app").append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });
check(!!okRow && okRow.ok && okRow.bg === offBg && okRow.dismissRight === okRow.rowRight, `out of memory: the result row has the down line's tint, a check, and Dismiss on the right edge (${JSON.stringify(okRow)} vs ${offBg})`);
check(/resize-result/.test((await focused(p)).cls), "out of memory: focus moves to the result in its new row");
check(await kafkaLines() === kafkaBefore && kafkaBefore > 0, `out of memory: kafka and kafka-ui keep their lines after the resize (${kafkaBefore} before, ${await kafkaLines()} after)`);
const startsOom = await p.evaluate(() => window.__dockerStarted ?? []);
check(startsOom.flat().filter((n) => n === "report-job").length === 1 && JSON.stringify(startsOom[startsOom.length - 1]) !== JSON.stringify(["report-job"]), `out of memory: report-job starts once, in its depends_on place with the others (${JSON.stringify(startsOom)})`);
check((await mock(p)).ctrs.find((c) => c.name === "report-job").state === "running", "out of memory: report-job runs");
// The success row as it stands, before Dismiss.
await shot(p, "oom-started");
// shop is the last row: Dismiss hands focus to shop's own name, not to nothing.
await oomRow.locator(".problem.result").getByRole("button", { name: "Dismiss" }).click();
check(await p.evaluate(() => document.activeElement?.classList.contains("app-name") && document.activeElement.textContent === "shop"), `out of memory: Dismiss on the last row puts focus on its name (${await p.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`)})`);
await p.close();

// 10. Out of memory, and it still won't start: its own "didn't start" line, with Start and See why.
p = await open("&oomfail=1", false);
await p.waitForSelector("ul.apps > li.app", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: /^Give the VM 8 GiB…: .*report-job/ }).first().click();
await dialog(p).getByRole("button", { name: "Restart the VM" }).click();
const failRow = p.locator("ul.apps > li.app", { hasText: "shop" }).first();
await failRow.locator(".resize-result").waitFor({ timeout: 15000 }).catch(() => {});
const oomBad = await failRow.locator(".resize-result").innerText().catch(() => "");
check(/^The VM has (\d+ CPUs and )?8 GiB now\. Everything that was running is running again\. report-job didn't start: 8 GiB still isn't enough for it\. Give the VM more memory, or make report-job use less\.$/.test(oomBad.trim()), `oom fails: one line says 8 GiB still isn't enough, and what to do (${oomBad})`);
// The failure stays in the red line, with the ✕ in --dot-bad, and its buttons under the text, not the icon.
const oomIcon = await failRow.locator(".problem.bad .resize-result").evaluate((el) => ({ use: el.querySelector("svg use")?.getAttribute("href") ?? el.querySelector("svg").innerHTML.slice(0, 40), color: getComputedStyle(el.querySelector("svg")).color, dot: getComputedStyle(document.documentElement).getPropertyValue("--dot-bad").trim(), text: Math.round(el.querySelector("span").getBoundingClientRect().left), first: Math.round(el.parentElement.querySelector(".resize-actions button").getBoundingClientRect().left) })).catch(() => null);
const closeIcon = await p.evaluate(() => { const r = document.querySelector(".problem.bad > .problem-lead > svg"); return r ? (r.querySelector("use")?.getAttribute("href") ?? r.innerHTML.slice(0, 40)) : null; });
const dotRgb = await p.evaluate((v) => { const d = document.createElement("span"); d.style.color = v; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; }, oomIcon?.dot ?? "");
check(!!oomIcon && oomIcon.use === closeIcon && oomIcon.color === dotRgb, `oom fails: the result icon is the ✕ in --dot-bad (${JSON.stringify(oomIcon)}, ${closeIcon}, ${dotRgb})`);
check(!!oomIcon && Math.abs(oomIcon.first - oomIcon.text) <= 1, `oom fails: the action row starts under the text (${oomIcon?.first} vs ${oomIcon?.text})`);
// Start would fail the same way: the way to more memory leads, then See why and Dismiss.
const failButtons = await failRow.locator(".problem.bad .resize-actions button").allInnerTexts();
check(/^(Give the VM \d+ GiB…|Change in Profiles)$/.test(failButtons[0] ?? "") && failButtons[1] === "See why" && failButtons[2] === "Dismiss" && !failButtons.includes("Start report-job"), `oom fails: more memory first (a bigger size, else Profiles), then See why, Dismiss; no Start (${failButtons.join(", ")})`);
const firstCls = await failRow.locator(".problem.bad .resize-actions button").first().getAttribute("class");
check(/\bsmall\b/.test(firstCls ?? "") && !/primary/.test(firstCls ?? ""), `oom fails: Give the VM 12 GiB… is a plain small button, not a filled primary (${firstCls})`);
const nextSize = Number((failButtons[0] ?? "").match(/(\d+) GiB/)?.[1] ?? 0);
check(nextSize === 12, `oom fails: on a 32 GB Mac the next step is offered, Give the VM 12 GiB… (${failButtons[0]})`);
await shot(p, "oom-failed");
await p.close();

// 11. report-job hit its own 256 MiB limit. Home shows one button, chosen by what compose.yaml says now.
const homeLimit = async (q) => {
  const pg = await open(q, false);
  await pg.waitForSelector("ul.apps > li.app", { timeout: 4000 }).catch(() => {});
  await pg.waitForTimeout(1400);
  return pg;
};
const limRowOf = (pg) => pg.locator("ul.apps > li.app", { hasText: "shop" }).first().locator(".problem.bad, .problem.off").filter({ hasText: /compose\.yaml/ }).first();
const lineOf = async (pg) => (await limRowOf(pg).innerText().catch(() => "")).replace(/\n/g, " ").trim();
const buttonsOf = (pg) => limRowOf(pg).locator("button").allInnerTexts();
// The icon sits on the first line of the text, and the button stays centered against the line.
const iconOnFirstLine = (pg) => limRowOf(pg).evaluate((row) => {
  const r = (el) => el.getBoundingClientRect();
  const icon = row.querySelector(".problem-lead > svg"), text = row.querySelector(".problem-text"), btn = row.querySelector("button");
  const first = parseFloat(getComputedStyle(text).lineHeight);
  const iconMid = (r(icon).top + r(icon).bottom) / 2, lineMid = r(text).top + first / 2;
  const btnMid = (r(btn).top + r(btn).bottom) / 2, rowMid = (r(row).top + r(row).bottom) / 2;
  return { lines: Math.round(r(text).height / first), iconOff: Math.round((iconMid - lineMid) * 10) / 10, btnOff: Math.round((btnMid - rowMid) * 10) / 10 };
});


// a. The file still sets 256 MiB: Open compose.yaml, alone, on the right edge.
p = await homeLimit("&limit=1");
check(/^report-job · hit its own 256 MiB memory limit \(set in compose\.yaml\) Open compose\.yaml$/.test(await lineOf(p)), `limit: unchanged, the line says the limit and offers Open compose.yaml (${await lineOf(p)})`);
check(JSON.stringify(await buttonsOf(p)) === JSON.stringify(["Open compose.yaml"]), `limit: one button (${(await buttonsOf(p)).join(", ")})`);
const edgeOf = (pg, name) => limRowOf(pg).getByRole("button", { name }).evaluate((b) => { const row = b.closest(".problem"); return Math.round(row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight)) === Math.round(b.getBoundingClientRect().right); });
check(await edgeOf(p, /^Open compose\.yaml/), "limit: the button sits on the line's right edge");
check(await limRowOf(p).locator(".problem-text code").evaluate((el) => el.textContent === "compose.yaml" && /monospace/.test(getComputedStyle(el).fontFamily)).catch(() => false), "limit: compose.yaml is in the code font");
await limRowOf(p).getByRole("button", { name: "Open compose.yaml: report-job" }).click();
await p.waitForFunction(() => (window.__opened ?? []).length > 0, null, { timeout: 3000 }).catch(() => {});
check(JSON.stringify(await p.evaluate(() => window.__opened ?? [])) === JSON.stringify(["/Users/me/code/shop/compose.yaml"]), "limit: Open compose.yaml opens the listed file");
await p.mouse.move(5, 600);
await shot(p, "limit-home");
// b. Saved with 1 GiB, then back to the app: the window's focus reads the file again and the button flips. Focus was on
// Open compose.yaml, so it moves to the new button, and the polite region says what changed.
await limRowOf(p).getByRole("button", { name: "Open compose.yaml: report-job" }).focus();
await p.evaluate(() => { window.__shopLimit = 1024 ** 3; window.dispatchEvent(new Event("focus")); });
await p.waitForFunction(() => /is now 1 GiB/.test(document.querySelector("ul.apps")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
check(/^report-job · its limit in compose\.yaml is now 1 GiB \(was 256 MiB\)\. Apply it to start\. Apply and start$/.test(await lineOf(p)), `limit: after a save and focus, the line says the new limit and the old one (${await lineOf(p)})`);
check(await limRowOf(p).evaluate((el) => el.classList.contains("off") && !!el.querySelector(":scope > .problem-lead > svg")), "limit: raised, the line has the neutral stopped tint, not the red one (nothing is failing)");
check(await p.evaluate(() => document.activeElement?.getAttribute("aria-label")) === "Apply and start report-job", `limit: focus moved from the old button to Apply and start (${await p.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName)})`);
await p.waitForFunction(() => /The button is now/.test(document.querySelector(".sr-only[role=status]")?.textContent ?? ""), null, { timeout: 3000 }).catch(() => {});
check((await p.locator(".sr-only[role=status]").first().textContent()).trim() === "compose.yaml now sets 1 GiB for report-job. The button is now Apply and start.", `limit: the change is said politely (${await p.locator(".sr-only[role=status]").first().textContent()})`);
await p.evaluate(() => document.activeElement?.blur());
const applyBtn = limRowOf(p).getByRole("button", { name: "Apply and start report-job", exact: true });
check(await applyBtn.count() === 1 && /\bsmall\b/.test(await applyBtn.getAttribute("class")) && !/primary/.test(await applyBtn.getAttribute("class")) && JSON.stringify(await buttonsOf(p)) === JSON.stringify(["Apply and start"]), `limit: raised, the one button is a plain small Apply and start; home keeps one filled primary (${await applyBtn.getAttribute("class")})`);
check(await edgeOf(p, "Apply and start report-job"), "limit: Apply and start sits on the right edge");
await shot(p, "limit-home-raised");
await applyBtn.click();
const starting = await limRowOf(p).getByRole("button", { name: "Starting report-job", exact: true }).textContent({ timeout: 2000 }).catch(() => "");
check(starting === "Starting…", `limit: while it runs, home's button reads Starting… and is named Starting report-job (${starting})`);
await p.evaluate(() => document.activeElement?.blur());
await p.waitForFunction(() => /Starting report-job…/.test(document.querySelector(".sr-only[role=status]")?.textContent ?? ""), null, { timeout: 3000 }).catch(() => {});
check(/^Starting report-job…$/.test((await p.locator(".sr-only[role=status]").first().textContent()).trim()), `limit: says Starting report-job… (${await p.locator(".sr-only[role=status]").first().textContent()})`);
await p.waitForFunction(() => /started with its new limit/.test(document.querySelector(".sr-only[role=status]")?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
check(/^report-job started with its new limit\.$/.test((await p.locator(".sr-only[role=status]").first().textContent()).trim()), "limit: says report-job started with its new limit.");
const composed = await p.evaluate(() => window.__composed ?? []);
check(JSON.stringify(composed[composed.length - 1]) === JSON.stringify({ file: "/Users/me/code/shop/compose.yaml", action: "up", context: "colima", service: "report-job" }), `limit: Apply and start runs compose for report-job alone (${JSON.stringify(composed)})`);
await p.waitForFunction(() => !/256 MiB|is now 1 GiB/.test(document.querySelector("ul.apps")?.textContent ?? ""), null, { timeout: 35000 }).catch(() => {});
check(!/256 MiB|is now 1 GiB/.test(await p.locator("ul.apps").innerText()), "limit: once report-job runs with the new limit, its line goes");
check(await p.evaluate(() => document.activeElement?.classList.contains("app-name") && document.activeElement.textContent === "shop"), `limit: the line went under focus, and shop's name has it (${await p.evaluate(() => document.activeElement?.className)})`);
await p.close();

// c. Raised, but db (which report-job needs) is stopped: the project's Start, since Apply leaves db as it is.
p = await homeLimit("&limit=1&raised=1&down2=1&needdb=1");
check(/^report-job · its limit in compose\.yaml is now 1 GiB \(was 256 MiB\)\. Start shop first: report-job needs db\. Start shop$/.test(await lineOf(p)) && await limRowOf(p).getByRole("button", { name: "Start shop: report-job needs db" }).count() === 1, `limit: with db stopped, the line offers Start shop instead (${await lineOf(p)})`);
const cAlign = await iconOnFirstLine(p);
check(Math.abs(cAlign.iconOff) <= 1 && Math.abs(cAlign.btnOff) <= 1, `limit: raised with db stopped, the icon is on the first line and the button centered (${JSON.stringify(cAlign)})`);
await p.close();

// d. Compose can't read the file: the unchanged line, and nothing said about the current value.
p = await homeLimit("&limit=1&raised=1&badconfig=1");
check(/^report-job · hit its own 256 MiB memory limit \(set in compose\.yaml\) Open compose\.yaml$/.test(await lineOf(p)) && !/is now|still sets/.test(await lineOf(p)), `limit: unreadable config, the line stays as it was (${await lineOf(p)})`);
await p.close();

// d2. No editor registered for YAML: TextEdit opens it, so the line says so before any click and the button reads
// Open in TextEdit. The click opens at once.
p = await homeLimit("&limit=1&textedit=1");
const openBtn = limRowOf(p).getByRole("button", { name: "Open in TextEdit: compose.yaml, report-job" });
check(await openBtn.count() === 1 && (await openBtn.textContent()) === "Open in TextEdit", `limit: TextEdit, the button reads Open in TextEdit (${await limRowOf(p).locator("button").allInnerTexts()})`);
const hintText = (await limRowOf(p).locator(".limit-hint").innerText().catch(() => "")).trim();
check(hintText === "It opens in TextEdit: turn off Edit > Substitutions > Smart Quotes before you type." && await limRowOf(p).locator(".limit-hint").getAttribute("aria-hidden") === null, `limit: before any click, the line says how to keep smart quotes out (${hintText})`);
const tAlign = await iconOnFirstLine(p);
check(tAlign.lines >= 2 && Math.abs(tAlign.iconOff) <= 1 && Math.abs(tAlign.btnOff) <= 1, `limit: two lines, the icon on the first, the button centered (${JSON.stringify(tAlign)})`);
await p.mouse.move(5, 600);
await shot(p, "limit-home-textedit");
await openBtn.click();
await p.waitForFunction(() => (window.__opened ?? []).length === 1, null, { timeout: 1000 }).catch(() => {});
check((await p.evaluate(() => window.__opened ?? [])).length === 1, "limit: the click opens at once");
await p.close();

// d2b. open takes a while: Opening…, disabled, and a second press does nothing.
p = await homeLimit("&limit=1&openslow=1");
await limRowOf(p).getByRole("button", { name: "Open compose.yaml: report-job" }).click();
const going = limRowOf(p).getByRole("button", { name: "Opening…: compose.yaml" });
check(await going.count() === 1 && (await going.textContent()) === "Opening…" && await going.getAttribute("aria-disabled") === "true", "limit: while open runs, the button reads Opening… and is disabled");
// Playwright waits for an aria-disabled button to be enabled before it clicks, so the press is sent straight away.
await going.dispatchEvent("click");
await p.mouse.move(5, 600);
await shot(p, "limit-home-opening");
await limRowOf(p).getByRole("button", { name: "Open compose.yaml: report-job" }).waitFor({ timeout: 5000 }).catch(() => {});
check((await p.evaluate(() => window.__opened ?? [])).length === 1 && await limRowOf(p).getByRole("button", { name: "Open compose.yaml: report-job" }).count() === 1, `limit: a second press did nothing, and Open is back once it opened (${JSON.stringify(await p.evaluate(() => window.__opened ?? []))} ${await buttonsOf(p)})`);
await p.close();

// d2c. The app is known: the button names it, and its name starts with those words. When the app changes while the
// button has focus (a new default set in Finder, read when the window gets focus), focus moves to the new button.
p = await homeLimit("&limit=1&app=Cursor");
const cursorBtn = limRowOf(p).getByRole("button", { name: "Open in Cursor: compose.yaml, report-job" });
check(await cursorBtn.count() === 1 && (await cursorBtn.textContent()) === "Open in Cursor", `limit: the button names the app (${await limRowOf(p).locator("button").allInnerTexts()})`);
const named = await limRowOf(p).locator("button").evaluateAll((bs) => bs.every((b) => b.getAttribute("aria-label").startsWith(b.textContent)));
check(named, "limit: the button's name starts with its visible words");
await p.mouse.move(5, 600);
await shot(p, "limit-home-cursor");
await cursorBtn.focus();
await p.evaluate(() => { window.__editorApp = "TextEdit"; window.dispatchEvent(new Event("focus")); });
await p.waitForFunction(() => /It now opens in TextEdit/.test(document.querySelector(".sr-only[role=status]")?.textContent ?? ""), null, { timeout: 3000 }).catch(() => {});
check(await p.evaluate(() => document.activeElement?.getAttribute("aria-label")) === "Open in TextEdit: compose.yaml, report-job" && (await p.locator(".sr-only[role=status]").first().textContent()).trim() === "It now opens in TextEdit.", `limit: the app changed under focus, focus moved to the new button and it was said (${await p.evaluate(() => document.activeElement?.getAttribute("aria-label"))})`);
await p.close();

// d2d. A long app name: the button keeps its words on one line and the text wraps beside it cleanly.
p = await homeLimit("&limit=1&app=Visual%20Studio%20Code");
const longBtn = limRowOf(p).getByRole("button", { name: "Open in Visual Studio Code: compose.yaml, report-job" });
const longFit = await longBtn.evaluate((b) => ({ oneLine: b.getBoundingClientRect().height <= parseFloat(getComputedStyle(b).lineHeight) + 10, overflow: b.scrollWidth > b.clientWidth })).catch(() => null);
const lAlign = await iconOnFirstLine(p);
check(!!longFit && longFit.oneLine && !longFit.overflow && Math.abs(lAlign.iconOff) <= 1 && Math.abs(lAlign.btnOff) <= 1, `limit: a long app name stays on one line in its button; icon on the first line, button centered (${JSON.stringify({ ...longFit, ...lAlign })})`);
await p.mouse.move(5, 600);
await shot(p, "limit-home-longname");
await p.close();

// d3. macOS can't open it: one sentence naming the app, and Open becomes Show in Finder, with focus on it.
p = await homeLimit("&limit=1&openfail=1");
await limRowOf(p).getByRole("button", { name: "Open compose.yaml: report-job" }).click();
const failSaid = "Couldn't open compose.yaml in Cursor: the application can't be opened. Open it from Finder.";
await p.waitForFunction((t) => (document.querySelector(".sr-only[role=alert]")?.textContent ?? "").trim() === t, failSaid, { timeout: 3000 }).catch(() => {});
check((await p.locator(".sr-only[role=alert]").first().textContent()).trim() === failSaid, `limit: a failed open names the app and the way out (${await p.locator(".sr-only[role=alert]").first().textContent()})`);
check((await limRowOf(p).locator(".limit-hint").innerText().catch(() => "")).trim() === failSaid && JSON.stringify(await buttonsOf(p)) === JSON.stringify(["Show in Finder"]) && await limRowOf(p).getByRole("button", { name: "Show in Finder: compose.yaml" }).count() === 1, `limit: the line shows it once, with Show in Finder (named Show in Finder: compose.yaml) (${(await buttonsOf(p)).join(", ")})`);
check(await limRowOf(p).locator(".limit-hint code").evaluate((el) => el.textContent === "compose.yaml" && /monospace/.test(getComputedStyle(el).fontFamily)).catch(() => false), "limit: compose.yaml in the failure is in the code font");
const fAlign = await iconOnFirstLine(p);
check(fAlign.lines >= 2 && Math.abs(fAlign.iconOff) <= 1 && Math.abs(fAlign.btnOff) <= 1, `limit: the failure line keeps the icon on its first line and the button centered (${JSON.stringify(fAlign)})`);
check(await p.evaluate(() => document.activeElement?.getAttribute("aria-label")) === "Show in Finder: compose.yaml", "limit: focus moved to Show in Finder");
check(await limRowOf(p).locator("button").evaluateAll((bs) => bs.every((b) => b.getAttribute("aria-label").startsWith(b.textContent))), "limit: Show in Finder's name starts with its visible words");
await p.mouse.move(5, 600);
await shot(p, "limit-home-openfail");
await limRowOf(p).getByRole("button", { name: "Show in Finder: compose.yaml" }).click();
await p.waitForFunction(() => (window.__revealed ?? []).length > 0, null, { timeout: 3000 }).catch(() => {});
check(JSON.stringify(await p.evaluate(() => window.__revealed ?? [])) === JSON.stringify(["/Users/me/code/shop/compose.yaml"]), "limit: Show in Finder reveals the file");
await p.close();

// e. Doctor: both buttons, the file first and Apply on the right; Apply pressed before the edit doesn't run.
p = await open("&limit=1", false);
await p.getByRole("button", { name: /^Doctor/ }).click();
await p.locator(".doctor").waitFor({ timeout: 4000 }).catch(() => {});
await p.waitForTimeout(1400);
const limDoc = p.locator(".doctor li", { hasText: "256 MiB memory limit" }).first();
const docText = (await limDoc.locator(".hint").first().innerText().catch(() => "")).replace(/\n/g, " ");
check(/report-job is allowed 256 MiB and used more, so Docker stopped it\. A bigger VM won't help: raise its memory limit in compose\.yaml, then press Apply and start\./.test(docText), `limit: Doctor says what to change, then Apply and start (${docText})`);
const docButtons = await limDoc.locator(".limit-actions button").allInnerTexts();
check(JSON.stringify(docButtons) === JSON.stringify(["Open compose.yaml", "Apply and start"]) && await limDoc.getByRole("button", { name: "Apply and start report-job", exact: true }).count() === 1, `limit: Doctor has Open compose.yaml, then Apply and start (${docButtons.join(", ")})`);
check(await limDoc.locator(".resize-result.warn").count() === 0, "limit: Doctor shows no refusal before Apply is pressed");
// The buttons sit in a row under the text and end where the other rows' buttons end (before the menu column); the
// body keeps the row's width.
const layout = await limDoc.evaluate((li) => {
  const r = (el) => el.getBoundingClientRect();
  const text = li.querySelector(":scope > div"), row = li.querySelector(".limit-actions .actions-inline");
  const sibling = [...document.querySelectorAll(".doctor li.finding:not(.limit) .finding-actions")].map((a) => a.querySelector("button.small:not(.more)")).find(Boolean);
  const track = parseFloat(getComputedStyle(li).gridTemplateColumns.split(" ")[1]);
  return { textW: Math.round(r(text).width), want: Math.round(Math.min(track, parseFloat(getComputedStyle(text).maxWidth) || track)), below: r(row).top >= r(text).bottom - 1, rightGap: sibling ? Math.round(r(sibling).right - r(row).right) : null, sameRow: Math.abs(r(row).top - r(text).top) < 4 };
});
check(layout.below && !layout.sameRow && Math.abs(layout.rightGap) <= 1 && layout.textW >= layout.want - 2, `limit: Doctor's buttons are a row under the text, ending where the other rows' buttons end, and the body runs full width (${JSON.stringify(layout)})`);
await p.mouse.move(5, 600);
await limDoc.scrollIntoViewIfNeeded().catch(() => {});
await shot(p, "limit-doctor");
const composedBefore = (await p.evaluate(() => window.__composed ?? [])).length;
await limDoc.getByRole("button", { name: "Apply and start report-job", exact: true }).click();
await p.waitForFunction(() => /still sets/.test([...document.querySelectorAll(".doctor [role=alert]")].map((e) => e.textContent).join("")), null, { timeout: 3000 }).catch(() => {});
const refusedSaid = await p.locator(".doctor .limit-actions [role=alert]").first().textContent();
check(refusedSaid === "compose.yaml still sets 256 MiB for report-job. Raise it, then press Apply and start." && (await p.evaluate(() => window.__composed ?? [])).length === composedBefore, `limit: Apply with the old limit doesn't run, and says why (${refusedSaid})`);
// The refusal: a warning line at the text's width, under the body and above the buttons, never in the button column;
// report-job stays whole (no hyphen, no split inside the word).
const refused = await limDoc.evaluate((li) => {
  const note = li.querySelector(".limit-actions > .resize-result.warn"), text = li.querySelector(":scope > div"), row = li.querySelector(".limit-actions .actions-inline");
  if (!note) return null;
  const r = (el) => el.getBoundingClientRect();
  const span = note.querySelector("span"), at = span.textContent.indexOf("report-job"), range = document.createRange();
  const node = [...span.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes("report-job"));
  range.setStart(node, node.textContent.indexOf("report-job")); range.setEnd(node, node.textContent.indexOf("report-job") + 10);
  const cs = getComputedStyle(note);
  return { left: Math.round(r(note).left - r(text).left), underBody: r(note).top >= r(text).bottom - 1, aboveButtons: r(note).bottom <= r(row).top + 1, icon: getComputedStyle(note.querySelector("svg")).color, warn: getComputedStyle(document.documentElement).getPropertyValue("--dot-warn").trim(), wrap: cs.overflowWrap, hyphens: cs.hyphens, whole: range.getClientRects().length === 1, found: at >= 0 };
});
const warnRgb = refused && await p.evaluate((c) => { const d = document.createElement("i"); d.style.color = c; document.body.append(d); const v = getComputedStyle(d).color; d.remove(); return v; }, refused.warn);
check(!!refused && refused.left === 0 && refused.underBody && refused.aboveButtons && refused.icon === warnRgb, `limit: the refusal is a warning line in the text column, under the body, above the buttons (${JSON.stringify(refused)})`);
check(!!refused && refused.found && refused.whole && refused.wrap !== "anywhere" && refused.hyphens !== "auto", `limit: report-job is never split in the refusal (${JSON.stringify(refused)})`);
await p.mouse.move(5, 600);
await shot(p, "limit-doctor-refused");
// Raised and applied from Doctor: it says each step, and when the row goes focus moves on, not to the page top.
await p.evaluate(() => { window.__shopLimit = 1024 ** 3; window.dispatchEvent(new Event("focus")); });
await p.waitForTimeout(400);
const docRaised = (await limDoc.locator(".limit-actions > .resize-result.off").innerText().catch(() => "")).trim();
check(docRaised === "Its limit in compose.yaml is now 1 GiB (was 256 MiB). Apply it to start.", `limit: Doctor shows the same raised line as home (${docRaised})`);
check(await limDoc.locator(".resize-result.warn").count() === 0, "limit: once the file reads differently, the old refusal is gone");
await p.waitForFunction(() => /runs it now/.test([...document.querySelectorAll(".doctor .limit-actions [role=status]")].map((e) => e.textContent).join("")), null, { timeout: 3000 }).catch(() => {});
const docSaid = await p.locator(".doctor .limit-actions [role=status]").first().textContent().catch(() => "");
check(docSaid === "compose.yaml now sets 1 GiB for report-job. Apply and start runs it now.", `limit: Doctor says the change politely, as home does (${docSaid})`);
await limDoc.getByRole("button", { name: "Apply and start report-job", exact: true }).click();
await p.waitForFunction(() => /started with its new limit/.test([...document.querySelectorAll(".doctor .limit-actions [role=status]")].map((e) => e.textContent).join("")), null, { timeout: 8000 }).catch(() => {});
check(await p.locator(".doctor .limit-actions [role=status]").first().textContent().catch(() => "") === "report-job started with its new limit.", "limit: Doctor says report-job started with its new limit.");
await p.evaluate(() => document.activeElement?.blur());
await p.waitForFunction(() => !document.querySelector(".doctor li")?.closest(".doctor")?.textContent?.includes("256 MiB memory limit"), null, { timeout: 40000 }).catch(() => {});
await p.waitForTimeout(300);
check(!(await p.locator(".doctor").innerText()).includes("256 MiB memory limit") && await p.evaluate(() => document.activeElement && document.activeElement !== document.body), `limit: Doctor's row went under focus, and focus moved on (${await p.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`)})`);
await p.close();

const byMd5 = new Map();
for (const [name, h] of md5s) byMd5.set(h, [...(byMd5.get(h) ?? []), name]);
const same = [...byMd5.values()].filter((n) => n.length > 1);
check(same.length === 0, `shots: every state's picture is different (${md5s.size} pictures${same.length ? `; same: ${same.map((x) => x.join(" = ")).join("; ")}` : ""})`);

await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

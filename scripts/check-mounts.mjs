// Mounts: a container whose Mac folder Colima doesn't share, a folder shared read-only that a container's log says it can't
// write to, the slow sshfs type, a folder list the app can't read, and a failed start (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
// SHOTS=dir saves r39-<state>.png; every picture must differ (md5).
import { createRequire } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shots = process.env.SHOTS;
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };
const md5s = new Map();
const shot = async (el, state) => md5s.set(state, createHash("md5").update(await el.screenshot(shots ? { path: path.join(shots, `r39-${state}.png`) } : {})).digest("hex"));

const browser = await chromium.launch();
async function open(query, width = 980) {
  const page = await browser.newPage({ viewport: { width, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?${query}`);
  await page.locator(".apps li").first().waitFor({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page;
}
const row = (p, name) => p.locator("ul.apps > li.app").filter({ has: p.locator(".app-name", { hasText: new RegExp(`^${name}$`) }) });
const line = (p, app, text) => row(p, app).locator(":scope > .problem").filter({ hasText: text });
const find0 = (p) => p.locator(".doctor .finding").filter({ hasText: "web uses" }).count();
const dialog = (p) => p.getByRole("alertdialog");

// 1. A project's container binds ~/code/web; the profile shares only ~/work.
let p = await open("unshared=1");
const l = line(p, "shop", "sees an empty");
const flat = async (el) => (await el.innerText()).replace(/\s+/g, " ").trim();
check(await l.count() === 1, "unshared: one line about the folder, under the shop project");
check(/^web · sees an empty ~\/code\/web \(not shared with Colima\) Share folder…$/.test(await flat(l)), `unshared: the line reads "web · sees an empty ~/code/web (not shared with Colima)" with one button (${await flat(l)})`);
check(await l.locator("code").count() === 1 && (await l.locator("code").innerText()) === "~/code/web", "unshared: the path is in the code font");
const b = l.getByRole("button");
check(await b.count() === 1 && await b.getAttribute("aria-label") === "Share folder…: Sees an empty ~/code/web (not shared with Colima), web", `unshared: the button's name starts with its visible words and has no backticks (${await b.getAttribute("aria-label")})`);
check(await b.evaluate((e) => getComputedStyle(e).opacity) === "1", "unshared: the button shows without hovering");
await shot(row(p, "shop"), "mounts-line");
await b.click();
const ask = await dialog(p).innerText().catch(() => "");
check(/^Share ~\/code\/web with the VM\?/.test(ask) && /VM restarts/.test(ask) && /Your \d+ running containers? stops? and starts? again|stop and start again/.test(ask) && /Images, volumes and containers stay/.test(ask), `unshared: the confirm names the folder, the restart and what stays (${ask.replace(/\s+/g, " ")})`);
check(await dialog(p).getByRole("button", { name: "Share and restart" }).count() === 1 && await dialog(p).getByRole("button", { name: "Cancel" }).count() === 1, "unshared: the confirm's button says Share and restart");
await shot(dialog(p), "mounts-confirm");
await dialog(p).getByRole("button", { name: "Cancel" }).click();
check(!(await p.evaluate(() => window.__vmChange)) && await l.count() === 1, "unshared: Cancel changes nothing");
await b.click();
await dialog(p).getByRole("button", { name: "Share and restart" }).click();
await p.waitForTimeout(600);
check(/Restarting…/.test(await row(p, "shop").locator(":scope > .problem").first().innerText()) || /Restarting/.test(await p.locator(".resize-progress").first().innerText().catch(() => "")), "unshared: while it runs the line says Restarting…");
await p.waitForFunction(() => /is shared with the VM now/.test(document.querySelector("ul.apps")?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
const sent = await p.evaluate(() => window.__vmChange);
check(sent?.cmd === "apply_mounts" && sent.args.name === "default" && JSON.stringify(sent.args.mounts) === JSON.stringify([{ path: "/Users/me/work", writable: true }, { path: "/Users/me/code/web", writable: true }]), `unshared: the backend gets the saved folders plus the new one (${JSON.stringify(sent)})`);
const result = await row(p, "shop").locator(".resize-result").innerText().catch(() => "");
check(/^~\/code\/web is shared with the VM now\. Everything that was running is running again\.$/.test(result.replace(/\s+/g, " ").trim()), `unshared: the result says what changed and that containers run again (${result})`);
const hdr = await row(p, "shop").locator(":scope > .app-row, :scope > div").first().innerText().catch(() => "");
check(!/Restarting…/.test(await row(p, "shop").locator(".app-state, .state, :scope > *:first-child").first().innerText().catch(() => "")) && await row(p, "shop").locator(".spin").count() === 0, `unshared: no row says Restarting… or spins next to the done result (${hdr.replace(/\s+/g, " ").slice(0, 60)})`);
check(await row(p, "shop").locator(".resize-result code").count() === 1, "unshared: the path in the result is in the code font");
check(await line(p, "shop", "sees an empty").count() === 0, "unshared: the folder line is gone the moment the result shows, not at the next read");
await shot(row(p, "shop"), "mounts-done");
await row(p, "shop").getByRole("button", { name: "Dismiss" }).click();
check(await row(p, "shop").locator(".resize-result").count() === 0, "unshared: Dismiss clears the result");
check(p.errors.length === 0, `unshared: no page errors ${p.errors.join("; ")}`);
await p.close();

// 2. The Doctor page: the same finding, the commands as one line of code, and a good result as its own row.
p = await open("unshared=1");
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
const doc = p.locator(".doctor .finding").filter({ hasText: "web uses" });
check(await doc.count() === 1 && /Colima only shares ~\/work/.test(await doc.innerText()), "doctor: names the folder and what Colima does share");
check(await doc.locator("b code").count() === 1 && await doc.locator("span.hint code").count() >= 2, "doctor: the paths in the title and the text are in the code font");
check(await doc.getByRole("button", { name: /^Share folder…: / }).count() === 1, "doctor: one Share folder… button on the row");
check(await doc.getByRole("button", { name: /^Share folder…: / }).getAttribute("aria-label") === "Share folder…: web uses ~/code/web, which Colima doesn't share", "doctor: the button's name has no backticks");
await doc.locator("summary").click();
check(await doc.locator("pre").count() === 0 && await doc.locator(".how-cmd code").innerText() === "colima stop default && colima start default --mount /Users/me/work:w --mount /Users/me/code/web:w", "doctor: Or run it yourself is one line of code, no dark block");
check(await doc.locator(".how-cmd code").evaluate((e) => getComputedStyle(e.parentElement).backgroundColor === "rgba(0, 0, 0, 0)"), "doctor: the line sits on the row's own background");
await shot(p.locator(".content"), "mounts-doctor");
await doc.getByRole("button", { name: /^Share folder…: / }).click();
await dialog(p).getByRole("button", { name: "Share and restart" }).click();
await p.waitForSelector(".result-row .finding.ok", { timeout: 30000 }).catch(() => {});
const good = p.locator(".result-row .finding.ok");
check(await find0(p) === 0, "doctor: the 'doesn't share' finding is gone the moment the success row shows");
check(await good.count() === 1 && /^~\/code\/web is shared with the VM now\./.test(await flat(good)), `doctor: the good result is its own row (${await flat(good).catch(() => "")})`);
check(await p.locator('section[aria-label="Needs action"] .result-row, section[aria-label="Needs action"] .resize-result').count() === 0, "doctor: the good result is not inside Needs action");
check(await good.locator("svg").count() >= 1 && await good.getByRole("button", { name: "Dismiss" }).count() === 1, "doctor: the row has a check and Dismiss on the right");
const pos = await good.evaluate((e) => { const r = e.getBoundingClientRect(); const d = e.querySelector("button").getBoundingClientRect(); return d.left > r.left + r.width / 2; });
check(pos, "doctor: Dismiss is on the right of the row");
await shot(p.locator(".content"), "mounts-doctor-done");
const gaps = await p.evaluate(() => {
  // From the bottom of the last row above a group's heading to the top of that heading, for every heading on the page.
  const out = [];
  for (const h of document.querySelectorAll(".doctor h3.doctor-group")) {
    const sec = h.closest("section");
    let prev = sec.previousElementSibling;
    while (prev && !(prev.matches("ul.result-row") || prev.matches("section")) ) prev = prev.previousElementSibling;
    if (!prev) continue;
    const last = prev.matches("section") ? [...prev.querySelectorAll("li.finding")].pop() ?? prev : prev.querySelector("li.finding");
    out.push({ after: prev.matches("ul.result-row") ? "result" : "group", gap: Math.round(h.getBoundingClientRect().top - last.getBoundingClientRect().bottom) });
  }
  const d = document.querySelector(".doctor"); const h = document.querySelector(".doctor h3.doctor-group");
  return { expected: Math.round(parseFloat(getComputedStyle(d).rowGap) + parseFloat(getComputedStyle(h).marginTop)), afterRow: out.find((x) => x.after === "result")?.gap ?? null, between: out.filter((x) => x.after === "group").map((x) => x.gap) };
});
check(gaps.afterRow !== null && Math.abs(gaps.afterRow - gaps.expected) <= 1 && gaps.between.every((g) => Math.abs(g - gaps.afterRow) <= 2), `doctor: the gap under the success row matches the gap between groups (${JSON.stringify(gaps)})`);
await good.getByRole("button", { name: "Dismiss" }).click();
check(await p.locator(".result-row").count() === 0, "doctor: Dismiss clears the row");
check(p.errors.length === 0, `doctor: no page errors ${p.errors.join("; ")}`);
await p.close();

// 3. A folder on a disk the Mac no longer has: refused before the VM stops, said plainly.
p = await open("unshared=1&missing=1");
await line(p, "shop", "sees an empty").getByRole("button").click();
await dialog(p).getByRole("button", { name: "Share and restart" }).click();
await p.waitForFunction(() => /not a folder on this Mac/.test(document.querySelector("ul.apps")?.textContent ?? ""), null, { timeout: 20000 }).catch(() => {});
const refused = await row(p, "shop").locator(".resize-result").innerText().catch(() => "");
check(/^Nothing changed: \/Volumes\/missing is not a folder on this Mac, so it can't be shared\.$/.test(refused.replace(/\s+/g, " ").trim()) && !/VM is stopped/.test(refused), `refused: says nothing changed, and the VM is not called stopped (${refused})`);
check(await p.evaluate(() => window.__mock.state().profiles[0].status) === "Running", "refused: the VM is still running");
await p.close();

// 4. The start fails: the result comes first, above the stopped-VM card, in the folder's words, with the way back.
p = await open("unshared=1&vmfail=1");
await line(p, "shop", "sees an empty").getByRole("button").click();
await dialog(p).getByRole("button", { name: "Share and restart" }).click();
await p.waitForSelector(".resize-result.bad", { timeout: 20000 }).catch(() => {});
const bad = (await p.locator(".resize-result").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
check(/^Colima couldn't start the VM with ~\/code\/web shared\. The VM is stopped\. ~\/code\/web stays saved in the profile, so a plain start tries it again\.$/.test(bad), `failed: the result is about the folder, says the VM is stopped and the folder stayed saved (${bad})`);
check(!/new size/.test(bad), "failed: never says new size");
const names = await p.locator(".resize-status button").evaluateAll((bs) => bs.map((x) => x.getAttribute("aria-label") ?? x.textContent));
check(names.some((n) => /^Try again: /.test(n)) && names.some((n) => /^Start with the folders you had: /.test(n)) && names.some((n) => /^Show the log: /.test(n)) && names.includes("Dismiss"), `failed: the buttons are named with the row they belong to (${names.join(" | ")})`);
check(await p.getByRole("button", { name: /^Start it as it was/ }).count() === 0 && await p.getByRole("button", { name: /^Try \d/ }).count() === 0, "failed: no size buttons");
check(await p.locator(".blank").count() === 0 && await p.getByRole("button", { name: "Start VM" }).count() === 0, "failed: the stopped card and its Start VM are hidden while the failure shows");
const prim = p.locator(".content button.primary");
check(await prim.count() === 1 && await prim.innerText() === "Start with the folders you had", "failed: the one filled button is Start with the folders you had");
const lay = await p.evaluate(() => { const t = document.querySelector(".problem.result .resize-result"); const a = document.querySelector(".problem.result .resize-actions"); const tr = t.getBoundingClientRect(); const ar = a.getBoundingClientRect(); const card = document.querySelector(".problem.result").getBoundingClientRect(); const lh = parseFloat(getComputedStyle(t).lineHeight) || 18; return { lines: Math.round(tr.height / lh), below: ar.top >= tr.bottom - 1, wide: tr.width > card.width * 0.8, right: ar.right > card.right - 24 }; });
check(lay.lines <= 3 && lay.below && lay.wide && lay.right, `failed: text full width on top (${lay.lines} lines), buttons in one row under it at the right (${JSON.stringify(lay)})`);
const order4 = await p.locator(".problem.result .resize-actions button").allInnerTexts();
check(JSON.stringify(order4) === JSON.stringify(["Dismiss", "Show the log", "Try again", "Start with the folders you had"]), `failed: buttons read Dismiss, Show the log, Try again, then the filled one (${order4.join(" | ")})`);
check(await p.getByRole("button", { name: /^Show the log: / }).evaluate((e) => e.tagName === "BUTTON" && e.classList.contains("small") && !e.classList.contains("link")), "failed: Show the log is a push button");
check(await prim.evaluate((e) => { const r = e.parentElement.getBoundingClientRect(); return Math.abs(e.getBoundingClientRect().right - r.right) < 2; }), "failed: the filled button sits on the right edge");
check(!(await p.locator(".resize-status button", { hasText: "Try again" }).getAttribute("class")).includes("primary"), "failed: Try again is a plain small button");
check(!/The VM log is/.test(await p.locator(".content").innerText()), "failed: no path to the log in the text, there is a button for it");
await shot(p.locator(".content"), "mounts-failed");
await p.getByRole("button", { name: /^Show the log: / }).click();
await p.waitForFunction(() => window.__revealedLog === "default", null, { timeout: 3000 }).catch(() => {});
check(await p.evaluate(() => window.__revealedLog) === "default", "failed: Show the log reveals the VM's log");
await p.getByRole("button", { name: /^Start with the folders you had: / }).click();
await p.locator(".resize-result", { hasText: "The VM started with the folders it had" }).waitFor({ timeout: 30000 }).catch(() => {});
const back = await p.evaluate(() => window.__vmChange);
check(back?.cmd === "apply_mounts" && back.args.force === true && JSON.stringify(back.args.mounts) === JSON.stringify([{ path: "/Users/me/work", writable: true }]), `failed: the old folders start the stopped VM (${JSON.stringify(back)})`);
check(/^The VM started with the folders it had\./.test((await p.locator(".resize-result").innerText().catch(() => "")).trim()), "failed: the result says it started with the folders it had");
check(await p.locator(".problem.result.stopped .resize-result.ok").count() === 1 && await p.locator(".resize-result").count() === 1, "failed: the good result sits in the same card, once");
await p.close();

// 4b. Dismiss the failure: the stopped card says what Start VM will do and offers the way back as its own button.
p = await open("unshared=1&vmfail=1");
await line(p, "shop", "sees an empty").getByRole("button").click();
await dialog(p).getByRole("button", { name: "Share and restart" }).click();
await p.waitForSelector(".resize-result.bad", { timeout: 20000 });
await p.getByRole("button", { name: "Dismiss" }).click();
await p.waitForTimeout(300);
const startBtn = p.getByRole("button", { name: "Start VM", exact: true });
const backBtn = p.getByRole("button", { name: "Start with the folders you had", exact: true });
check(await startBtn.count() === 1 && await backBtn.count() === 1, "way back: the stopped card offers a plain Start VM and the way back, as two buttons");
const noteText = (await p.locator(".blank .hint").allInnerTexts()).join(" | ");
check(noteText.includes("The last change didn't start. ~/code/web is still saved in the profile, so Start VM tries it again."), `way back: the card says what Start VM will do (${noteText})`);
const sides = await p.evaluate(() => { const bs = [...document.querySelectorAll(".blank button")]; const a = bs.find((b) => b.textContent === "Start VM")?.getBoundingClientRect(); const c = bs.find((b) => b.textContent === "Start with the folders you had")?.getBoundingClientRect(); return a && c ? { startLeft: a.left, backLeft: c.left, backPrimary: bs.find((b) => b.textContent === "Start with the folders you had").classList.contains("primary"), startPrimary: bs.find((b) => b.textContent === "Start VM").classList.contains("primary") } : null; });
check(sides && sides.backLeft > sides.startLeft && sides.backPrimary && !sides.startPrimary, `way back: the filled way back is on the right of the quiet Start VM (${JSON.stringify(sides)})`);
check(await p.evaluate(() => document.activeElement?.textContent) === "Start with the folders you had", "way back: Dismiss moved focus to the filled way back button, not the page title");
await shot(p.locator(".content"), "mounts-stopped-way-back");
// The plain Start VM starts with what is saved: no folder change is run, and the way back is gone once the start works.
await startBtn.click();
await p.waitForFunction(() => { try { return localStorage.getItem("colima-ui.wayBack") === null; } catch { return true; } }, null, { timeout: 30000 }).catch(() => {});
check(await p.evaluate(() => window.__vmChange === undefined), "way back: the plain Start VM ran a plain start (no folder change)");
check(await p.evaluate(() => { try { return localStorage.getItem("colima-ui.wayBack"); } catch { return null; } }) === null, "way back: a start that works clears the saved way back");
await p.close();

// 4c. The same card, but the way back button runs the folders the profile had, by force.
p = await open("unshared=1&vmfail=1");
await line(p, "shop", "sees an empty").getByRole("button").click();
await dialog(p).getByRole("button", { name: "Share and restart" }).click();
await p.waitForSelector(".resize-result.bad", { timeout: 20000 });
await p.getByRole("button", { name: "Dismiss" }).click();
await p.getByRole("button", { name: "Start with the folders you had", exact: true }).click();
await p.locator(".problem.result .resize-result.ok, .resize-result.ok").first().waitFor({ timeout: 30000 }).catch(() => {});
const wb = await p.evaluate(() => window.__vmChange);
check(wb?.cmd === "apply_mounts" && wb.args.force === true && JSON.stringify(wb.args.mounts) === JSON.stringify([{ path: "/Users/me/work", writable: true }]), `way back: the button ran the folders the profile had (${JSON.stringify(wb)})`);
check(/^The VM started with the folders it had\./.test((await p.locator(".resize-result").first().innerText().catch(() => "")).trim()), "way back: the result says so");
await p.close();

// 5. Keyboard only: a failed start takes focus to its result, and the page does not say it a second time.
p = await open("unshared=1&vmfail=1");
await line(p, "shop", "sees an empty").getByRole("button").focus();
await p.keyboard.press("Enter");
await dialog(p).waitFor({ timeout: 3000 });
await p.keyboard.press("Tab");
check(await p.evaluate(() => document.activeElement?.textContent) === "Share and restart", "keyboard: Tab reaches Share and restart");
await p.keyboard.press("Enter");
await p.waitForSelector(".resize-result.bad", { timeout: 20000 }).catch(() => {});
await p.waitForTimeout(300);
const focused = await p.evaluate(() => ({ cls: document.activeElement?.className, text: document.activeElement?.textContent?.slice(0, 40) }));
check(/resize-result/.test(focused.cls ?? "") && /Colima couldn't start/.test(focused.text ?? ""), `keyboard: focus is on the failed result (${JSON.stringify(focused)})`);
check((await p.locator("[data-resize-announcer][role=alert]").textContent()) === "" && (await p.locator("[data-resize-announcer][role=status]").textContent()) === "", "keyboard: the page's own announcer stays quiet, since focus said it");
await p.keyboard.press("Tab");
check(await p.evaluate(() => document.activeElement?.textContent) === "Dismiss", "keyboard: Tab goes on to Dismiss, the first button");
await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); await p.keyboard.press("Tab");
check(/^Start with the folders you had: /.test(await p.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")), "keyboard: the filled way back is the last stop");
await p.keyboard.press("Enter");
await p.locator(".problem.result .resize-result.ok").waitFor({ timeout: 30000 }).catch(() => {});
await p.waitForTimeout(300);
const f2 = await p.evaluate(() => ({ cls: document.activeElement?.className, inCard: !!document.activeElement?.closest(".problem.result"), text: document.activeElement?.textContent?.slice(0, 60) }));
check(/resize-result/.test(f2.cls ?? "") && f2.inCard && /started with the folders/.test(f2.text ?? ""), `keyboard: after the way back, focus is on the good result in the same card (${JSON.stringify(f2)})`);
check((await p.locator("[data-resize-announcer][role=status]").textContent()) === "" && (await p.locator("[data-resize-announcer][role=alert]").textContent()) === "", "keyboard: the good result is not said a second time by the page");
await p.close();

// 6. Away from the page: the same failure is said by the page's alert, since no line shows it.
p = await open("unshared=1&vmfail=1");
await line(p, "shop", "sees an empty").getByRole("button").click();
await dialog(p).getByRole("button", { name: "Share and restart" }).click();
await p.waitForTimeout(300);
await p.getByRole("button", { name: "Images", exact: true }).click();
await p.waitForFunction(() => /Colima couldn't start the VM/.test(document.querySelector("[data-resize-announcer][role=alert]")?.textContent ?? ""), null, { timeout: 20000 }).catch(() => {});
const said = await p.locator("[data-resize-announcer][role=alert]").textContent();
check(/^Colima couldn't start the VM with ~\/code\/web shared\./.test(said ?? "") && !/`/.test(said ?? ""), `away: the alert says it, in plain words (${said})`);
await p.close();

// 7. A folder shared read-only: said only when the container's own log shows the error.
p = await open("rofs=1");
const ro = row(p, "importer").locator(":scope > .problem");
check(/^Can't write to ~\/code\/docs \(shared read-only\) Make it writable…$/.test(await flat(ro)), `read-only: the line says it, with one button (${await flat(ro)})`);
check(await ro.locator("code").count() === 1, "read-only: the path is in the code font");
await shot(row(p, "importer"), "mounts-readonly");
await ro.getByRole("button").click();
check(/^Let containers change files in ~\/code\?/.test(await dialog(p).innerText()) && await dialog(p).getByRole("button", { name: "Make writable and restart" }).count() === 1, "read-only: the confirm names the shared folder and its button says Make writable and restart");
await dialog(p).getByRole("button", { name: "Make writable and restart" }).click();
await p.locator(".resize-result").waitFor({ timeout: 30000 }).catch(() => {});
check(/^~\/code is writable in the VM now\./.test(await p.locator(".resize-result").innerText().catch(() => "")), "read-only: the result says the folder is writable now");
const sent2 = await p.evaluate(() => window.__vmChange);
check(JSON.stringify(sent2?.args.mounts) === JSON.stringify([{ path: "/Users/me/code", writable: true }]), `read-only: the same folder, now writable (${JSON.stringify(sent2?.args.mounts)})`);
await p.close();

// 8. sshfs on a vz VM: worth knowing only when a container uses a Mac folder, and nothing to press.
p = await open("sshfs=1&bind=1");
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
const slow = p.locator('section[aria-label="Worth knowing"] .finding').filter({ hasText: "Folders are shared the slow way (sshfs)" });
check(await slow.count() === 1 && /can't change the sharing type of a VM that already exists/.test(await slow.innerText()), "sshfs: worth knowing, and says the type can't change on this VM");
check(await p.locator('section[aria-label="Needs action"]').count() === 0, "sshfs: not counted as needing action");
check(await slow.locator(".finding-actions button.small").count() === 0 && await slow.getByRole("button", { name: /Open Profiles/ }).count() === 0, "sshfs: no button on the row, only the menu");
await shot(p.locator(".content"), "mounts-sshfs");
await p.close();
p = await open("sshfs=1");
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
check(!/slow way/.test(await p.locator(".doctor").innerText()), "sshfs: no container uses a Mac folder, so nothing is said");
await p.close();

// 9. A folder list the app can't read: it says so, and offers no change.
p = await open("flowmounts=1&unshared=1");
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
const unr = p.locator(".doctor .finding").filter({ hasText: "can't read which folders Colima shares" });
check(await unr.count() === 1 && /can't read your shared folders in colima\.yaml, so it won't change them/.test(await unr.innerText()), "unreadable: the Doctor says it can't read the folders");
check(await unr.locator("code").count() >= 1 && await unr.locator(".finding-actions button.small").count() === 0, "unreadable: colima.yaml is in the code font and there is no change to press");
check(await p.locator(".doctor .finding").filter({ hasText: "web uses" }).count() === 0, "unreadable: nothing is claimed about the unshared folder");
await shot(p.locator(".content"), "mounts-unreadable");
await p.close();

// 10. The default profile: nothing about folders, and the checks pass.
p = await open("scenario=running");
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
check(!/shared with Colima|read-only|slow way/.test(await p.locator(".doctor").innerText()), "default: no folder problem");
await p.locator("details.passing summary").first().click();
check(/Every Mac folder a container uses is shared with the VM/.test(await p.locator(".doctor").innerText()), "default: the folder check is among the passed ones");
await p.close();

const dup = [...md5s].filter(([, h], i, a) => a.findIndex(([, g]) => g === h) !== i).map(([k]) => k);
check(dup.length === 0, `every picture differs (${[...md5s.keys()].join(", ")})${dup.length ? ` same: ${dup}` : ""}`);
await browser.close();
process.exit(failed ? 1 : 0);

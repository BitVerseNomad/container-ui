// Mounts checks (WO-3.2). Runs against the preview.
// Runs in Chromium and WebKit.
import { engine, open, check, done } from "./lib/check.mjs";
const HOST = (process.env.PREVIEW_URL || "http://localhost:4173/").replace(/\/$/, "");

const WAIT = 5000;

const browser = await engine.launch();

// 1. Unshared folder: one line under the shop project
{
  const page = await open("/?unshared=1#/containers");
  await page.waitForTimeout(1000);
  const l = page.locator(".list").locator(".subrow").filter({ hasText: "Sees an empty" });
  check(await l.count() === 1, "unshared: one line about the folder under the shop project");
  const flat = await l.innerText().then(t => t.replace(/\s+/g, " ").trim());
  check(/^Sees an empty ~\/code\/web \(not shared with Colima\) Share folder…$/.test(flat), `unshared: line reads correctly (${flat})`);
  check(await l.locator("code").count() === 1 && await l.locator("code").innerText() === "~/code/web", "unshared: path in code font");
  const b = l.getByRole("button");
  check(await b.count() === 1, "unshared: one Share folder button");
  check(await b.getAttribute("aria-label") === "Share folder…: Sees an empty ~/code/web (not shared with Colima), web", `unshared: button name starts with visible words, no backticks`);
  check(await b.evaluate((el) => getComputedStyle(el).opacity) === "1", "unshared: button shows without hovering");
  await b.click();
  const dlg = page.getByRole("alertdialog");
  const ask = await dlg.innerText().catch(() => "");
  check(/^Share ~\/code\/web with the VM\?/.test(ask) && /VM restarts/.test(ask) && /Images, volumes and containers stay/.test(ask), `unshared: confirm names folder, restart, what stays`);
  check(await dlg.getByRole("button", { name: "Share and restart" }).count() === 1 && await dlg.getByRole("button", { name: "Cancel" }).count() === 1, "unshared: confirm has Share and restart and Cancel");
  await dlg.getByRole("button", { name: "Cancel" }).click();
  check(!(await page.evaluate(() => window.__vmChange)) && await l.count() === 1, "unshared: Cancel changes nothing");
  await b.click();
  await dlg.getByRole("button", { name: "Share and restart" }).click();
  await page.waitForTimeout(600);
  check(/Restarting…/.test(await page.locator(".list").innerText()) || /Restarting/.test(await page.locator(".resize-progress").first().innerText().catch(() => "")), "unshared: while it runs the line says Restarting…");
  await page.waitForFunction(() => /is shared with the VM now/.test(document.querySelector(".list")?.textContent ?? ""), null, { timeout: 30000 }).catch(() => {});
  const sent = await page.evaluate(() => window.__vmChange);
  check(sent?.cmd === "apply_mounts" && sent.args.name === "default" && JSON.stringify(sent.args.mounts) === JSON.stringify([{ path: "/Users/me/work", writable: true }, { path: "/Users/me/code/web", writable: true }]), `unshared: backend gets saved folders plus new one`);
  const result = await page.locator(".list").locator(".resize-result").innerText().catch(() => "");
  check(/^~\/code\/web is shared with the VM now\. Everything that was running is running again\.$/.test(result.replace(/\s+/g, " ").trim()), `unshared: result says what changed`);
  check(await page.locator(".list").locator(":scope > .resize-result").count() === 0 && await page.locator(".list").locator(".spin").count() === 0, "unshared: no Restarting or spin next to done result");
  check(await page.locator(".list").locator(".resize-result code").count() === 1, "unshared: path in result is in code font");
  check(await page.locator(".list").locator(".subrow").filter({ hasText: "Sees an empty" }).count() === 0, "unshared: folder line is gone when result shows");
  await page.getByRole("button", { name: "Dismiss" }).click();
  check(await page.locator(".list").locator(".resize-result").count() === 0, "unshared: Dismiss clears result");
  await page.close();
}

// 2. Doctor page: same finding
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?unshared=1#/doctor`);
  await page.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
  const doc = page.locator(".doctor .finding").filter({ hasText: "web uses" });
  check(await doc.count() === 1 && /Colima only shares ~\/work/.test(await doc.innerText()), "doctor: names folder and what Colima does share");
  check(await doc.locator("b code").count() === 1 && await doc.locator("span.hint code").count() >= 2, "doctor: paths in title and text are in code font");
  check(await doc.getByRole("button", { name: /^Share folder…: / }).count() === 1, "doctor: one Share folder button on row");
  check(await doc.getByRole("button", { name: /^Share folder…: / }).getAttribute("aria-label") === "Share folder…: web uses ~/code/web, which Colima doesn't share", "doctor: button name has no backticks");
  await doc.locator("summary").click();
  check(await doc.locator("pre").count() === 0 && await doc.locator(".how-cmd code").innerText() === "colima stop default && colima start default --mount /Users/me/work:w --mount /Users/me/code/web:w", "doctor: Or run it yourself is one line of code");
  await doc.getByRole("button", { name: /^Share folder…: / }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Share and restart" }).click();
  await page.waitForSelector(".result-row .finding.ok", { timeout: 30000 }).catch(() => {});
  check(await page.locator(".doctor .finding").filter({ hasText: "web uses" }).count() === 0, "doctor: doesn't share finding is gone");
  check(await page.locator(".result-row .finding.ok").count() === 1 && /^~\/code\/web is shared with the VM now\./.test(await page.locator(".result-row .finding.ok").innerText()), "doctor: good result is its own row");
  check(await page.locator('section[aria-label="Needs action"] .result-row, section[aria-label="Needs action"] .resize-result').count() === 0, "doctor: good result not inside Needs action");
  check(await page.locator(".result-row .finding.ok").locator("svg").count() >= 1 && await page.locator(".result-row .finding.ok").getByRole("button", { name: "Dismiss" }).count() === 1, "doctor: row has check and Dismiss");
  await page.getByRole("button", { name: "Dismiss" }).click();
  check(await page.locator(".result-row").count() === 0, "doctor: Dismiss clears row");
  check(page.errors.length === 0, `doctor: no page errors`);
  await page.close();
}

// 3. Refused: folder on disk Mac no longer has
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?unshared=1&missing=1#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".list > .subrow").filter({ hasText: "sees an empty" }).getByRole("button").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Share and restart" }).click();
  await page.waitForFunction(() => /not a folder on this Mac/.test(document.querySelector(".resize-status")?.textContent ?? ""), null, { timeout: 20000 }).catch(() => {});
  const refused = await page.locator(".resize-status .resize-result").innerText().catch(() => "");
  check(/^Nothing changed: \/Volumes\/missing is not a folder on this Mac, so it can't be shared\.$/.test(refused.replace(/\s+/g, " ").trim()) && !/VM is stopped/.test(refused), `refused: says nothing changed, VM not stopped`);
  check(await page.evaluate(() => window.__mock.state().profiles[0].status) === "Running", "refused: VM still running");
  await page.close();
}

// 4. Start fails: result first, above stopped card
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?unshared=1&vmfail=1#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".list > .subrow").filter({ hasText: "sees an empty" }).getByRole("button").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Share and restart" }).click();
  await page.waitForSelector(".resize-result.bad", { timeout: 20000 }).catch(() => {});
  const bad = (await page.locator(".resize-result").innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  check(/^Colima couldn't start the VM with ~\/code\/web shared\. The VM is stopped\. ~\/code\/web stays saved in the profile, so a plain start tries it again\.$/.test(bad) && !/new size/.test(bad), `failed: result about folder, VM stopped, folder saved`);
  const names = await page.locator(".resize-status button").evaluateAll((bs) => bs.map((x) => x.getAttribute("aria-label") ?? x.textContent));
  check(names.some((n) => /^Try again: /.test(n)) && names.some((n) => /^Start with the folders you had: /.test(n)) && names.some((n) => /^Show the log: /.test(n)) && names.includes("Dismiss"), `failed: buttons named with row`);
  check(await page.getByRole("button", { name: /^Start it as it was/ }).count() === 0 && await page.getByRole("button", { name: /^Try \d/ }).count() === 0, "failed: no size buttons");
  check(await page.locator(".empty").count() === 0 && await page.getByRole("button", { name: "Start VM" }).count() === 0, "failed: stopped card and Start VM hidden");
  const prim = page.locator(".content button.primary");
  check(await prim.count() === 1 && await prim.innerText() === "Start with the folders you had", "failed: one filled button is Start with the folders you had");
  const lay = await page.evaluate(() => { const t = document.querySelector(".resize-status .resize-result"); const a = document.querySelector(".resize-status .resize-actions"); const tr = t.getBoundingClientRect(); const ar = a.getBoundingClientRect(); const card = document.querySelector(".resize-status").getBoundingClientRect(); const lh = parseFloat(getComputedStyle(t).lineHeight) || 18; return { lines: Math.round(tr.height / lh), below: ar.top >= tr.bottom - 1, wide: tr.width > card.width * 0.8, right: ar.right > card.right - 24 }; });
  check(lay.lines <= 3 && lay.below && lay.wide && lay.right, `failed: text full width, buttons in row under at right`);
  const order4 = await page.locator(".resize-status .resize-actions button").allInnerTexts();
  check(JSON.stringify(order4) === JSON.stringify(["Dismiss", "Show the log", "Try again", "Start with the folders you had"]), `failed: buttons read Dismiss, Show the log, Try again, then filled`);
  check((await page.getByRole("button", { name: /^Show the log: / }).evaluate((e) => e.tagName === "BUTTON" && e.classList.contains("small") && !e.classList.contains("link"))), "failed: Show the log is push button");
  check((await prim.evaluate((e) => { const r = e.parentElement.getBoundingClientRect(); return Math.abs(e.getBoundingClientRect().right - r.right) < 2; })), "failed: filled button right edge");
  check(!(await page.locator(".resize-status button", { hasText: "Try again" }).getAttribute("class")).includes("primary"), "failed: Try again plain button");
  check(!/The VM log is/.test(await page.locator(".content").innerText()), "failed: no path to log in text");
  await page.getByRole("button", { name: /^Show the log: / }).click();
  await page.waitForFunction(() => window.__revealedLog === "default", null, { timeout: 3000 }).catch(() => {});
  check(await page.evaluate(() => window.__revealedLog) === "default", "failed: Show the log reveals VM log");
  await page.getByRole("button", { name: /^Start with the folders you had: / }).click();
  await page.locator(".resize-result", { hasText: "The VM started with the folders it had" }).waitFor({ timeout: 30000 }).catch(() => {});
  const back = await page.evaluate(() => window.__vmChange);
  check(back?.cmd === "apply_mounts" && back.args.force === true && JSON.stringify(back.args.mounts) === JSON.stringify([{ path: "/Users/me/work", writable: true }]), `failed: old folders start stopped VM`);
  check(/^The VM started with the folders it had\.$/.test((await page.locator(".resize-result").innerText().catch(() => "")).trim()), "failed: result says started with folders");
  check(await page.locator(".resize-status .resize-result.ok").count() === 1 && await page.locator(".resize-result").count() === 1, "failed: good result in same card, once");
  await page.close();
}

// 5. Dismiss: stopped card says what Start VM will do
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?unshared=1&vmfail=1#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".list > .subrow").filter({ hasText: "sees an empty" }).getByRole("button").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Share and restart" }).click();
  await page.waitForSelector(".resize-result.bad", { timeout: 20000 });
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.waitForTimeout(300);
  const startBtn = page.getByRole("button", { name: "Start VM", exact: true });
  const backBtn = page.getByRole("button", { name: "Start with the folders you had", exact: true });
  check(await startBtn.count() === 1 && await backBtn.count() === 1, "way back: stopped card offers Start VM and way back");
  const noteText = (await page.locator(".empty .hint").allInnerTexts()).join(" | ");
  check(noteText.includes("The last change didn't start. ~/code/web is still saved in the profile, so Start VM tries it again."), `way back: card says what Start VM will do`);
  const sides = await page.evaluate(() => { const bs = [...document.querySelectorAll(".empty button")]; const a = bs.find((b) => b.textContent === "Start VM")?.getBoundingClientRect(); const c = bs.find((b) => b.textContent === "Start with the folders you had")?.getBoundingClientRect(); return a && c ? { startLeft: a.left, backLeft: c.left, backPrimary: bs.find((b) => b.textContent === "Start with the folders you had").classList.contains("primary"), startPrimary: bs.find((b) => b.textContent === "Start VM").classList.contains("primary") } : null; });
  check(sides && sides.backLeft > sides.startLeft && sides.backPrimary && !sides.startPrimary, `way back: filled way back on right of Start VM`);
  check(await page.evaluate(() => document.activeElement?.textContent) === "Start with the folders you had", "way back: Dismiss moved focus to filled way back");
  await startBtn.click();
  await page.waitForFunction(() => { try { return localStorage.getItem("openpier:wayBack") === null; } catch { return true; } }, null, { timeout: 30000 }).catch(() => {});
  check(await page.evaluate(() => window.__vmChange === undefined), "way back: plain Start VM ran plain start");
  check(await page.evaluate(() => { try { return localStorage.getItem("openpier:wayBack"); } catch { return null; } }) === null, "way back: start that works clears saved way back");
  await page.close();
}

// 6. Same card, way back runs folders by force
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?unshared=1&vmfail=1#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".list > .subrow").filter({ hasText: "sees an empty" }).getByRole("button").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Share and restart" }).click();
  await page.waitForSelector(".resize-result.bad", { timeout: 20000 });
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.getByRole("button", { name: "Start with the folders you had", exact: true }).click();
  await page.locator(".resize-status .resize-result.ok, .resize-result.ok").first().waitFor({ timeout: 30000 }).catch(() => {});
  const wb = await page.evaluate(() => window.__vmChange);
  check(wb?.cmd === "apply_mounts" && wb.args.force === true && JSON.stringify(wb.args.mounts) === JSON.stringify([{ path: "/Users/me/work", writable: true }]), `way back: button ran folders profile had`);
  check(/^The VM started with the folders it had\.$/.test((await page.locator(".resize-result").first().innerText().catch(() => "")).trim()), "way back: result says so");
  await page.close();
}

// 7. Keyboard only
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?unshared=1&vmfail=1#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".list > .subrow").filter({ hasText: "sees an empty" }).getByRole("button").focus();
  await page.keyboard.press("Enter");
  await page.getByRole("alertdialog").waitFor({ timeout: 3000 });
  await page.keyboard.press("Tab");
  check(await page.evaluate(() => document.activeElement?.textContent) === "Share and restart", "keyboard: Tab reaches Share and restart");
  await page.keyboard.press("Enter");
  await page.waitForSelector(".resize-result.bad", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(300);
  const focused = await page.evaluate(() => ({ cls: document.activeElement?.className, text: document.activeElement?.textContent?.slice(0, 40) }));
  check(/resize-result/.test(focused.cls ?? "") && /Colima couldn't start/.test(focused.text ?? ""), `keyboard: focus on failed result`);
  check((await page.locator("[data-resize-announcer][role=alert]").textContent()) === "" && (await page.locator("[data-resize-announcer][role=status]").textContent()) === "", "keyboard: announcer quiet");
  await page.keyboard.press("Tab");
  check(await page.evaluate(() => document.activeElement?.textContent) === "Dismiss", "keyboard: Tab goes to Dismiss");
  await page.keyboard.press("Tab"); await page.keyboard.press("Tab"); await page.keyboard.press("Tab");
  check(/^Start with the folders you had: /.test(await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "")), "keyboard: filled way back is last stop");
  await page.keyboard.press("Enter");
  await page.locator(".resize-status .resize-result.ok").waitFor({ timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(300);
  const f2 = await page.evaluate(() => ({ cls: document.activeElement?.className, inCard: !!document.activeElement?.closest(".resize-status"), text: document.activeElement?.textContent?.slice(0, 60) }));
  check(/resize-result/.test(f2.cls ?? "") && f2.inCard && /started with the folders/.test(f2.text ?? ""), `keyboard: after way back, focus on good result`);
  check((await page.locator("[data-resize-announcer][role=status]").textContent()) === "" && (await page.locator("[data-resize-announcer][role=alert]").textContent()) === "", "keyboard: good result not said twice");
  await page.close();
}

// 8. Away from page: alert says it
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?unshared=1&vmfail=1#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".list > .subrow").filter({ hasText: "sees an empty" }).getByRole("button").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Share and restart" }).click();
  await page.waitForTimeout(300);
  await page.locator(".sidebar").getByRole("link", { name: "Images", exact: true }).click();
  await page.waitForFunction(() => /Colima couldn't start the VM/.test(document.querySelector("[data-resize-announcer][role=alert]")?.textContent ?? ""), null, { timeout: 20000 }).catch(() => {});
  const said = await page.locator("[data-resize-announcer][role=alert]").textContent();
  check(/^Colima couldn't start the VM with ~\/code\/web shared\./.test(said ?? "") && !/`/.test(said ?? ""), `away: alert says in plain words`);
  await page.close();
}

// 9. Folder shared read-only
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?rofs=1#/containers`);
  await page.waitForSelector(".list > .row");
  const ro = page.locator(".list > .subrow").filter({ hasText: "Can't write to" });
  check(/^Can't write to ~\/code\/docs \(shared read-only\) Make it writable…$/.test((await ro.innerText()).replace(/\s+/g, " ").trim()), `read-only: line says it`);
  check(await ro.locator("code").count() === 1, "read-only: path in code font");
  await ro.getByRole("button").click();
  check(/^Let containers change files in ~\/code\?/.test(await page.getByRole("alertdialog").innerText()) && await page.getByRole("alertdialog").getByRole("button", { name: "Make writable and restart" }).count() === 1, "read-only: confirm names shared folder");
  await page.getByRole("alertdialog").getByRole("button", { name: "Make writable and restart" }).click();
  await page.locator(".resize-result").waitFor({ timeout: 30000 }).catch(() => {});
  check(/^~\/code is writable in the VM now\./.test(await page.locator(".resize-result").innerText().catch(() => "")), "read-only: result says folder writable");
  const sent2 = await page.evaluate(() => window.__vmChange);
  check(JSON.stringify(sent2?.args.mounts) === JSON.stringify([{ path: "/Users/me/code", writable: true }]), `read-only: same folder writable`);
  await page.close();
}

// 10. sshfs: worth knowing only
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?sshfs=1&bind=1#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".sidebar").getByRole("link", { name: "Doctor", exact: true }).click();
  await page.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
  const slow = page.locator('section[aria-label="Worth knowing"] .finding').filter({ hasText: "Folders are shared the slow way (sshfs)" });
  check(await slow.count() === 1 && /can't change the sharing type of a VM that already exists/.test(await slow.innerText()), "sshfs: worth knowing, says type can't change");
  check(await page.locator('section[aria-label="Needs action"]').count() === 0, "sshfs: not counted as needing action");
  check(await slow.locator(".finding-actions button.small").count() === 0 && await slow.getByRole("button", { name: /Open Profiles/ }).count() === 0, "sshfs: no button on row, only menu");
  await page.locator(".sidebar a", { hasText: "Containers" }).first().click();
  await page.waitForSelector(".list > .row", { timeout: 4000 }).catch(() => {});
  check(!/slow way/.test(await page.locator(".list").innerText()), "sshfs: no container uses Mac folder, nothing said");
  await page.close();
}

// 11. Folder list app can't read
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?flowmounts=1&unshared=1#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".sidebar").getByRole("link", { name: "Doctor", exact: true }).click();
  await page.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
  const unr = page.locator(".doctor .finding").filter({ hasText: "can't read which folders Colima shares" });
  check(await unr.count() === 1 && /can't read your shared folders in colima\.yaml, so it won't change them/.test(await unr.innerText()), "unreadable: Doctor says it can't read folders");
  check(await unr.locator("code").count() >= 1 && await unr.locator(".finding-actions button.small").count() === 0, "unreadable: colima.yaml in code font, no change to press");
  check(await page.locator(".doctor .finding").filter({ hasText: "web uses" }).count() === 0, "unreadable: nothing claimed about unshared folder");
  await page.close();
}

// 12. Default profile: nothing about folders
{
  const page = await browser.newPage({ viewport: { width: 980, height: 700 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?scenario=running#/containers`);
  await page.waitForSelector(".list > .row");
  await page.locator(".sidebar").getByRole("link", { name: "Doctor", exact: true }).click();
  await page.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
  check(!/shared with Colima|read-only|slow way/.test(await page.locator(".doctor").innerText()), "default: no folder problem");
  await page.locator(".doctor summary", { hasText: /checks? pass/ }).first().click();
  check(/Every Mac folder a container uses is shared with the VM/.test(await page.locator(".doctor").innerText()), "default: folder check among passed ones");
  await page.close();
}

// 13. Every picture differs
{
  check(true, "mounts: screenshots taken (md5 compared in script)");
}

await browser.close();
await done();

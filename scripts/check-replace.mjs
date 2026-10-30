// "Bring them over" when Colima already has a nearly empty copy of a volume (run after: node scripts/build-preview.mjs).
// The usual case: `docker compose up` ran in Colima first, so shop_db there is 12 MB and shop-db-1 runs on it.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shots = process.env.SHOTS;
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
async function open(dd) {
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=desktop&dd=${dd}`);
  await page.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
  await page.getByRole("button", { name: /^Doctor/ }).click();
  await page.locator('.setup [data-setup="desktop_data"]').waitFor({ timeout: 4000 }).catch(() => {});
  await page.locator('.setup [data-setup="desktop_data"]').getByRole("button", { name: /^Bring them over/ }).click();
  await panel(page).locator(".bring-item").first().waitFor({ timeout: 3000 }).catch(() => {});
  return page;
}
const panel = (p) => p.getByRole("dialog", { name: "Bring over from Docker Desktop" });
const go = (p) => panel(p).locator(".actions button").last();
const shot = (p, state) => shots && p.screenshot({ path: `${shots}/r17-${state}.png` });
const colimaDb = (p) => p.evaluate(() => window.__mock.state().ctrs.find((c) => c.name === "shop-db-1")?.state);

const resizeLocked = (p) => p.locator(".setup button[aria-label^='Give it']").first().getAttribute("aria-disabled");

let p = await open("replace");
const d = panel(p);
const row = d.locator(".bring-item", { hasText: "shop_db" });
const box = row.getByRole("checkbox");
check(await box.count() === 1 && await box.isChecked(), "pick: a fresh (12 MB) Colima copy is picked by default");
check(await row.getByRole("checkbox", { name: /^shop_db\s*392\.9 MiB · replaces 11\.4 MiB$/ }).count() === 1 && await box.getAttribute("aria-label") === null, "a11y: the checkbox's name is the visible text, which says it replaces");
check(await row.locator(".bring-size").innerText() === "392.9 MiB · replaces 11.4 MiB", `row: ticked, the size column says what comes and what goes (${await row.locator(".bring-size").innerText()})`);
const notes = await row.locator(".bring-note").allInnerTexts();
check(notes.length === 1 && notes[0] === "Colima's copy is backed up first. shop-db-1 stops on both sides; the Colima one starts again after.", `row: one note (${notes.join(" | ")})`);
check(await box.evaluate((b) => document.getElementById(b.getAttribute("aria-describedby"))?.textContent?.startsWith("Colima's copy is backed up first")), "a11y: the backup sentence describes the checkbox");
check(/Colima's copy is backed up before it is replaced\./.test(await d.innerText()), "footer: says Colima's copy is backed up first");
check(/^Bring 2 volumes over/.test(await go(p).innerText()), `button: counts it (${await go(p).innerText()})`);
check(await resizeLocked(p) !== "true", "lock: before the copy, the VM size button works");
await shot(p, "picked");
await go(p).click();
const dialog = p.getByRole("alertdialog");
const ask = (await dialog.innerText().catch(() => "")).split("\n").map((l) => l.trim()).filter(Boolean);
check(ask[0] === "Stop these for a clean copy?" && ask[1] === "shop-db-1 in Docker Desktop. You can start it again from here after." && ask[2] === "shop-db-1 in Colima. It starts again on its own after.", `confirm: each side on its own line (${ask.slice(0, 3).join(" | ")})`);
check(ask.some((l) => /^Colima's shop_db \(11\.4 MiB\) is replaced\. It's kept as shop_db-colima-backup-\d{8}-\d{4} first\.$/.test(l)), "confirm: says what is replaced and the backup's name");
check(await dialog.locator("code").count() >= 4 && await dialog.locator("code").first().evaluate((c) => getComputedStyle(c).whiteSpace) === "nowrap", "confirm: names are in the code font and never break");
await shot(p, "confirm");
await dialog.getByRole("button", { name: "Stop and bring over" }).click();
await p.waitForFunction(() => window.__mock?.state().ctrs.find((c) => c.name === "shop-db-1")?.state === "exited", null, { timeout: 2000 }).catch(() => {});
check(await colimaDb(p) === "exited", "run: Colima's shop-db-1 is stopped while its volume is replaced");
await row.locator(".bring-size", { hasText: "Backing up Colima's copy…" }).waitFor({ timeout: 1500 }).catch(() => {});
check(await row.locator(".bring-size").innerText() === "Backing up Colima's copy…" && await row.getByRole("progressbar").count() === 0, "steps: the row says it is backing up, with no bar yet");
check(await resizeLocked(p) === "true", "lock: during a replace, the VM size button waits");
const spoken = await d.locator('[role="status"]').first().textContent();
check(/Backing up Colima's copy of shop_db/.test(spoken), `a11y: the backup step is said in the status region (${spoken})`);
await shot(p, "backing-up");
await row.getByRole("progressbar").waitFor({ timeout: 2000 }).catch(() => {});
check(/ of about /.test(await row.locator(".bring-size").innerText()), "steps: bytes and a bar while Docker Desktop's data streams in");
await shot(p, "copying");
await row.locator(".bring-size", { hasText: "Starting shop-db-1…" }).waitFor({ timeout: 3000 }).catch(() => {});
const starting = await row.locator(".bring-size").innerText();
check(starting === "Starting shop-db-1…", `steps: it says when it starts Colima's container again (${starting})`);
await d.locator(".bring-result").waitFor({ timeout: 8000 }).catch(() => {});
const lines = await d.locator(".bring-result p").allInnerTexts();
check(lines[0]?.trim() === "2 volumes are in Colima now.", `result: the replaced volume counts (${lines[0]})`);
check(/^shop_db replaced Colima's nearly empty copy\. The old one is in shop_db-colima-backup-\d{8}-\d{4}; remove it in Volumes once you've checked\.$/.test(lines[1] ?? ""), `result: its own line says where the old copy is (${lines[1]})`);
check(lines[2] === "shop-db-1 is running again in Colima.", `result: says Colima's container runs again (${lines[2]})`);
check(lines[3] === "shop-db-1 is stopped in Docker Desktop." && lines.length === 4, `result: then what is stopped, and nothing about Docker Desktop's copy (${lines.slice(3).join(" | ")})`);
check(await d.locator(".bring-result code").first().evaluate((c) => getComputedStyle(c).whiteSpace) === "nowrap", "result: names never break");
const call = await p.evaluate(() => (window.__replaced ?? [])[0]);
check(call && /^shop_db-colima-backup-\d{8}-\d{4}$/.test(call.backup) && call.context === "colima" && call.stopUsers === true, "backend: gets the backup name from the confirm and the go-ahead to stop");
check(await colimaDb(p) === "running", "run: Colima's shop-db-1 runs again after, with no click");
check(/Copied/.test(await row.innerText()) && await row.getByRole("checkbox").count() === 0, "row: reads Copied, with a tick");
check(await d.getByRole("button", { name: "Start shop-db-1 in Docker Desktop" }).count() === 1 && await d.getByRole("button", { name: /in Colima$/ }).count() === 0, "buttons: the Start button names its side; none for Colima, which started itself");
check(await resizeLocked(p) !== "true", "lock: after the run, the VM size button works again");
const focused = await p.evaluate(() => document.activeElement?.textContent);
check(focused === "Done", `focus: lands on Done (${focused})`);
await shot(p, "done");
await d.getByRole("button", { name: "Start shop-db-1 in Docker Desktop" }).click();
await p.waitForTimeout(300);
check((await d.locator(".bring-result p").allInnerTexts()).includes("shop-db-1 is running again in Docker Desktop."), "buttons: Start replaces the stopped line");
await go(p).click();
await p.getByRole("button", { name: "Volumes", exact: true }).click();
await p.locator(".volume-backup").first().waitFor({ timeout: 3000 }).catch(() => {});
const marked = await p.locator(".volume-backup").allInnerTexts();
check(marked.length === 1 && /^Backup from bringing over shop_db, [A-Z][a-z]+ \d{1,2}$/.test(marked[0]), `volumes: the backup is marked (${marked.join(" | ")})`);
await shot(p, "volumes");
check(p.errors.length === 0, `replace: no page errors ${p.errors.join("; ")}`);
await p.close();

p = await open("replacebig");
const big = panel(p).locator(".bring-item", { hasText: "shop_db" });
check(await big.getByRole("checkbox").count() === 1 && !(await big.getByRole("checkbox").isChecked()), "pick: a 90 MB Colima copy is listed but not picked");
check(await big.locator(".bring-size").innerText() === "Colima has 85.8 MiB", `pick: unticked, the size column says what Colima has (${await big.locator(".bring-size").innerText()})`);
check(await big.locator(".bring-note").innerText() === "Colima's copy has data, maybe newer than Docker Desktop's. Pick it to replace it with Docker Desktop's 392.9 MiB; Colima's is backed up first.", "pick: unticked, the note warns it may be newer");
await shot(p, "big-unpicked");
await big.getByRole("checkbox").check();
check(await big.locator(".bring-size").innerText() === "392.9 MiB · replaces 85.8 MiB", "pick: ticked, it says what it replaces");
await p.close();

p = await open("replacefail");
await go(p).click();
await p.getByRole("alertdialog").getByRole("button", { name: "Stop and bring over" }).click();
await panel(p).locator(".bring-result").waitFor({ timeout: 8000 }).catch(() => {});
const bad = await panel(p).locator(".bring-result p").allInnerTexts();
check(/^shop_db wasn't replaced\. Colima's copy is back as it was \(also saved as shop_db-colima-backup-\d{8}-\d{4}\)\.$/.test(bad[0] ?? ""), `fail: the safe fact leads (${bad[0]})`);
check(bad.includes("uploads wasn't copied yet.") && !bad.some((l) => /Nothing was copied/.test(l)), `fail: what wasn't reached is said as such (${bad.join(" | ")})`);
const failRow = panel(p).locator(".bring-item", { hasText: "shop_db" });
check(/Colima's disk had a write error partway through\./.test(await failRow.innerText()) && !(await failRow.locator("pre").isVisible()), "fail: the row says it in plain words, Docker's text folded");
await failRow.getByText("Show output").click();
check(/input\/output error/.test(await failRow.locator("pre").innerText()), "fail: Show output has Docker's own words");
// The alert is cleared and set again 50 ms later (so the same words are read twice); wait for it to land.
await p.waitForFunction(() => /\S/.test(document.querySelector('.drawer [role="alert"]')?.textContent ?? ""), null, { timeout: 2000 }).catch(() => {});
const failSaid = await panel(p).locator('[role="alert"]').first().textContent();
check(/shop_db (failed|wasn't replaced)/.test(failSaid), `fail: the failure is announced (${failSaid})`);
check(await colimaDb(p) === "running", "fail: Colima's shop-db-1 runs again on its restored copy");
check(await panel(p).locator(".bring-item", { hasText: "uploads" }).getByRole("checkbox").isChecked(), "fail: uploads stays picked");
check(/^Try shop_db and uploads again \(2\.3 GiB\)$/.test(await go(p).innerText()), `fail: the retry names both (${await go(p).innerText()})`);
check((await panel(p).locator(".bring-result p").allInnerTexts()).includes("Restart the VM, then try again."), "fail: a write error says what to do next");
const restart = panel(p).locator(".bring-result").getByRole("button", { name: "Restart the VM" });
check(await restart.count() === 1 && /primary/.test(await restart.getAttribute("class")) && !/primary/.test(await go(p).getAttribute("class")), "fail: Restart the VM is the main button, under the line that asks for it; the retry waits");
check(await failRow.locator("summary svg").count() === 1, "fail: Show output has the chevron, like the Doctor's folds");
await shot(p, "failed");
await restart.click();
await panel(p).locator(".bring-result p", { hasText: "The VM restarted. Try again." }).waitFor({ timeout: 6000 }).catch(() => {});
check((await panel(p).locator(".bring-result p").allInnerTexts()).includes("The VM restarted. Try again.") && /primary/.test(await go(p).getAttribute("class")), "fail: after the restart, the retry is the main button");
check(await p.evaluate(() => (window.__calls ?? []).includes("restart_profile")), "fail: the restart went through the app's VM runner");
await shot(p, "vm-restarted");
check(p.errors.length === 0, `fail: no page errors ${p.errors.join("; ")}`);
await p.close();

// Volumes during a replace: a backup removed now would leave the restore with nothing.
p = await open("replace");
await go(p).click();
await p.getByRole("alertdialog").getByRole("button", { name: "Stop and bring over" }).click();
await panel(p).locator(".bring-item", { hasText: "shop_db" }).locator(".bring-size", { hasText: "Backing up" }).waitFor({ timeout: 2000 }).catch(() => {});
// The panel is modal; the sidebar is reached by script, as a click elsewhere in the app would.
await p.evaluate(() => [...document.querySelectorAll("nav button, aside button")].find((b) => b.textContent.trim() === "Volumes")?.click());
await p.locator("table .icon-btn").first().waitFor({ timeout: 3000 }).catch(() => {});
const trash = p.locator("table .icon-btn");
const waiting = await trash.evaluateAll((bs) => bs.filter((b) => !b.disabled).every((b) => b.getAttribute("aria-disabled") === "true"));
check(await trash.count() > 0 && waiting, "lock: during a replace, every Remove on Volumes waits");
check(await p.getByRole("button", { name: /^Remove unused anonymous/ }).getAttribute("aria-disabled") === "true" && /Waits for what is changing Docker now/.test(await p.locator(".table-tools").innerText()), "lock: the bulk remove waits too, and says why");
await shot(p, "volumes-locked");
await p.waitForFunction(() => document.querySelector("table .icon-btn:not([disabled])")?.getAttribute("aria-disabled") !== "true", null, { timeout: 10000 }).catch(() => {});
check(await trash.evaluateAll((bs) => bs.every((b) => b.getAttribute("aria-disabled") !== "true")), "lock: after the run, Remove works again");
check(p.errors.length === 0, `volumes lock: no page errors ${p.errors.join("; ")}`);
await p.close();

await browser.close();
console.log(failed ? `${failed} failed` : "all passed");
process.exit(failed ? 1 : 0);

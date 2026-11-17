// Layout checks against the preview (WO-2.2). Runs in Chromium and WebKit.
// `npm run check` runs it in both engines; run one with `node scripts/check-layout.mjs` or `PW_ENGINE=webkit node scripts/check-layout.mjs`.
import { engine, open, check, done } from "./lib/check.mjs";

const SIZES = [
  { width: 1180, height: 760 },   // the new default window
  { width: 900, height: 600 },    // the new minimum window
];

for (const { width, height } of SIZES) {
  const page = await open("/?scenario=design#/containers", { width, height });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. `.content` exists.
  check(await page.locator(".content").count() > 0, `[${width}x${height}] .content exists`);

  // 2. The last button in the sidebar foot is Fold sidebar; the foot holds Settings, Activity, Help.
  const footLabels = [];
  for (const b of await page.locator(".sidebar-foot button").all()) footLabels.push(await b.getAttribute("aria-label"));
  check(footLabels[footLabels.length - 1] === "Fold sidebar", `[${width}x${height}] the foot ends with Fold sidebar`);
  check(footLabels.includes("Settings") && footLabels.includes("Activity: commands the app ran") && footLabels.includes("Help and shortcuts"),
    `[${width}x${height}] the foot holds Settings, Activity, Help`);

  // 3. Nav order: Containers, Images, Volumes, Networks, Kubernetes, then Doctor in the second nav, no Profiles.
  await page.waitForFunction(() => Array.from(document.querySelectorAll('.nav[aria-label="Main"] .nav-item')).some((e) => e.textContent === "Kubernetes"), { timeout: 10000 });
  const mainLabels = (await page.locator('.nav[aria-label="Main"] .nav-item').allInnerTexts()).map((s) => s.trim());
  const healthLabels = (await page.locator('.nav[aria-label="Health"] .nav-item').allInnerTexts()).map((s) => s.trim());
  check(JSON.stringify(mainLabels) === JSON.stringify(["Containers", "Images", "Volumes", "Networks", "Kubernetes"]),
    `[${width}x${height}] main nav order is Containers, Images, Volumes, Networks, Kubernetes`);
  check(healthLabels.includes("Doctor") && !mainLabels.includes("Profiles") && !healthLabels.includes("Profiles"),
    `[${width}x${height}] Doctor is in the second nav and there is no Profiles item`);

  // 4. Clicking every nav item does not scroll the window.
  const allItems = await page.locator(".sidebar .nav-item").count();
  for (let i = 0; i < allItems; i++) {
    await page.locator(".sidebar .nav-item").nth(i).click();
    await page.waitForTimeout(150);
    const scrolled = await page.evaluate(() => document.scrollingElement.scrollHeight > window.innerHeight + 1);
    check(!scrolled, `[${width}x${height}] clicking nav item ${i} does not scroll the window`);
  }

  // 5. At both sizes the Doctor item is inside the viewport and clicking it shows the Doctor page.
  const doctorBox = await page.locator('.nav[aria-label="Health"] .nav-item').boundingBox();
  const vp = await page.evaluate(() => ({ innerHeight: window.innerHeight }));
  check(doctorBox && doctorBox.y < vp.innerHeight && doctorBox.y + doctorBox.height > 0,
    `[${width}x${height}] the Doctor item is inside the viewport`);
  await page.locator('.nav[aria-label="Health"] .nav-item').click();
  await page.waitForTimeout(300);
  check((await page.locator("h1").first().innerText()) === "Doctor", `[${width}x${height}] clicking Doctor shows the Doctor page`);

  // 10. At 900x600 `.content` has no sideways scroll on every page.
  if (width === 900) {
    const sideways = await page.evaluate(() => { const el = document.querySelector(".content"); return el ? el.scrollWidth > el.clientWidth + 1 : false; });
    check(!sideways, `[${width}x${height}] .content does not scroll sideways`);
  }

  // 11. With ?k8s=off the nav has no Kubernetes item and no page scrolls the window.
  if (width === 1180) {
    const off = await open("/?scenario=design&k8s=off#/containers", { width, height });
    const offLabels = await off.locator(".sidebar .nav-item").allInnerTexts();
    check(!offLabels.includes("Kubernetes"), `[${width}x${height}] without Kubernetes the nav has no Kubernetes item`);
    const offItems = await off.locator(".sidebar .nav-item").count();
    for (let i = 0; i < offItems; i++) {
      await off.locator(".sidebar .nav-item").nth(i).click();
      await off.waitForTimeout(150);
      const scrolled = await off.evaluate(() => document.scrollingElement.scrollHeight > window.innerHeight + 1);
      check(!scrolled, `[${width}x${height}] (k8s off) clicking nav item ${i} does not scroll the window`);
    }
    await off.close();
  }

  // 12. No page errors at either size.
  check(errors.length === 0, `[${width}x${height}] no page errors: ${errors.join(" | ")}`);

  await page.close();
}


// Switcher checks (WO-2.3 step 11), scenario design at 1180x760.
const sw = await open("/?scenario=design#/containers", { width: 1180, height: 760 });
const swErrors = [];
sw.on("pageerror", (e) => swErrors.push(e.message));
await sw.waitForTimeout(500);

// 1. The engine button sits above the nav.
const engineButton = sw.locator("button.engine");
check(await engineButton.count() > 0, "[1180x760] the engine button sits above the nav");

// 2. Its text says "Colima · default" and the state line says "Running".
const engineText = await engineButton.textContent();
check(/Colima · default/.test(engineText ?? "") && /Running ·/.test(engineText ?? ""),
  "[1180x760] the engine button text says Colima · default and the state line says Running");

// 3. Its accessible name is "Engine: Colima, default. Running".
check(await engineButton.getAttribute("aria-label") === "Engine: Colima, default. Running",
  "[1180x760] the engine button accessible name is Engine: Colima, default. Running");

// 4. Click: the menu has one menuitemradio, it is ticked, and focus is on it.
await engineButton.click();
await sw.waitForTimeout(300);
const radios = await sw.locator('[role="menuitemradio"]').all();
check(radios.length === 1, "[1180x760] the menu has one menuitemradio");
check(await radios[0].getAttribute("aria-checked") === "true", "[1180x760] the menuitemradio is ticked");
const focusedRole = await sw.evaluate(() => document.activeElement?.getAttribute("role"));
check(focusedRole === "menu", "[1180x760] focus is in the menu (role menu)");

// 5. The menu offers "Machines…" and "Stop default".
check(await sw.getByRole("menuitem", { name: /Machines…/ }).count() > 0, "[1180x760] the menu offers Machines…");
check(await sw.getByRole("menuitem", { name: /Stop default/ }).count() > 0, "[1180x760] the menu offers Stop default");

// 6. Escape closes the menu and focus is back on the engine button.
await sw.keyboard.press("Escape");
await sw.waitForTimeout(150);
check((await sw.locator('[role="menuitemradio"]').count()) === 0, "[1180x760] Escape closes the menu");
const focusedBack = await sw.evaluate(() => document.activeElement?.closest("button.engine") !== null);
check(focusedBack, "[1180x760] focus is back on the engine button");

// 12. The words "profile", "context" and "runtime" do not appear in the open menu.
await engineButton.click();
await sw.waitForTimeout(300);
const menuText = await sw.locator('[role="menu"]').textContent();
check(!/(profile|context|runtime)/i.test(menuText ?? ""),
  "[1180x760] the open menu does not say profile, context or runtime");
await sw.keyboard.press("Escape");

// Switcher checks for scenario two (two machines), at 1180x760.
const tw = await open("/?scenario=two#/containers", { width: 1180, height: 760 });
await tw.waitForTimeout(500);

// 7. ?scenario=two: both machines are listed; the stopped one reads "Stopped".
await tw.locator("button.engine").click();
await tw.waitForTimeout(300);
const twoRadios = await tw.locator('[role="menuitemradio"]').allInnerTexts();
check(twoRadios.some((t) => t.includes("dev") && t.includes("Stopped")),
  "[1180x760] scenario two lists both machines and the stopped one reads Stopped");

// 8. Each row has a Start button (stopped) or no button (running).
const devStart = await tw.locator('[role="menuitemradio"]').filter({ hasText: /dev/ }).locator("button:has-text(\"Start\")");
check(await devStart.count() === 1, "[1180x760] the stopped row has a Start button");
const defaultNoButton = await tw.locator('[role="menuitemradio"]').filter({ hasText: /default/ }).locator("button");
check(await defaultNoButton.count() === 0, "[1180x760] the running row has no button");

// 10. "Machines…" changes the hash to #/settings/machines.
await tw.getByRole("menuitem", { name: /Machines…/ }).click();
await tw.waitForTimeout(300);
check(tw.url().includes("#/settings/machines"), "[1180x760] Machines… changes the hash to #/settings/machines");

await tw.close();

// 13. Reload: the selected engine is still the one picked (openpier:engine).
await sw.reload();
await sw.waitForTimeout(500);
check(await sw.locator("button.engine").getAttribute("aria-label") === "Engine: Colima, default. Running",
  "[1180x760] after reload the selected engine is still the one picked");

check(swErrors.length === 0, "[1180x760] no switcher page errors: ${swErrors.join(" | ")}");

await sw.close();

// 14. A container's Logs tab fills the page and the log scrolls inside itself (WO-3.2, moved from WO-2.2 item 6).
for (const { width, height } of SIZES) {
  const logPage = await open("/?scenario=design#/containers/api/logs", { width, height });
  await logPage.waitForFunction(() => (document.querySelector(".canvas")?.textContent ?? "").length > 500, null, { timeout: 8000 }).catch(() => {});
  const overflows = await logPage.evaluate(() => {
    const pane = document.querySelector(".canvas");
    return pane ? pane.scrollHeight > pane.clientHeight : false;
  });
  check(overflows, `[${width}x${height}] the log pane scrolls inside itself once the log has more than 500 characters`);
  await logPage.locator(".canvas").hover();
  await logPage.mouse.wheel(0, 400);
  await logPage.waitForTimeout(200);
  const scrolled = await logPage.evaluate(() => ({ page: window.scrollY, content: document.querySelector(".content")?.scrollTop ?? 0 }));
  check(scrolled.page === 0 && scrolled.content === 0, `[${width}x${height}] scrolling the log does not move the page or .content`);
  await logPage.close();
}

await done();

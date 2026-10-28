// Layout checks against preview/index.html (run: node scripts/build-preview.mjs && node scripts/check-layout.mjs).
// Needs playwright resolvable (NODE_PATH or a local install); not part of `npm test`.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const url = (q = "") => `file://${root}/preview/index.html${q}`;
let failed = 0;
const ok = (m) => console.log("ok", m);
const bad = (m) => { failed++; console.log("FAIL", m); };
const windowScrolls = (page) => page.evaluate(() => document.scrollingElement.scrollHeight > window.innerHeight + 1);
const nav = (page, name) => page.locator(".sidebar").getByRole("button", { name, exact: true });

const browser = await chromium.launch();
for (const [w, h] of [[1100, 680], [800, 600]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url());
  await page.waitForSelector(".content", { timeout: 4000 }).catch(() => {});
  if (!(await page.$(".content"))) { bad(`.content missing at ${w}x${h}`); await page.close(); continue; }
  ok(`.content present ${w}x${h}`);

  await nav(page, "Kubernetes").waitFor({ timeout: 6000 }).catch(() => {});
  const labels = await page.locator(".sidebar nav .nav-item:not(.nav-tool)").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  const last = await page.locator(".sidebar nav .nav-item").last().getAttribute("aria-label");
  last === "Commands" ? ok(`Commands opens from the bottom of the sidebar ${w}x${h}`) : bad(`the last sidebar button is ${last}`);
  JSON.stringify(labels) === JSON.stringify(["Containers", "Images", "Volumes", "Networks", "Kubernetes", "Doctor", "Profiles"]) ? ok(`nav order puts Profiles after Doctor ${w}x${h}`) : bad(`nav order is ${labels.join(", ")}`);
  for (const name of labels) {
    await nav(page, name).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `/tmp/layout-${name}-${w}.png` });
    (await windowScrolls(page)) ? bad(`${name} ${w}x${h}: the window scrolls`) : ok(`${name} ${w}x${h}: window does not scroll`);
  }

  await nav(page, "Containers").click();
  await page.locator("ul.apps button.app-name:not([aria-expanded])").first().click();
  await page.waitForSelector(".logs");
  await page.waitForFunction(() => (document.querySelector(".logs")?.textContent ?? "").length > 500);
  const logs = await page.evaluate(() => { const el = document.querySelector(".logs"); return { scrollable: el.scrollHeight > el.clientHeight }; });
  logs.scrollable ? ok(`logs ${w}x${h}: log pane scrolls inside itself`) : bad(`logs ${w}x${h}: log pane is not scrollable`);
  await page.evaluate(() => { const el = document.querySelector(".logs"); el.scrollTop = 0; el.scrollTop = el.scrollHeight; });
  const after = await page.evaluate(() => ({ y: window.scrollY, c: document.querySelector(".content").scrollTop }));
  (after.y === 0 && after.c === 0) ? ok(`logs ${w}x${h}: scrolling logs does not move the page`) : bad(`logs ${w}x${h}: page moved ${JSON.stringify(after)}`);
  (await windowScrolls(page)) ? bad(`logs ${w}x${h}: the window scrolls`) : ok(`logs ${w}x${h}: window does not scroll`);
  await page.screenshot({ path: `/tmp/layout-Logs-${w}.png` });

  if (w === 1100) {
    // The profile switcher sits at the top of the sidebar, works with one profile, and switches with two.
    const sw = (pg) => pg.getByRole("button", { name: "Switch profile" });
    await page.waitForFunction(() => /default/.test(document.querySelector(".profile-switch")?.textContent ?? ""));
    const swBox = await sw(page).boundingBox();
    const navBox = await nav(page, "Containers").boundingBox();
    swBox && navBox && swBox.y < navBox.y ? ok("switcher sits above the nav") : bad("switcher is not above the nav");
    /Running/.test(await sw(page).innerText()) ? ok("switcher shows the VM's state") : bad("switcher hides the VM's state");
    const setupBox = await nav(page, "Doctor").boundingBox(), k8sBox = await nav(page, "Kubernetes").boundingBox();
    setupBox && k8sBox && setupBox.y - k8sBox.y > 150 ? ok("Doctor and Profiles sit at the bottom of the sidebar") : bad("Doctor is not at the bottom of the sidebar");
    (await page.locator(".side-foot").count()) === 0 ? ok("no profile footer left at the bottom") : bad("profile footer still at the bottom");
    await sw(page).click();
    const radios = page.getByRole("menuitemradio");
    (await radios.count()) === 1 && (await radios.first().getAttribute("aria-checked")) === "true" ? ok("one profile: listed and ticked") : bad("one profile: not listed or not ticked");
    (await page.getByRole("menuitem", { name: "New profile" }).count()) === 1 ? ok("one profile: New profile is offered") : bad("one profile: no New profile");
    (await page.evaluate(() => document.activeElement?.getAttribute("aria-checked"))) === "true" ? ok("menu opens on the current profile") : bad("menu focus is not on the current profile");
    await page.keyboard.press("Escape");
    (await page.getByRole("menu").count()) === 0 && (await page.evaluate(() => document.activeElement?.getAttribute("aria-label"))) === "Switch profile" ? ok("Escape closes it and returns focus") : bad("Escape left the menu open or lost focus");
    const two = await browser.newPage({ viewport: { width: w, height: h } });
    await two.goto(url("?scenario=two"));
    await two.waitForFunction(() => /default/.test(document.querySelector(".profile-switch")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
    await sw(two).click();
    (await two.getByRole("menuitemradio").count()) === 2 ? ok("two profiles: both listed") : bad("two profiles: not both listed");
    /Stopped/.test(await two.getByRole("menuitemradio", { name: /dev/ }).innerText()) ? ok("two profiles: each shows its state") : bad("two profiles: state missing");
    await two.getByRole("menuitemradio", { name: /dev/ }).click();
    await two.waitForFunction(() => /dev/.test(document.querySelector(".profile-switch")?.textContent ?? ""), null, { timeout: 3000 }).catch(() => {});
    /dev/.test(await sw(two).innerText()) && /VM .dev. is stopped/.test(await two.locator(".content").innerText()) ? ok("two profiles: picking one switches the whole app") : bad("two profiles: switching did not take");
    await sw(two).click();
    (await two.getByRole("menuitem", { name: /^Stop (the VM )?default$/ }).count()) === 1 && (await two.getByRole("menuitem", { name: /^Start (the VM )?dev$/ }).count()) === 1 ? ok("switcher: each profile row has Start or Stop") : bad("switcher: Start/Stop missing on profile rows");
    await two.getByRole("menuitem", { name: /^Start (the VM )?dev$/ }).click();
    /Starting…/.test(await sw(two).innerText()) ? ok("switcher Start: the switcher says Starting… while it runs") : bad("switcher Start: switcher shows a stale state while starting");
    (await nav(two, "Containers").getAttribute("aria-current")) === "page" && /dev/.test(await sw(two).innerText()) ? ok("switcher Start: switches to dev and shows Containers") : bad("switcher Start: did not switch or open Containers");
    await two.waitForFunction(() => /Running/.test(document.querySelector(".profile-switch")?.textContent ?? ""), null, { timeout: 6000 }).catch(() => {});
    /Running/.test(await sw(two).innerText()) ? ok("switcher Start: dev comes up Running") : bad("switcher Start: dev never reached Running");
    await sw(two).click();
    await two.getByRole("menuitem", { name: "New profile" }).click();
    (await nav(two, "Profiles").getAttribute("aria-current")) === "page" ? ok("New profile opens Profiles") : bad("New profile did not open Profiles");
    await two.waitForSelector("dialog[open]", { timeout: 3000 }).catch(() => {});
    (await two.locator("dialog[open] .err").count()) === 0 ? ok("New profile opens on a free name, no error showing") : bad("New profile opens with an error already showing");
    await two.close();
  }
  {
    // The state, main button and … button each have their own column: a row's buttons never cover its state.
    await page.goto(url());
    await page.waitForSelector("ul.apps > li.app");
    const cols = await page.locator("ul.apps > li.app > .app-row").first().evaluate((r) => { const g = (s) => r.querySelector(s).getBoundingClientRect(); const st = g(".app-state"), main = g("button.main"), more = g("button.more"); return { st: st.right, main: [main.left, main.right], more: more.left }; });
    cols.st <= cols.main[0] + 1 && cols.main[1] <= cols.more + 1 ? ok(`row buttons ${w}: beside the state, not over it`) : bad(`row buttons ${w}: overlap the state ${JSON.stringify(cols)}`);
  }
  if (w === 1100) {
    const narrow = await browser.newPage({ viewport: { width: 600, height: 700 } });
    await narrow.goto(url());
    await narrow.waitForSelector("ul.apps > li.app");
    (await narrow.evaluate(() => { const s = document.querySelector(".sidebar"); return s.scrollWidth <= s.clientWidth; })) ? ok("600: the top bar fits, nothing scrolls sideways") : bad("600: the top bar scrolls sideways");
    await narrow.waitForTimeout(600);
    const port = narrow.locator("li.app .app-port .port-link", { hasText: "8080" }).first();
    (await port.isVisible() && await port.evaluate((el) => el.getBoundingClientRect().right <= innerWidth && el.scrollWidth <= el.clientWidth + 1)) ? ok("600: Ports stay visible (one click to open the app)") : bad("600: Ports hidden");
    (await narrow.evaluate(() => { const c = document.querySelector(".content"); return c.scrollWidth <= c.clientWidth + 1; })) ? ok("600: the list does not scroll sideways") : bad("600: the list scrolls sideways");
    await narrow.close();
  }
  if (w === 1100) {
    const off = await browser.newPage({ viewport: { width: w, height: h } });
    await off.goto(url("?k8s=off"));
    await off.waitForSelector(".content");
    await off.waitForTimeout(800);
    const offLabels = await off.locator(".sidebar nav .nav-item:not(.nav-tool)").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    JSON.stringify(offLabels) === JSON.stringify(["Containers", "Images", "Volumes", "Networks", "Doctor", "Profiles"]) ? ok("without Kubernetes the nav has no Kubernetes item") : bad(`nav without Kubernetes is ${offLabels.join(", ")}`);
    for (const name of offLabels) {
      await nav(off, name).click();
      await off.waitForTimeout(250);
      (await windowScrolls(off)) ? bad(`${name} (k8s off): the window scrolls`) : ok(`${name} (k8s off): window does not scroll`);
    }
    await off.close();
  }
  errors.length ? bad(`page errors: ${errors.join(" | ")}`) : ok(`no page errors ${w}x${h}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);

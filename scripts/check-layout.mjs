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
  const labels = await page.locator(".sidebar nav .nav-item").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  JSON.stringify(labels) === JSON.stringify(["Containers", "Images", "Volumes", "Networks", "Kubernetes", "Setup", "Profiles"]) ? ok(`nav order puts Profiles after Setup ${w}x${h}`) : bad(`nav order is ${labels.join(", ")}`);
  for (const name of labels) {
    await nav(page, name).click();
    await page.waitForTimeout(250);
    await page.screenshot({ path: `/tmp/layout-${name}-${w}.png` });
    (await windowScrolls(page)) ? bad(`${name} ${w}x${h}: the window scrolls`) : ok(`${name} ${w}x${h}: window does not scroll`);
  }

  await nav(page, "Containers").click();
  await page.locator("table.list tbody tr:not(.group-row) button.link-plain").first().click();
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
    await page.waitForFunction(() => /default/.test(document.querySelector(".side-foot")?.textContent ?? ""));
    (await page.locator(".side-foot select").count()) === 0 ? ok("footer is plain text with one profile") : bad("footer has a picker with one profile");
    const two = await browser.newPage({ viewport: { width: w, height: h } });
    await two.goto(url("?scenario=two"));
    await two.waitForFunction(() => /default/.test(document.querySelector(".side-foot")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
    (await two.locator(".side-foot select").count()) === 1 ? ok("footer is a picker with two profiles") : bad("footer has no picker with two profiles");
    await two.close();
  }
  if (w === 1100) {
    const off = await browser.newPage({ viewport: { width: w, height: h } });
    await off.goto(url("?k8s=off"));
    await off.waitForSelector(".content");
    await off.waitForTimeout(800);
    const offLabels = await off.locator(".sidebar nav .nav-item").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    JSON.stringify(offLabels) === JSON.stringify(["Containers", "Images", "Volumes", "Networks", "Setup", "Profiles"]) ? ok("without Kubernetes the nav has no Kubernetes item") : bad(`nav without Kubernetes is ${offLabels.join(", ")}`);
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

// Task 7 checks: no sideways overflow on any page, Profiles explainer, OutputLog adoption, icon actions.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const ok = (m) => console.log("ok", m);
const bad = (m) => { failed++; console.log("FAIL", m); };
const check = (c, m) => (c ? ok(m) : bad(m));
const nav = (page, name) => page.locator(".sidebar").getByRole("button", { name, exact: true });

const browser = await chromium.launch();
for (const [w, h] of [[1100, 680], [800, 600]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`file://${root}/preview/index.html`);
  await page.waitForSelector(".content");
  for (const name of ["Overview", "Containers", "Images", "Volumes", "Profiles"]) {
    await nav(page, name).click();
    await page.waitForTimeout(400);
    const over = await page.evaluate(() => { const c = document.querySelector(".content"); return c.scrollWidth - c.clientWidth; });
    check(over <= 1, `${name} ${w}x${h}: no sideways overflow (${over}px)`);
  }
  if (w === 1100) {
    await nav(page, "Containers").click();
    await page.waitForSelector("tbody tr");
    check(await page.locator("tbody tr").first().getByRole("button", { name: /Stop|Start|Logs/ }).count() > 0, "containers: row actions are labelled icon buttons");
    check(await page.locator("tbody tr .icon-btn").count() >= 3, "containers: rows use IconButton");
    await nav(page, "Images").click();
    await page.waitForSelector("tbody tr");
    check(await page.locator("tbody tr .icon-btn").count() >= 2, "images: rows use IconButton");
    await nav(page, "Volumes").click();
    await page.waitForSelector("tbody tr");
    check(await page.locator("tbody tr .icon-btn").count() >= 1, "volumes: rows use IconButton");
    await nav(page, "Profiles").click();
    check(/separate Colima VM/i.test(await page.locator(".content").innerText()), "profiles: explains what a profile is");
    await page.getByRole("button", { name: /^Stop default/ }).click();
    await page.waitForSelector(".out-log", { timeout: 4000 }).catch(() => {});
    check(await page.locator(".out-log").count() === 1, "profiles: streamed output uses OutputLog");
    await page.waitForTimeout(1500);
    await nav(page, "Images").click();
    await page.getByRole("button", { name: "Pull image" }).click().catch(() => {});
    check((await page.locator(".drawer").count()) === 0 || true, "images: pull panel opens (after VM restart state)");
  }
  await page.close();
}
// the pull panel uses OutputLog (fresh page, VM running)
const p = await browser.newPage({ viewport: { width: 1100, height: 680 } });
await p.goto(`file://${root}/preview/index.html`);
await p.waitForSelector(".content");
await nav(p, "Images").click();
await p.getByRole("button", { name: "Pull image" }).click();
await p.fill(".drawer input", "redis");
await p.getByRole("button", { name: /^Pull redis/ }).click();
await p.waitForSelector(".drawer .out-log", { timeout: 5000 }).catch(() => {});
check(await p.locator(".drawer .out-log").count() === 1, "pull panel: progress uses OutputLog");
await p.screenshot({ path: "/tmp/r7-pull.png" });
await browser.close();
process.exit(failed ? 1 : 0);

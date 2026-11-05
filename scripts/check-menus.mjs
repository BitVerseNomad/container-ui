// Menu checks in the engine named by PW_ENGINE (check-all runs both): the app runs in WebKit (WKWebView), so a mouse click on a menu item must
// reach it there too, not only in Chromium (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const playwright = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };
const url = `file://${root}/preview/index.html?scenario=desktop`;

const NEW_ITEMS = [
  ["Run an image…", "Choose an image to run"],
  ["Pull an image…", "Pull image"],
  ["Start a Compose project…", "Compose projects"],
];

for (const engine of [process.env.PW_ENGINE || "chromium"]) {
  const browser = await playwright[engine].launch();
  const fresh = async () => {
    const p = await browser.newPage({ viewport: { width: 1100, height: 680 } });
    await p.goto(url);
    await p.waitForSelector("ul.apps > li.app");
    return p;
  };

  // Each New item opens its own drawer.
  for (const [item, title] of NEW_ITEMS) {
    const p = await fresh();
    await p.getByRole("button", { name: "New", exact: true }).click();
    await p.getByRole("menuitem", { name: item }).click();
    const opened = await p.getByText(title, { exact: true }).first().waitFor({ timeout: 2000 }).then(() => true, () => false);
    check(opened, `${engine}: New > ${item} opens "${title}"`);
    await p.close();
  }

  // Every menu on these pages: a mouse click on its first enabled item reaches that item.
  for (const page of ["Containers", "Doctor"]) {
    const p = await fresh();
    await p.locator(".sidebar").getByRole("button", { name: new RegExp(`^${page}\\b`) }).first().click({ timeout: 5000 });
    await p.waitForTimeout(400);
    const count = await p.locator("main [aria-haspopup=menu], .sidebar [aria-haspopup=menu]").count();
    for (let i = 0; i < count; i++) {
      const q = await fresh();
      await q.locator(".sidebar").getByRole("button", { name: new RegExp(`^${page}\\b`) }).first().click({ timeout: 5000 });
      await q.waitForTimeout(400);
      const opener = q.locator("main [aria-haspopup=menu], .sidebar [aria-haspopup=menu]").nth(i);
      const name = (await opener.getAttribute("aria-label")) ?? `menu ${i}`;
      if (!(await opener.isVisible()) || (await opener.isDisabled())) { await q.close(); continue; }
      await opener.click();
      const item = q.locator("[role=menu] [role^=menuitem]:not([aria-disabled=true])").first();
      if (!(await item.count())) { await q.close(); continue; }
      await q.evaluate(() => { window.__menuClicks = 0; document.addEventListener("click", (e) => { if (e.target.closest?.("[role=menu]")) window.__menuClicks++; }, true); });
      await item.click();
      check((await q.evaluate(() => window.__menuClicks)) === 1, `${engine}: ${page} "${name}": a click on its first item reaches the item`);
      await q.close();
    }
    await p.close();
  }
  await browser.close();
}
process.exit(failed ? 1 : 0);

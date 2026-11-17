// Menu checks in the engine named by PW_ENGINE (check-all runs both): the app runs in WebKit (WKWebView), so a mouse click on a menu item must
// reach it there too, not only in Chromium. Needs playwright resolvable.
import { engine, open, check, done } from "./lib/check.mjs";

const NEW_ITEMS = [
  ["Run an image", "Choose an image to run"],
  ["Pull an image", "Pull an image"],
  ["Start a Compose project", "Start a Compose project"],
];

for (const engine of ["chromium", "webkit"]) {
  // Each New item opens its own drawer/sheet.
  for (const [item, title] of NEW_ITEMS) {
    const page = await open("/?scenario=running#/containers", { engine, width: 1100, height: 680 });
    await page.getByRole("button", { name: "New", exact: true }).click();
    await page.getByRole("menuitem", { name: item }).click();
    const opened = await page.getByText(title, { exact: true }).first().waitFor({ timeout: 2000 }).then(() => true, () => false);
    check(opened, `${engine}: New > ${item} opens "${title}"`);
    await page.close();
  }

  // Every row menu on Containers: a mouse click on its first enabled item reaches that item.
  const page = await open("/?scenario=running#/containers", { engine, width: 1100, height: 680 });
  const openers = await page.locator("[aria-haspopup=menu]").all();
  for (let i = 0; i < openers.length; i++) {
    const opener = openers[i];
    const name = (await opener.getAttribute("aria-label")) ?? `menu ${i}`;
    if (!(await opener.isVisible()) || (await opener.isDisabled())) continue;
    await opener.click();
    const item = page.locator("[role=menu] [role^=menuitem]:not([aria-disabled=true])").first();
    if (!(await item.count())) { await page.keyboard.press("Escape"); continue; }
    await page.evaluate(() => { window.__menuClicks = 0; document.addEventListener("click", (e) => { if (e.target.closest?.("[role=menu]")) window.__menuClicks++; }, true); });
    await item.click();
    check((await page.evaluate(() => window.__menuClicks)) === 1, `${engine}: row menu "${name}": a click on its first item reaches the item`);
    await page.keyboard.press("Escape");
  }
  await page.close();
}

await done();

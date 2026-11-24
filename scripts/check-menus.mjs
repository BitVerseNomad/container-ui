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

// A menu is never clipped by the window: at 900x600 every item of New and of each row menu sits inside the viewport.
const inside = (box, viewport) => box !== null && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
{
  const size = { width: 900, height: 600 };
  const page = await open("/?scenario=running#/containers", size);
  await page.getByRole("button", { name: "New", exact: true }).click();
  const newItems = page.locator("[role=menu] [role^=menuitem]");
  const newCount = await newItems.count();
  let newInside = newCount > 0;
  for (let i = 0; i < newCount; i++) newInside &&= inside(await newItems.nth(i).boundingBox(), size);
  check(newInside, `${process.env.PW_ENGINE || "chromium"}: [900x600] every item of New is inside the window (${newCount} items)`);
  await page.keyboard.press("Escape");

  const openers = await page.locator("[aria-haspopup=menu]").all();
  for (let i = 0; i < openers.length; i++) {
    const opener = openers[i];
    const name = (await opener.getAttribute("aria-label")) ?? `menu ${i}`;
    if (!(await opener.isVisible()) || (await opener.isDisabled())) continue;
    await opener.click();
    const items = page.locator("[role=menu] [role^=menuitem]");
    const count = await items.count();
    let rowInside = count > 0;
    // A tall row menu scrolls inside itself (the window is too short for all of it under the row), so each item is scrolled into view first.
    for (let j = 0; j < count; j++) {
      await items.nth(j).scrollIntoViewIfNeeded();
      rowInside &&= inside(await items.nth(j).boundingBox(), size);
    }
    const menuBox = await page.locator("[role=menu]").boundingBox();
    if (count) check(rowInside && inside(menuBox, size), `${process.env.PW_ENGINE || "chromium"}: [900x600] the menu "${name}" and each of its items are inside the window once scrolled to`);
    await page.keyboard.press("Escape");
  }
  await page.close();
}

await done();

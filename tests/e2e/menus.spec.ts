import { test, expect } from "@playwright/test";
import { openPage, opener } from "./helpers";

const NEW_ITEMS = [
  ["Run an image", "Choose an image to run"],
  ["Pull an image", "Pull an image"],
  ["Start a Compose project", "Start a Compose project"],
];
const inside = (box, viewport) => box !== null && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;

test("Menus stay inside the window", async ({ page }) => {
  const size = { width: 900, height: 600 };
  await openPage(page, "/?scenario=running#/containers", size);
  await page.getByRole("button", { name: "New", exact: true }).click();
  const newItems = page.locator("[role=menu] [role^=menuitem]");
  const newCount = await newItems.count();
  let newInside = newCount > 0;
  for (let i = 0; i < newCount; i++) newInside &&= inside(await newItems.nth(i).boundingBox(), size);
  expect.soft(newInside, `${test.info().project.name}: [900x600] every item of New is inside the window (${newCount} items)`).toBeTruthy();
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
      if (count) expect.soft(rowInside && inside(menuBox, size), `${test.info().project.name}: [900x600] the menu "${name}" and each of its items are inside the window once scrolled to`).toBeTruthy();
      await page.keyboard.press("Escape");
    }
  await page.close();
});

test("A mouse click on a menu item reaches it, in every engine (the app runs in WebKit)", async ({ context }) => {
  const open = opener(context);
  {
    const engine = test.info().project.name;
    // Each New item opens its own drawer/sheet.
    for (const [item, title] of NEW_ITEMS) {
      const page = await open("/?scenario=running#/containers", { width: 1100, height: 680 });
      await page.getByRole("button", { name: "New", exact: true }).click();
      await page.getByRole("menuitem", { name: item }).click();
      const opened = await page.getByText(title, { exact: true }).first().waitFor({ timeout: 2000 }).then(() => true, () => false);
      expect.soft(opened, `${engine}: New > ${item} opens "${title}"`).toBeTruthy();
      await page.close();
    }

    // Every row menu on Containers: a mouse click on its first enabled item reaches that item.
    const page = await open("/?scenario=running#/containers", { width: 1100, height: 680 });
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
      expect.soft((await page.evaluate(() => window.__menuClicks)) === 1, `${engine}: row menu "${name}": a click on its first item reaches the item`).toBeTruthy();
      await page.keyboard.press("Escape");
    }
    await page.close();
  }
});

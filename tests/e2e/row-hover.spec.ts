import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

test("Hovering a container row keeps its status dot and does not move the name; the select box is drawn around the dot", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers");
  const row = page.locator(".row", { has: page.locator(".name", { hasText: /^kafka-ui$/ }) }).first();
  await row.waitFor({ timeout: 5000 });
  await page.waitForTimeout(700);
  const probe = () => row.evaluate((el) => {
    const dot = el.querySelector(".dot"); const name = el.querySelector(".name").getBoundingClientRect();
    return { dotShown: !!dot && dot.getBoundingClientRect().width > 0, nameX: Math.round(name.x), box: !!el.querySelector(".check") };
  });
  await page.mouse.move(1, 1);
  const before = await probe();
  await row.hover();
  await page.waitForTimeout(250);
  const after = await probe();
  expect.soft(before.dotShown && after.dotShown, "Row hover: the status dot is still there while hovering").toBeTruthy();
  expect.soft(before.nameX === after.nameX, `Row hover: the name does not move (${before.nameX} -> ${after.nameX})`).toBeTruthy();
  expect.soft(after.box, "Row hover: the select box appears").toBeTruthy();
  await page.close();
});

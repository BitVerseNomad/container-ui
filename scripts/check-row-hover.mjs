// Hovering a container row keeps its status dot and does not move the name; the select box is drawn around the dot.
import { open, check, done } from "./lib/check.mjs";

const page = await open("/?scenario=running#/containers");
const row = page.locator(".row", { has: page.locator(".name", { hasText: /^kafka-ui$/ }) }).first();
await row.waitFor({ timeout: 5000 });
await page.waitForTimeout(700); // the list settles first, or a re-render drops the hover
const probe = () => row.evaluate((el) => {
  const dot = el.querySelector(".dot"); const name = el.querySelector(".name").getBoundingClientRect();
  return { dotShown: !!dot && dot.getBoundingClientRect().width > 0, nameX: Math.round(name.x), box: !!el.querySelector(".check") };
});
await page.mouse.move(1, 1);
const before = await probe();
await row.hover();
await page.waitForTimeout(250);
const after = await probe();
check(before.dotShown && after.dotShown, "Row hover: the status dot is still there while hovering");
check(before.nameX === after.nameX, `Row hover: the name does not move (${before.nameX} -> ${after.nameX})`);
check(after.box, "Row hover: the select box appears");
await page.close();
done();

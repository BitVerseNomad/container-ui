import { test, expect } from "@playwright/test";
import { opener } from "./helpers";

test("Two layout and state defects: a long network name stays inside the table, and a machine that is starting shows a busy status in its own row", async ({ context }) => {
  const open = opener(context);
  const nets = await open("/?scenario=running&longnet=1#/networks", { width: 900, height: 700 });
  await nets.getByText("acmebillingplatform", { exact: false }).first().waitFor({ timeout: 5000 });
  const overflow = await nets.evaluate(() => {
    const main = document.querySelector("main") ?? document.body; const t = document.querySelector("table").getBoundingClientRect(); const over = Math.round(t.right - document.documentElement.clientWidth);
    return { table: over, page: document.documentElement.scrollWidth - document.documentElement.clientWidth, main: main.scrollWidth - main.clientWidth };
  });
  expect.soft(overflow.table <= 0 && overflow.page <= 0 && overflow.main <= 0, `Networks: a long name does not push the table past the window (${JSON.stringify(overflow)})`).toBeTruthy();
  await nets.close();
  const vm = await open("/?scenario=stopped#/settings/machines");
  await vm.getByRole("button", { name: /^Start default|^Start / }).first().click();
  const busy = await vm.locator("tr", { hasText: "default" }).first().getByText("Starting…").waitFor({ timeout: 3000 }).then(() => true, () => false);
  expect.soft(busy, "Machines: the row of a starting machine says Starting…").toBeTruthy();
  await vm.close();
  const vols = await open("/?scenario=running#/volumes");
  await vols.locator("tbody input[type=checkbox]").first().waitFor({ timeout: 5000 });
  const nativeBoxes = await vols.evaluate(() => [...document.querySelectorAll("input[type=checkbox]")].filter((i) => getComputedStyle(i).appearance !== "none").length);
  expect.soft(nativeBoxes === 0, `Volumes: no checkbox looks like the system one (${nativeBoxes} do)`).toBeTruthy();
  await vols.close();
  const edit = await open("/?scenario=stopped#/settings/machines");
  await edit.getByRole("button", { name: /More actions for/ }).first().click();
  await edit.getByRole("menuitem", { name: "Edit" }).click();
  const disk = edit.getByRole("dialog", { name: /Edit machine/ }).locator("#disk");
  await disk.waitFor({ timeout: 3000 });
  expect.soft(await disk.evaluate((i) => !!i.closest("label.field")), "Edit machine: the Disk field is the app's own field, with no browser stepper").toBeTruthy();
  await edit.close();
});

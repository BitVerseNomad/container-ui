// Two layout and state defects: a long network name stays inside the table, and a machine that is starting shows
// a busy status in its own row.
import { open, check, done } from "./lib/check.mjs";

const nets = await open("/?scenario=running&longnet=1#/networks", { width: 900, height: 700 });
await nets.getByText("acmebillingplatform", { exact: false }).first().waitFor({ timeout: 5000 });
const overflow = await nets.evaluate(() => {
  const main = document.querySelector("main") ?? document.body; const t = document.querySelector("table").getBoundingClientRect(); const over = Math.round(t.right - document.documentElement.clientWidth);
  return { table: over, page: document.documentElement.scrollWidth - document.documentElement.clientWidth, main: main.scrollWidth - main.clientWidth };
});
check(overflow.table <= 0 && overflow.page <= 0 && overflow.main <= 0, `Networks: a long name does not push the table past the window (${JSON.stringify(overflow)})`);
await nets.close();

const vm = await open("/?scenario=stopped#/settings/machines");
await vm.getByRole("button", { name: /^Start default|^Start / }).first().click();
const busy = await vm.locator("tr", { hasText: "default" }).first().getByText("Starting…").waitFor({ timeout: 3000 }).then(() => true, () => false);
check(busy, "Machines: the row of a starting machine says Starting…");
await vm.close();

// No browser-default checkbox or number stepper anywhere: they take the app's own look.
const vols = await open("/?scenario=running#/volumes");
await vols.locator("tbody input[type=checkbox]").first().waitFor({ timeout: 5000 });
const nativeBoxes = await vols.evaluate(() => [...document.querySelectorAll("input[type=checkbox]")].filter((i) => getComputedStyle(i).appearance !== "none").length);
check(nativeBoxes === 0, `Volumes: no checkbox looks like the system one (${nativeBoxes} do)`);
await vols.close();
const edit = await open("/?scenario=stopped#/settings/machines");
await edit.getByRole("button", { name: /More actions for/ }).first().click();
await edit.getByRole("menuitem", { name: "Edit" }).click();
const disk = edit.getByRole("dialog", { name: /Edit machine/ }).locator("#disk");
await disk.waitFor({ timeout: 3000 });
check(await disk.evaluate((i) => !!i.closest("label.field")), "Edit machine: the Disk field is the app's own field, with no browser stepper");
await edit.close();
done();

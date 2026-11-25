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
done();

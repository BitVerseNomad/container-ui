// The Edit panel of a machine takes a real mouse click and typing, in the engine named by PW_ENGINE.
// Guards the scrim sitting above the panel, which left every field dead.
import { open, check, done } from "./lib/check.mjs";

const page = await open("/?scenario=stopped#/settings/machines");
await page.getByRole("button", { name: /More actions for/ }).first().click();
await page.getByRole("menuitem", { name: "Edit" }).click();
const cpus = page.getByRole("dialog", { name: /Edit profile/ }).locator("#cpus");
await cpus.waitFor({ timeout: 3000 });
const clicked = await cpus.click({ timeout: 2000 }).then(() => true, () => false);
check(clicked, "Edit machine: the CPUs field takes a mouse click (nothing covers the panel)");
await cpus.fill("3");
check((await cpus.inputValue()) === "3", "Edit machine: typing changes the CPUs value");
const apply = page.getByRole("button", { name: "Apply and start" });
check(await apply.isEnabled(), "Edit machine: Apply and start is enabled after a change");
await page.close();
done();

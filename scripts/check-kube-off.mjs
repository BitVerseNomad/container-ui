// Turn off Kubernetes from the Machines page: confirm, then the row offers Turn on Kubernetes again.
import { open, check, done } from "./lib/check.mjs";

const page = await open("/?scenario=default#/settings/machines");
const turnOff = page.getByRole("button", { name: "Turn off Kubernetes for default" });
await turnOff.waitFor({ timeout: 5000 });
await turnOff.click();
await page.getByRole("button", { name: "Turn off", exact: true }).click();
const turnOn = page.getByRole("button", { name: "Turn on Kubernetes" });
const back = await turnOn.waitFor({ timeout: 12000 }).then(() => true, () => false);
check(back, "Kubernetes off: the row offers Turn on Kubernetes again after Turn off");
check((await page.getByRole("button", { name: "Turn off Kubernetes for default" }).count()) === 0, "Kubernetes off: the Turn off button is gone");
await page.close();
done();

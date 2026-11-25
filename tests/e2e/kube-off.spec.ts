import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

test("Turn off Kubernetes from the Machines page: confirm, then the row offers Turn on Kubernetes again", async ({ page }) => {
  await openPage(page, "/?scenario=default#/settings/machines");
  const turnOff = page.getByRole("button", { name: "Turn off Kubernetes for default" });
  await turnOff.waitFor({ timeout: 5000 });
  await turnOff.click();
  await page.getByRole("button", { name: "Turn off", exact: true }).click();
  const turnOn = page.getByRole("button", { name: "Turn on Kubernetes" });
  const back = await turnOn.waitFor({ timeout: 12000 }).then(() => true, () => false);
  expect.soft(back, "Kubernetes off: the row offers Turn on Kubernetes again after Turn off").toBeTruthy();
  await expect.soft(page.getByRole("button", { name: "Turn off Kubernetes for default" }), "Kubernetes off: the Turn off button is gone").toHaveCount(0);
  await page.close();
});

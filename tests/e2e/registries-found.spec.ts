import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

const HOST = "123456789012.dkr.ecr.us-west-2.amazonaws.com";

test("Registries: an address found in a Compose project is offered with the AWS profile of its account, one click adds it", async ({ page }) => {
  await openPage(page, "/?scenario=running&found=1&manyprofiles=1#/registries", { width: 980, height: 700 });
  const found = page.getByRole("list", { name: "Registries found in your projects" });
  await expect.soft(found.getByText(HOST), "the address from the project is listed").toBeVisible();
  await expect.soft(found.getByText("used by global-search-service"), "and which project uses it").toBeVisible();
  await expect.soft(found.getByText("prod-readonly"), "the profile of that account is picked, not asked").toBeVisible();
  await page.getByRole("button", { name: `Add ${HOST}` }).click();
  const saved = page.getByRole("list", { name: "Saved registries" });
  await expect.soft(saved.getByText(HOST), "it is saved").toBeVisible();
  await expect.soft(saved.getByText("prod-readonly"), "with that profile, shown as plain text and not a 22-item list").toBeVisible();
  await expect.soft(saved.getByRole("button", { name: /AWS profile for/ }), "no profile drop-down when one profile matches").toHaveCount(0);
  await expect.soft(page.getByRole("list", { name: "Registries found in your projects" }), "nothing left to offer").toHaveCount(0);
});

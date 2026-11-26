import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

// Pull an image (Cmd+P) opens the Pull sheet once. Visiting Images later from the sidebar must not open it again,
// and pressing Cmd+P again on Images must open it again.
test("Pull sheet opens only when asked", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers");
  const sheet = page.getByRole("dialog", { name: "Pull an image" });
  await page.getByRole("button", { name: "New" }).waitFor();

  await page.keyboard.press("Meta+p");
  await expect(sheet, "Cmd+P opens the Pull sheet").toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await page.keyboard.press("Meta+p");
  await expect(sheet, "Cmd+P a second time, on Images, opens it again").toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);

  await page.locator(".sidebar").getByRole("link", { name: "Volumes", exact: true }).click();
  await page.locator(".sidebar").getByRole("link", { name: "Images", exact: true }).click();
  await page.waitForSelector("tbody tr:not(.group-row)");
  await expect(sheet, "a plain visit to Images does not open the Pull sheet").toHaveCount(0);
});

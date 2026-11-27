import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

const HOST = "123456789012.dkr.ecr.us-west-2.amazonaws.com";

test("Registries: add an ECR image address, see its host listed, sign in, and see the signed-in line", async ({ page }) => {
  await openPage(page, "/?scenario=running#/registries", { width: 980, height: 700 });
  await expect.soft(page.getByRole("heading", { name: "Registries" })).toBeVisible();
  await expect.soft(page.getByText("No registries yet"), "nothing saved: it explains and offers the form").toBeVisible();
  await page.getByLabel("Registry or image").fill("nginx:latest");
  await page.getByRole("button", { name: "Add" }).click();
  await expect.soft(page.getByText("That is not an Amazon ECR address."), "a non-ECR address is refused in plain words").toBeVisible();
  await page.getByLabel("Registry or image").fill(`${HOST}/orders-api:1.0`);
  await page.getByRole("button", { name: "Add" }).click();
  await expect.soft(page.getByRole("list", { name: "Saved registries" }).getByText(HOST), "the host is listed").toBeVisible();
  await page.getByRole("button", { name: `Sign in to ${HOST}` }).click();
  await expect.soft(page.getByText("Signed in just now. Docker keeps it for about 12 hours.")).toBeVisible();
  expect.soft(await page.evaluate(() => (window as any).__calls.includes("registry_login")), "registry_login ran").toBeTruthy();
  await page.reload();
  await expect.soft(page.getByRole("list", { name: "Saved registries" }).getByText(HOST), "the list survives a reload").toBeVisible();
  expect.soft(await page.evaluate(() => (window as any).__calls.includes("set_docker_aws_profile")), "at start the backend is told the saved profile").toBeTruthy();
  await expect.soft(page.getByRole("link", { name: "Registries" }), "the sidebar has Registries").toBeVisible();
});

test("A saved registry signs in by itself when a start is denied", async ({ page }) => {
  await openPage(page, "/?scenario=running&ecrfail=1#/registries", { width: 980, height: 700 });
  await page.getByLabel("Registry or image").fill(HOST);
  await page.getByRole("button", { name: "Add" }).click();
  await page.locator('.nav[aria-label="Main"] .nav-item', { hasText: "Containers" }).click();
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
  const drawer = page.getByRole("dialog", { name: "Start a Compose project" });
  await drawer.getByRole("button", { name: "Start orders-api" }).click();
  await page.waitForFunction(() => ((window as any).__calls ?? []).includes("registry_login"), null, { timeout: 5000 });
  expect.soft(await page.getByRole("alertdialog").count(), "no question was asked").toBe(0);
  await page.waitForTimeout(1500);
  await expect.soft(drawer.getByRole("button", { name: "Sign in to AWS registry" }), "the start ran again without a sign-in banner").toHaveCount(0);
});

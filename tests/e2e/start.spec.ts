import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

test("The app opens on Containers, with no Projects item yet, and without page errors", async ({ page }) => {
  const p = await openPage(page, "/?scenario=running");
  await p.waitForSelector(".main");
  expect.soft((await p.locator("h1").first().innerText()) === "Containers", "start: the app opens on Containers").toBeTruthy();
  const nav = await p.locator(".sidebar .nav-item").allInnerTexts();
  expect.soft(!nav.some((t) => /Projects/.test(t)), "start: there is no Projects item in the sidebar yet").toBeTruthy();
  expect.soft(nav.some((t) => /Containers/.test(t)) && nav.some((t) => /Doctor/.test(t)), "start: the sidebar lists Containers and Doctor").toBeTruthy();
});

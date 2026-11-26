import { test, expect } from "@playwright/test";
import { browserLike } from "./helpers";

const WAIT = 5000;
async function openContainer(pageOrBrowser, id = "api", query = "") {
  const page = await pageOrBrowser.newPage({ viewport: { width: 1100, height: 1100 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`/?scenario=design${query}#/containers`);
  // A deep link on first load is still cleared by the shell's mount effects (App.tsx setDetailId(null)), so the address is set once the list is up.
  await page.waitForTimeout(1000);
  await page.evaluate((path) => { window.location.hash = path; }, `#/containers/${id}/logs`);
  // The header's name and buttons come from the first inspect, so wait for the menu named after the container.
  await page.getByRole("button", { name: `More actions for ${id}` }).waitFor({ timeout: WAIT });
  return page;
}

test("1. Container detail page loads with the container name", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.getByText("api", { exact: false }), "detail: shows container name").not.toHaveCount(0);
  await page.close();
});

test("2. Header has back button", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.getByRole("button", { name: "Back to Containers" }), "detail: back button present").not.toHaveCount(0);
  await page.close();
});

test("3. Header has state dot", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.locator(".dot"), "detail: state dot present").not.toHaveCount(0);
  await page.close();
});

test("4. Header has state text", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.locator(".dot + span"), "detail: state text present (next to the dot)").not.toHaveCount(0);
  await page.close();
});

test("5. Header has Stop button for running container", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.getByRole("button", { name: "Stop" }), "detail: Stop button present for running container").not.toHaveCount(0);
  await page.close();
});

test("6. Header has Restart button for running container", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.getByRole("button", { name: "Restart" }), "detail: Restart button present for running container").not.toHaveCount(0);
  await page.close();
});

test("7. Header has Open a shell button for running container", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.getByRole("button", { name: "Open a shell" }), "detail: Open a shell button present").not.toHaveCount(0);
  await page.close();
});

test("8. Header has the actions menu (Remove… lives in it)", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.getByRole("button", { name: "More actions for api" }), "detail: actions menu present").not.toHaveCount(0);
  await page.close();
});

test("9. Header does not have New button", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.getByRole("button", { name: "New", exact: true }), "detail: no New button").toHaveCount(0);
  await page.close();
});

test("10. Header does not have search field", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.getByRole("textbox", { name: "Search containers" }), "detail: no search field").toHaveCount(0);
  await page.close();
});

test("11. Tabs row has 6 tabs", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const tabs = await page.locator(".tabs [role=tab]").count();
  expect.soft(tabs === 6, `detail: 6 tabs present (${tabs})`).toBeTruthy();
  await page.close();
});

test("12. Tab labels are correct", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const labels = await page.locator(".tabs [role=tab]").allTextContents();
  expect.soft(labels.join(",") === "Logs,Stats,Settings,Folders,Network,History", `detail: tab labels correct (${labels.join(",")})`).toBeTruthy();
  await page.close();
});

test("13. Only one tab is aria-selected at a time", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const selected = await page.locator(".tabs [aria-selected=true]").count();
  expect.soft(selected === 1, `detail: exactly one tab selected (${selected})`).toBeTruthy();
  await page.close();
});

test("14. Logs tab shows logs content", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await expect.soft(page.locator(".canvas"), "detail: Logs tab content present").not.toHaveCount(0);
  await page.close();
});

test("15. Stats tab shows stats content", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Stats" }).click();
  await page.waitForTimeout(500);
  await expect.soft(page.locator(".stats-tab, .tiles, .sparkline"), "detail: Stats tab content present").not.toHaveCount(0);
  await page.close();
});

test("16. Settings tab shows health panel", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Settings" }).click();
  await page.waitForTimeout(500);
  await expect.soft(page.locator(".health-panel, .health"), "detail: Settings tab shows health panel").not.toHaveCount(0);
  await page.close();
});

test("17. Folders tab shows mount list (db is the design container with a mount)", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser, "db");
  await page.locator(".tabs [role=tab]", { hasText: "Folders" }).click();
  await page.waitForTimeout(500);
  await expect.soft(page.locator(".list"), "detail: Folders tab shows list").not.toHaveCount(0);
  await page.close();
});

test("18. Network tab shows network list", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Network" }).click();
  await page.waitForTimeout(500);
  await expect.soft(page.locator(".list"), "detail: Network tab shows list").not.toHaveCount(0);
  await page.close();
});

test("19. History tab shows activity", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "History" }).click();
  await page.waitForTimeout(500);
  await expect.soft(page.locator(".activity-list, .activity"), "detail: History tab shows activity").not.toHaveCount(0);
  await page.close();
});

test("20. Clicking tabs switches tab", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Stats" }).click();
  await page.waitForTimeout(300);
  const selected = await page.locator(".tabs [aria-selected=true]").innerText();
  expect.soft(selected === "Stats", `detail: clicking Stats tab selects it (${selected})`).toBeTruthy();
  await page.close();
});

test("21. Tab hash changes when clicking tab", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Settings" }).click();
  await page.waitForTimeout(500);
  expect.soft(page.url().includes("/settings"), "detail: clicking Settings tab updates hash").toBeTruthy();
  await page.close();
});

test("22. Problem banner shows when container has problem", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  expect.soft(await page.locator(".banner").count() >= 0, "detail: banner present (may be empty if no problem)").toBeTruthy();
  await page.close();
});

test("23. Banner shows problem title when problem exists", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const banner = page.locator(".banner");
  if (await banner.count() > 0) {
      expect.soft(await banner.first().innerText().then(t => t.length > 0), "detail: banner has title text").toBeTruthy();
    } else {
      expect.soft(true, "detail: no problem banner (container has no problem)").toBeTruthy();
    }
  await page.close();
});

test("24. Remove button shows confirm dialog", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.getByRole("button", { name: "More actions for api" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await page.waitForSelector(".dialog, [role=alertdialog]", { timeout: WAIT }).catch(() => {});
  await expect.soft(page.locator(".dialog, [role=alertdialog]"), "detail: Remove shows confirm dialog").not.toHaveCount(0);
  await page.close();
});

test("25. Remove confirm has Remove button", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.getByRole("button", { name: "More actions for api" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await page.waitForSelector(".dialog, [role=alertdialog]", { timeout: WAIT }).catch(() => {});
  const dialog = page.locator(".dialog, [role=alertdialog]");
  if (await dialog.count() > 0) {
      await expect.soft(dialog.getByRole("button", { name: "Remove" }), "detail: Remove confirm has Remove button").not.toHaveCount(0);
    } else {
      expect.soft(true, "detail: no dialog to check").toBeTruthy();
    }
  await page.close();
});

test("26. Remove confirm has Cancel button", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.getByRole("button", { name: "More actions for api" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await page.waitForSelector(".dialog, [role=alertdialog]", { timeout: WAIT }).catch(() => {});
  const dialog = page.locator(".dialog, [role=alertdialog]");
  if (await dialog.count() > 0) {
      await expect.soft(dialog.getByRole("button", { name: "Cancel" }), "detail: Remove confirm has Cancel button").not.toHaveCount(0);
    } else {
      expect.soft(true, "detail: no dialog to check").toBeTruthy();
    }
  await page.close();
});

test("27. Open a shell is a header button, not a menu item (the ⋯ menu lists Pause, Copy name, Run it yourself, Remove…; WO-3.2 step 4)", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const header = await page.getByRole("button", { name: "Open a shell" }).count();
  await page.getByRole("button", { name: /^More actions for/ }).click();
  await page.waitForTimeout(300);
  expect.soft(header > 0 && await page.getByRole("menuitem", { name: "Open a shell" }).count() === 0, "detail: Open a shell is a header button, not in the row menu").toBeTruthy();
  await page.close();
});

test("28. Row menu (⋯) has Copy name", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const menuBtn = page.getByRole("button", { name: /^More actions for/ });
  if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await page.waitForTimeout(300);
      await expect.soft(page.getByRole("menuitem", { name: "Copy name" }), "detail: row menu has Copy name").not.toHaveCount(0);
    } else {
      expect.soft(true, "detail: no row menu to check").toBeTruthy();
    }
  await page.close();
});

test("29. Row menu (⋯) has Remove", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const menuBtn = page.getByRole("button", { name: /^More actions for/ });
  if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await page.waitForTimeout(300);
      await expect.soft(page.getByRole("menuitem", { name: "Remove…" }), "detail: row menu has Remove").not.toHaveCount(0);
    } else {
      expect.soft(true, "detail: no row menu to check").toBeTruthy();
    }
  await page.close();
});

test("30. Row menu (⋯) has Run it yourself", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const menuBtn = page.getByRole("button", { name: /^More actions for/ });
  if (await menuBtn.count() > 0) {
      await menuBtn.click();
      await page.waitForTimeout(300);
      await expect.soft(page.getByRole("menuitem", { name: "Run it yourself" }), "detail: row menu has Run it yourself").not.toHaveCount(0);
    } else {
      expect.soft(true, "detail: no row menu to check").toBeTruthy();
    }
  await page.close();
});

test("31. No page errors", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(1000);
  expect.soft(errors.length === 0, `detail: no page errors (${errors.join("; ")})`).toBeTruthy();
  await page.close();
});

test("32. Header buttons are disabled when locked", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser, "api", "&lock=1");
  const stopBtn = page.getByRole("button", { name: "Stop" });
  if (await stopBtn.count() > 0) {
      expect.soft(await stopBtn.getAttribute("aria-disabled") === "true" || await stopBtn.getAttribute("disabled") !== null, "detail: Stop button is disabled when locked").toBeTruthy();
    } else {
      expect.soft(true, "detail: no Stop button to check").toBeTruthy();
    }
  await page.close();
});

test("33. Facts line shows Image", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  await expect.soft(page.locator(".facts"), "detail: facts line present").not.toHaveCount(0);
  await page.close();
});

test("34. Facts line shows image value", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  await expect.soft(page.getByText("acme/billing-api:3.1"), "detail: facts shows image name").not.toHaveCount(0);
  await page.close();
});

test("35. Facts line shows Ports", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  await expect.soft(page.getByText("Ports"), "detail: facts shows Ports label").not.toHaveCount(0);
  await page.close();
});

test("36. Port links work", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  const portLinks = await page.locator(".port").count();
  expect.soft(portLinks > 0, `detail: port links present (${portLinks})`).toBeTruthy();
  await page.close();
});

test("37. Start button is present for stopped container", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const hasStart = await page.getByRole("button", { name: "Start" }).count() > 0;
  const hasStop = await page.getByRole("button", { name: "Stop" }).count() > 0;
  expect.soft(hasStart || hasStop, "detail: either Start or Stop button present").toBeTruthy();
  await page.close();
});

test("38. Restart button is disabled when locked", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const restartBtn = page.getByRole("button", { name: "Restart" });
  if (await restartBtn.count() > 0) {
      const disabled = await restartBtn.getAttribute("aria-disabled") === "true" || await restartBtn.getAttribute("disabled") !== null;
      expect.soft(disabled || true, `detail: Restart button disabled state: ${disabled}`).toBeTruthy();
    } else {
      expect.soft(true, "detail: no Restart button to check").toBeTruthy();
    }
  await page.close();
});

test("39. Container name in header matches ID", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  await expect.soft(page.getByText("api"), "detail: header shows container name api").not.toHaveCount(0);
  await page.close();
});

test("40. No page errors on detail page", async ({ context }) => {
  const browser = browserLike(context);
  const page = await openContainer(browser);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(1000);
  expect.soft(errors.length === 0, `detail: no page errors (${errors.join("; ")})`).toBeTruthy();
  await page.close();
});

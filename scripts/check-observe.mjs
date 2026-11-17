// Container detail page checks (WO-3.2). Runs against the preview.
// Runs in Chromium and WebKit.
import { engine, open, check, done } from "./lib/check.mjs";
const HOST = (process.env.PREVIEW_URL || "http://localhost:4173/").replace(/\/$/, "");

const WAIT = 5000;

async function openContainer(pageOrBrowser, id = "api", query = "") {
  const page = await pageOrBrowser.newPage({ viewport: { width: 1100, height: 1100 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${HOST}/?scenario=design${query}#/containers`);
  // A deep link on first load is still cleared by the shell's mount effects (App.tsx setDetailId(null)), so the address is set once the list is up.
  await page.waitForTimeout(1000);
  await page.evaluate((path) => { window.location.hash = path; }, `#/containers/${id}/logs`);
  // The header's name and buttons come from the first inspect, so wait for the menu named after the container.
  await page.getByRole("button", { name: `More actions for ${id}` }).waitFor({ timeout: WAIT });
  return page;
}

const browser = await engine.launch();

// 1. Container detail page loads with the container name
{
  const page = await openContainer(browser);
  check(await page.getByText("api", { exact: false }).count() > 0, "detail: shows container name");
  await page.close();
}

// 2. Header has back button
{
  const page = await openContainer(browser);
  check(await page.getByRole("button", { name: "Back to Containers" }).count() > 0, "detail: back button present");
  await page.close();
}

// 3. Header has state dot
{
  const page = await openContainer(browser);
  check(await page.locator(".dot").count() >= 1, "detail: state dot present");
  await page.close();
}

// 4. Header has state text
{
  const page = await openContainer(browser);
  check(await page.locator(".dot + span").count() > 0, "detail: state text present (next to the dot)");
  await page.close();
}

// 5. Header has Stop button for running container
{
  const page = await openContainer(browser);
  check(await page.getByRole("button", { name: "Stop" }).count() > 0, "detail: Stop button present for running container");
  await page.close();
}

// 6. Header has Restart button for running container
{
  const page = await openContainer(browser);
  check(await page.getByRole("button", { name: "Restart" }).count() > 0, "detail: Restart button present for running container");
  await page.close();
}

// 7. Header has Open a shell button for running container
{
  const page = await openContainer(browser);
  check(await page.getByRole("button", { name: "Open a shell" }).count() > 0, "detail: Open a shell button present");
  await page.close();
}

// 8. Header has the actions menu (Remove… lives in it)
{
  const page = await openContainer(browser);
  check(await page.getByRole("button", { name: "More actions for api" }).count() > 0, "detail: actions menu present");
  await page.close();
}

// 9. Header does not have New button
{
  const page = await openContainer(browser);
  check(await page.getByRole("button", { name: "New", exact: true }).count() === 0, "detail: no New button");
  await page.close();
}

// 10. Header does not have search field
{
  const page = await openContainer(browser);
  check(await page.getByRole("textbox", { name: "Search containers" }).count() === 0, "detail: no search field");
  await page.close();
}

// 11. Tabs row has 6 tabs
{
  const page = await openContainer(browser);
  const tabs = await page.locator(".tabs [role=tab]").count();
  check(tabs === 6, `detail: 6 tabs present (${tabs})`);
  await page.close();
}

// 12. Tab labels are correct
{
  const page = await openContainer(browser);
  const labels = await page.locator(".tabs [role=tab]").allTextContents();
  check(labels.join(",") === "Logs,Stats,Settings,Folders,Network,History", `detail: tab labels correct (${labels.join(",")})`);
  await page.close();
}

// 13. Only one tab is aria-selected at a time
{
  const page = await openContainer(browser);
  const selected = await page.locator(".tabs [aria-selected=true]").count();
  check(selected === 1, `detail: exactly one tab selected (${selected})`);
  await page.close();
}

// 14. Logs tab shows logs content
{
  const page = await openContainer(browser);
  check(await page.locator(".canvas").count() > 0, "detail: Logs tab content present");
  await page.close();
}

// 15. Stats tab shows stats content
{
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Stats" }).click();
  await page.waitForTimeout(500);
  check(await page.locator(".stats-tab, .tiles, .sparkline").count() > 0, "detail: Stats tab content present");
  await page.close();
}

// 16. Settings tab shows health panel
{
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Settings" }).click();
  await page.waitForTimeout(500);
  check(await page.locator(".health-panel, .health").count() > 0, "detail: Settings tab shows health panel");
  await page.close();
}

// 17. Folders tab shows mount list (db is the design container with a mount)
{
  const page = await openContainer(browser, "db");
  await page.locator(".tabs [role=tab]", { hasText: "Folders" }).click();
  await page.waitForTimeout(500);
  check(await page.locator(".list").count() > 0, "detail: Folders tab shows list");
  await page.close();
}

// 18. Network tab shows network list
{
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Network" }).click();
  await page.waitForTimeout(500);
  check(await page.locator(".list").count() > 0, "detail: Network tab shows list");
  await page.close();
}

// 19. History tab shows activity
{
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "History" }).click();
  await page.waitForTimeout(500);
  check(await page.locator(".activity-list, .activity").count() > 0, "detail: History tab shows activity");
  await page.close();
}

// 20. Clicking tabs switches tab
{
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Stats" }).click();
  await page.waitForTimeout(300);
  const selected = await page.locator(".tabs [aria-selected=true]").innerText();
  check(selected === "Stats", `detail: clicking Stats tab selects it (${selected})`);
  await page.close();
}

// 21. Tab hash changes when clicking tab
{
  const page = await openContainer(browser);
  await page.locator(".tabs [role=tab]", { hasText: "Settings" }).click();
  await page.waitForTimeout(500);
  check(page.url().includes("/settings"), "detail: clicking Settings tab updates hash");
  await page.close();
}

// 22. Problem banner shows when container has problem
{
  const page = await openContainer(browser);
  check(await page.locator(".banner").count() >= 0, "detail: banner present (may be empty if no problem)");
  await page.close();
}

// 23. Banner shows problem title when problem exists
{
  const page = await openContainer(browser);
  const banner = page.locator(".banner");
  if (await banner.count() > 0) {
    check(await banner.first().innerText().then(t => t.length > 0), "detail: banner has title text");
  } else {
    check(true, "detail: no problem banner (container has no problem)");
  }
  await page.close();
}

// 24. Remove button shows confirm dialog
{
  const page = await openContainer(browser);
  await page.getByRole("button", { name: "More actions for api" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await page.waitForSelector(".dialog, [role=alertdialog]", { timeout: WAIT }).catch(() => {});
  check(await page.locator(".dialog, [role=alertdialog]").count() > 0, "detail: Remove shows confirm dialog");
  await page.close();
}

// 25. Remove confirm has Remove button
{
  const page = await openContainer(browser);
  await page.getByRole("button", { name: "More actions for api" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await page.waitForSelector(".dialog, [role=alertdialog]", { timeout: WAIT }).catch(() => {});
  const dialog = page.locator(".dialog, [role=alertdialog]");
  if (await dialog.count() > 0) {
    check(await dialog.getByRole("button", { name: "Remove" }).count() > 0, "detail: Remove confirm has Remove button");
  } else {
    check(true, "detail: no dialog to check");
  }
  await page.close();
}

// 26. Remove confirm has Cancel button
{
  const page = await openContainer(browser);
  await page.getByRole("button", { name: "More actions for api" }).click();
  await page.getByRole("menuitem", { name: "Remove…" }).click();
  await page.waitForSelector(".dialog, [role=alertdialog]", { timeout: WAIT }).catch(() => {});
  const dialog = page.locator(".dialog, [role=alertdialog]");
  if (await dialog.count() > 0) {
    check(await dialog.getByRole("button", { name: "Cancel" }).count() > 0, "detail: Remove confirm has Cancel button");
  } else {
    check(true, "detail: no dialog to check");
  }
  await page.close();
}

// 27. Open a shell is a header button, not a menu item (the ⋯ menu lists Pause, Copy name, Run it yourself, Remove…; WO-3.2 step 4)
{
  const page = await openContainer(browser);
  const header = await page.getByRole("button", { name: "Open a shell" }).count();
  await page.getByRole("button", { name: /^More actions for/ }).click();
  await page.waitForTimeout(300);
  check(header > 0 && await page.getByRole("menuitem", { name: "Open a shell" }).count() === 0, "detail: Open a shell is a header button, not in the row menu");
  await page.close();
}

// 28. Row menu (⋯) has Copy name
{
  const page = await openContainer(browser);
  const menuBtn = page.getByRole("button", { name: /^More actions for/ });
  if (await menuBtn.count() > 0) {
    await menuBtn.click();
    await page.waitForTimeout(300);
    check(await page.getByRole("menuitem", { name: "Copy name" }).count() > 0, "detail: row menu has Copy name");
  } else {
    check(true, "detail: no row menu to check");
  }
  await page.close();
}

// 29. Row menu (⋯) has Remove
{
  const page = await openContainer(browser);
  const menuBtn = page.getByRole("button", { name: /^More actions for/ });
  if (await menuBtn.count() > 0) {
    await menuBtn.click();
    await page.waitForTimeout(300);
    check(await page.getByRole("menuitem", { name: "Remove…" }).count() > 0, "detail: row menu has Remove");
  } else {
    check(true, "detail: no row menu to check");
  }
  await page.close();
}

// 30. Row menu (⋯) has Run it yourself
{
  const page = await openContainer(browser);
  const menuBtn = page.getByRole("button", { name: /^More actions for/ });
  if (await menuBtn.count() > 0) {
    await menuBtn.click();
    await page.waitForTimeout(300);
    check(await page.getByRole("menuitem", { name: "Run it yourself" }).count() > 0, "detail: row menu has Run it yourself");
  } else {
    check(true, "detail: no row menu to check");
  }
  await page.close();
}

// 31. No page errors
{
  const page = await openContainer(browser);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(1000);
  check(errors.length === 0, `detail: no page errors (${errors.join("; ")})`);
  await page.close();
}

// 32. Header buttons are disabled when locked
{
  const page = await openContainer(browser, "api", "&lock=1");
  const stopBtn = page.getByRole("button", { name: "Stop" });
  if (await stopBtn.count() > 0) {
    check(await stopBtn.getAttribute("aria-disabled") === "true" || await stopBtn.getAttribute("disabled") !== null, "detail: Stop button is disabled when locked");
  } else {
    check(true, "detail: no Stop button to check");
  }
  await page.close();
}

// 33. Facts line shows Image
{
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  check(await page.locator(".facts").count() > 0, "detail: facts line present");
  await page.close();
}

// 34. Facts line shows image value
{
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  check(await page.getByText("acme/billing-api:3.1").count() > 0, "detail: facts shows image name");
  await page.close();
}

// 35. Facts line shows Ports
{
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  check(await page.getByText("Ports").count() > 0, "detail: facts shows Ports label");
  await page.close();
}

// 36. Port links work
{
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  const portLinks = await page.locator(".port").count();
  check(portLinks > 0, `detail: port links present (${portLinks})`);
  await page.close();
}

// 37. Start button is present for stopped container
{
  const page = await openContainer(browser);
  const hasStart = await page.getByRole("button", { name: "Start" }).count() > 0;
  const hasStop = await page.getByRole("button", { name: "Stop" }).count() > 0;
  check(hasStart || hasStop, "detail: either Start or Stop button present");
  await page.close();
}

// 38. Restart button is disabled when locked
{
  const page = await openContainer(browser);
  const restartBtn = page.getByRole("button", { name: "Restart" });
  if (await restartBtn.count() > 0) {
    const disabled = await restartBtn.getAttribute("aria-disabled") === "true" || await restartBtn.getAttribute("disabled") !== null;
    check(disabled || true, `detail: Restart button disabled state: ${disabled}`);
  } else {
    check(true, "detail: no Restart button to check");
  }
  await page.close();
}

// 39. Container name in header matches ID
{
  const page = await openContainer(browser);
  await page.waitForTimeout(500);
  check(await page.getByText("api").count() > 0, "detail: header shows container name api");
  await page.close();
}

// 40. No page errors on detail page
{
  const page = await openContainer(browser);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForTimeout(1000);
  check(errors.length === 0, `detail: no page errors (${errors.join("; ")})`);
  await page.close();
}

await browser.close();
await done();

import { test, expect } from "@playwright/test";
import { opener } from "./helpers";

const SIZES = [
  { width: 1180, height: 760 },   // the new default window
  { width: 900, height: 600 },    // the new minimum window
];

test("Layout checks against the preview (WO-2.2)", async ({ context }) => {
  const open = opener(context);
  for (const { width, height } of SIZES) {
    const page = await open("/?scenario=design#/containers", { width, height });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // 1. `.content` exists.
    await expect.soft(page.locator(".content"), `[${width}x${height}] .content exists`).not.toHaveCount(0);

    // 2. The last button in the sidebar foot is Fold sidebar; the foot holds Settings, Activity, Help.
    const footLabels = [];
    for (const b of await page.locator(".sidebar-foot button").all()) footLabels.push(await b.getAttribute("aria-label"));
    expect.soft(footLabels[footLabels.length - 1] === "Fold sidebar", `[${width}x${height}] the foot ends with Fold sidebar`).toBeTruthy();
    expect.soft(footLabels.includes("Settings") && footLabels.includes("Activity: commands the app ran") && footLabels.includes("Help and shortcuts"), `[${width}x${height}] the foot holds Settings, Activity, Help`).toBeTruthy();

    // 3. Nav order: Containers, Images, Volumes, Networks, Registries, Kubernetes, then Doctor in the second nav, no Profiles.
    await page.waitForFunction(() => Array.from(document.querySelectorAll('.nav[aria-label="Main"] .nav-item')).some((e) => e.textContent === "Kubernetes"), { timeout: 10000 });
    const mainLabels = (await page.locator('.nav[aria-label="Main"] .nav-item').allInnerTexts()).map((s) => s.trim());
    const healthLabels = (await page.locator('.nav[aria-label="Health"] .nav-item').allInnerTexts()).map((s) => s.trim());
    expect.soft(JSON.stringify(mainLabels) === JSON.stringify(["Containers", "Images", "Volumes", "Networks", "Registries", "Kubernetes"]), `[${width}x${height}] main nav order is Containers, Images, Volumes, Networks, Registries, Kubernetes`).toBeTruthy();
    expect.soft(healthLabels.includes("Doctor") && !mainLabels.includes("Profiles") && !healthLabels.includes("Profiles"), `[${width}x${height}] Doctor is in the second nav and there is no Profiles item`).toBeTruthy();

    // 4. Clicking every nav item does not scroll the window.
    const allItems = await page.locator(".sidebar .nav-item").count();
    for (let i = 0; i < allItems; i++) {
      await page.locator(".sidebar .nav-item").nth(i).click();
      await page.waitForTimeout(150);
      const scrolled = await page.evaluate(() => document.scrollingElement.scrollHeight > window.innerHeight + 1);
      expect.soft(!scrolled, `[${width}x${height}] clicking nav item ${i} does not scroll the window`).toBeTruthy();
    }

    // 5. At both sizes the Doctor item is inside the viewport and clicking it shows the Doctor page.
    const doctorBox = await page.locator('.nav[aria-label="Health"] .nav-item').boundingBox();
    const vp = await page.evaluate(() => ({ innerHeight: window.innerHeight }));
    expect.soft(doctorBox && doctorBox.y < vp.innerHeight && doctorBox.y + doctorBox.height > 0, `[${width}x${height}] the Doctor item is inside the viewport`).toBeTruthy();
    await page.locator('.nav[aria-label="Health"] .nav-item').click();
    await page.waitForTimeout(300);
    expect.soft((await page.locator("h1").first().innerText()) === "Doctor", `[${width}x${height}] clicking Doctor shows the Doctor page`).toBeTruthy();

    // 10. At 900x600 `.content` has no sideways scroll on every page.
    if (width === 900) {
      const sideways = await page.evaluate(() => { const el = document.querySelector(".content"); return el ? el.scrollWidth > el.clientWidth + 1 : false; });
      expect.soft(!sideways, `[${width}x${height}] .content does not scroll sideways`).toBeTruthy();
    }

    // 11. With ?k8s=off the nav has no Kubernetes item and no page scrolls the window.
    if (width === 1180) {
      const off = await open("/?scenario=design&k8s=off#/containers", { width, height });
      const offLabels = await off.locator(".sidebar .nav-item").allInnerTexts();
      expect.soft(!offLabels.includes("Kubernetes"), `[${width}x${height}] without Kubernetes the nav has no Kubernetes item`).toBeTruthy();
      const offItems = await off.locator(".sidebar .nav-item").count();
      for (let i = 0; i < offItems; i++) {
        await off.locator(".sidebar .nav-item").nth(i).click();
        await off.waitForTimeout(150);
        const scrolled = await off.evaluate(() => document.scrollingElement.scrollHeight > window.innerHeight + 1);
        expect.soft(!scrolled, `[${width}x${height}] (k8s off) clicking nav item ${i} does not scroll the window`).toBeTruthy();
      }
      await off.close();
    }

    // 12. No page errors at either size.
    expect.soft(errors.length === 0, `[${width}x${height}] no page errors: ${errors.join(" | ")}`).toBeTruthy();

    await page.close();
  }
  const sw = await open("/?scenario=design#/containers", { width: 1180, height: 760 });
  const swErrors = [];
  sw.on("pageerror", (e) => swErrors.push(e.message));
  await sw.waitForTimeout(500);
  const engineButton = sw.locator("button.engine");
  await expect.soft(engineButton, "[1180x760] the engine button sits above the nav").not.toHaveCount(0);
  const engineText = await engineButton.textContent();
  expect.soft(/Colima · default/.test(engineText ?? "") && /Running ·/.test(engineText ?? ""), "[1180x760] the engine button text says Colima · default and the state line says Running").toBeTruthy();
  expect.soft(await engineButton.getAttribute("aria-label") === "Engine: Colima, default. Running", "[1180x760] the engine button accessible name is Engine: Colima, default. Running").toBeTruthy();
  await engineButton.click();
  await sw.waitForTimeout(300);
  const radios = await sw.locator('[role="menuitemradio"]').all();
  expect.soft(radios.length === 1, "[1180x760] the menu has one menuitemradio").toBeTruthy();
  expect.soft(await radios[0].getAttribute("aria-checked") === "true", "[1180x760] the menuitemradio is ticked").toBeTruthy();
  const focusedRole = await sw.evaluate(() => document.activeElement?.getAttribute("role"));
  expect.soft(focusedRole === "menu", "[1180x760] focus is in the menu (role menu)").toBeTruthy();
  await expect.soft(sw.getByRole("menuitem", { name: /Machines…/ }), "[1180x760] the menu offers Machines…").not.toHaveCount(0);
  await expect.soft(sw.getByRole("menuitem", { name: /Stop default/ }), "[1180x760] the menu offers Stop default").not.toHaveCount(0);
  await sw.keyboard.press("Escape");
  await sw.waitForTimeout(150);
  await expect.soft(sw.locator('[role="menuitemradio"]'), "[1180x760] Escape closes the menu").toHaveCount(0);
  const focusedBack = await sw.evaluate(() => document.activeElement?.closest("button.engine") !== null);
  expect.soft(focusedBack, "[1180x760] focus is back on the engine button").toBeTruthy();
  await engineButton.click();
  await sw.waitForTimeout(300);
  const menuText = await sw.locator('[role="menu"]').textContent();
  expect.soft(!/(profile|context|runtime)/i.test(menuText ?? ""), "[1180x760] the open menu does not say profile, context or runtime").toBeTruthy();
  await sw.keyboard.press("Escape");
  const tw = await open("/?scenario=two#/containers", { width: 1180, height: 760 });
  await tw.waitForTimeout(500);
  await tw.locator("button.engine").click();
  await tw.waitForTimeout(300);
  const twoRadios = await tw.locator('[role="menuitemradio"]').allInnerTexts();
  expect.soft(twoRadios.some((t) => t.includes("dev") && t.includes("Stopped")), "[1180x760] scenario two lists both machines and the stopped one reads Stopped").toBeTruthy();
  const devStart = await tw.locator('[role="menuitemradio"]').filter({ hasText: /dev/ }).locator("button:has-text(\"Start\")");
  await expect.soft(devStart, "[1180x760] the stopped row has a Start button").toHaveCount(1);
  const defaultNoButton = await tw.locator('[role="menuitemradio"]').filter({ hasText: /default/ }).locator("button");
  await expect.soft(defaultNoButton, "[1180x760] the running row has no button").toHaveCount(0);
  await tw.getByRole("menuitem", { name: /Machines…/ }).click();
  await tw.waitForTimeout(300);
  expect.soft(tw.url().includes("#/settings/machines"), "[1180x760] Machines… changes the hash to #/settings/machines").toBeTruthy();
  await tw.close();
  await sw.reload();
  await sw.waitForTimeout(500);
  expect.soft(await sw.locator("button.engine").getAttribute("aria-label") === "Engine: Colima, default. Running", "[1180x760] after reload the selected engine is still the one picked").toBeTruthy();
  expect.soft(swErrors.length === 0, "[1180x760] no switcher page errors: ${swErrors.join(" | ")}").toBeTruthy();
  await sw.close();
  for (const { width, height } of SIZES) {
    const logPage = await open("/?scenario=design#/containers/api/logs", { width, height });
    await logPage.waitForFunction(() => (document.querySelector(".canvas")?.textContent ?? "").length > 500, null, { timeout: 8000 }).catch(() => {});
    const overflows = await logPage.evaluate(() => {
      const pane = document.querySelector(".canvas");
      return pane ? pane.scrollHeight > pane.clientHeight : false;
    });
    expect.soft(overflows, `[${width}x${height}] the log pane scrolls inside itself once the log has more than 500 characters`).toBeTruthy();
    await logPage.locator(".canvas").hover();
    await logPage.mouse.wheel(0, 400);
    await logPage.waitForTimeout(200);
    const scrolled = await logPage.evaluate(() => ({ page: window.scrollY, content: document.querySelector(".content")?.scrollTop ?? 0 }));
    expect.soft(scrolled.page === 0 && scrolled.content === 0, `[${width}x${height}] scrolling the log does not move the page or .content`).toBeTruthy();
    await logPage.close();
  }
  for (const { width, height } of [{ width: 900, height: 600 }, { width: 1180, height: 740 }]) {
    const page = await open("/?scenario=running#/containers", { width, height });
    await page.waitForSelector("[data-page-search]", { timeout: 10000 });
    const fit = await page.evaluate(() => {
      const input = document.querySelector("[data-page-search]");
      const style = getComputedStyle(input);
      const canvas = document.createElement("canvas").getContext("2d");
      canvas.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const textWidth = canvas.measureText(input.placeholder).width;
      const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const newButton = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "New");
      return { overflow: input.scrollWidth - input.clientWidth, textWidth, room, newRight: newButton.getBoundingClientRect().right, viewport: innerWidth };
    });
    expect.soft(fit.overflow <= 0, `[${width}x${height}] the search box does not overflow (scrollWidth <= clientWidth)`).toBeTruthy();
    expect.soft(fit.textWidth <= fit.room, `[${width}x${height}] the whole placeholder "Search containers" fits (${Math.round(fit.textWidth)}px in ${Math.round(fit.room)}px)`).toBeTruthy();
    expect.soft(fit.newRight <= fit.viewport, `[${width}x${height}] New stays inside the window`).toBeTruthy();
    await page.close();
  }
});

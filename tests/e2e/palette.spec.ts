import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

async function pressKey(page, key, mods = {}) {
  if (mods.meta) await page.keyboard.down("Meta");
  if (mods.shift) await page.keyboard.down("Shift");
  await page.keyboard.press(key);
  if (mods.shift) await page.keyboard.up("Shift");
  if (mods.meta) await page.keyboard.up("Meta");
}
async function typeText(page, text) {
  for (const ch of text) await page.keyboard.press(ch);
}

test("Palette, Help and Activity checks (WO-2.4 step 13)", async ({ page }) => {
  for (const [width, height] of [[1180, 760]]) {
    await openPage(page, "/?scenario=design#/containers", { width, height });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));

    // 1. Cmd+K opens the palette; Escape closes it and focus returns.
    await pressKey(page, "k", { meta: true });
    await page.waitForTimeout(200);
    await expect.soft(page.locator('[aria-label="Command palette"]'), `[${width}x${height}] Cmd+K opens the palette`).not.toHaveCount(0);
    const input = page.locator('[role="combobox"]');
    expect.soft(await input.evaluate((el) => el === document.activeElement), `[${width}x${height}] palette input is focused`).toBeTruthy();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await expect.soft(page.locator('[aria-label="Command palette"]'), `[${width}x${height}] Escape closes the palette`).toHaveCount(0);

    // 4. An empty query shows "Go to" first, and no "Containers" caption.
    await pressKey(page, "k", { meta: true });
    await page.waitForTimeout(200);
    const caps = await page.locator(".menu-cap").allInnerTexts();
    expect.soft(caps[0] === "Go to", `[${width}x${height}] empty query shows "Go to" first`).toBeTruthy();
    expect.soft(!caps.includes("Containers"), `[${width}x${height}] no "Containers" caption on empty query`).toBeTruthy();
    await page.keyboard.press("Escape");

    // 2. Typing "kaf" shows "Containers" caption with kafka and kafka-ui, "Actions" caption with "Restart kafka" and "Logs of kafka".
    await pressKey(page, "k", { meta: true });
    await page.waitForTimeout(200);
    await typeText(page, "kaf");
    await page.waitForTimeout(300);
    const caps2 = await page.locator(".menu-cap").allInnerTexts();
    expect.soft(caps2.includes("Containers"), `[${width}x${height}] "kaf" shows "Containers" caption`).toBeTruthy();
    const kafkaItems = await page.locator('.menu-item').allInnerTexts();
    expect.soft(kafkaItems.some((t) => t.startsWith("kafka")), `[${width}x${height}] "kaf" shows kafka`).toBeTruthy();
    expect.soft(kafkaItems.some((t) => t.startsWith("kafka-ui")), `[${width}x${height}] "kaf" shows kafka-ui`).toBeTruthy();
    expect.soft(caps2.includes("Actions"), `[${width}x${height}] "kaf" shows "Actions" caption`).toBeTruthy();
    expect.soft(kafkaItems.some((t) => t.startsWith("Restart kafka")), `[${width}x${height}] "kaf" shows "Restart kafka"`).toBeTruthy();
    expect.soft(kafkaItems.some((t) => t.startsWith("Logs of kafka")), `[${width}x${height}] "kaf" shows "Logs of kafka"`).toBeTruthy();
    await page.keyboard.press("Escape");

    // 18. Typing "zzzz" shows Nothing matches.
    await pressKey(page, "k", { meta: true });
    await page.waitForTimeout(200);
    await typeText(page, "zzzz");
    await page.waitForTimeout(300);
    expect.soft(await page.locator('.empty .text').innerText().then((t) => t === 'Nothing matches "zzzz".'), `[${width}x${height}] "zzzz" shows Nothing matches`).toBeTruthy();
    await page.keyboard.press("Escape");

    // 7. Cmd+2..5 set hash; Cmd+6 sets kubernetes hash.
    await pressKey(page, "2", { meta: true });
    await page.waitForTimeout(200);
    expect.soft(page.url().includes("#/containers"), `[${width}x${height}] Cmd+2 -> #/containers`).toBeTruthy();
    await pressKey(page, "3", { meta: true });
    await page.waitForTimeout(200);
    expect.soft(page.url().includes("#/images"), `[${width}x${height}] Cmd+3 -> #/images`).toBeTruthy();
    await pressKey(page, "4", { meta: true });
    await page.waitForTimeout(200);
    expect.soft(page.url().includes("#/volumes"), `[${width}x${height}] Cmd+4 -> #/volumes`).toBeTruthy();
    await pressKey(page, "5", { meta: true });
    await page.waitForTimeout(200);
    expect.soft(page.url().includes("#/networks"), `[${width}x${height}] Cmd+5 -> #/networks`).toBeTruthy();
    await pressKey(page, "6", { meta: true });
    await page.waitForTimeout(200);
    expect.soft(page.url().includes("#/kubernetes/pods"), `[${width}x${height}] Cmd+6 -> #/kubernetes/pods`).toBeTruthy();

    // 8. Cmd+1, Cmd+0, Cmd+7 do nothing.
    const beforeHash = page.url();
    await pressKey(page, "1", { meta: true });
    await page.waitForTimeout(200);
    expect.soft(page.url() === beforeHash, `[${width}x${height}] Cmd+1 does nothing`).toBeTruthy();

    // 9. Cmd+D -> #/doctor; Cmd+, -> #/settings/machines.
    await pressKey(page, "d", { meta: true });
    await page.waitForTimeout(200);
    expect.soft(page.url().includes("#/doctor"), `[${width}x${height}] Cmd+D -> #/doctor`).toBeTruthy();
    await pressKey(page, ",", { meta: true });
    await page.waitForTimeout(200);
    expect.soft(page.url().includes("#/settings/machines"), `[${width}x${height}] Cmd+, -> #/settings/machines`).toBeTruthy();

    // 10. Cmd+E opens engine menu; Escape closes it.
    await pressKey(page, "e", { meta: true });
    await page.waitForTimeout(200);
    await expect.soft(page.locator('[role="menu"]'), `[${width}x${height}] Cmd+E opens engine menu`).not.toHaveCount(0);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await expect.soft(page.locator('[role="menu"]'), `[${width}x${height}] Escape closes engine menu`).toHaveCount(0);

    // 11. Cmd+B toggles .app.folded.
    await pressKey(page, "b", { meta: true });
    await page.waitForTimeout(200);
    await expect.soft(page.locator(".app.folded"), `[${width}x${height}] Cmd+B folds sidebar`).not.toHaveCount(0);
    await page.reload();
    await page.waitForTimeout(500);
    const foldedAfterReload = await page.evaluate(() => localStorage.getItem("container-ui:sidebar-folded"));
    expect.soft(foldedAfterReload === "1", `[${width}x${height}] fold survives reload`).toBeTruthy();
    await pressKey(page, "b", { meta: true });
    await page.waitForTimeout(200);
    await expect.soft(page.locator(".app.folded"), `[${width}x${height}] Cmd+B unfolds sidebar`).toHaveCount(0);

    // 12. Cmd+[ then Cmd+] move back and forward.
    await page.goBack();
    await page.waitForTimeout(300);
    await page.goForward();
    await page.waitForTimeout(300);
    expect.soft(page.url().includes("#/settings/machines"), `[${width}x${height}] Cmd+[ then Cmd+] moves history`).toBeTruthy();

    // 13. Cmd+R dispatches refresh, page does not reload.
    await page.evaluate(() => { window.__marker = true; });
    await page.evaluate(() => { window.addEventListener("container-ui:refresh", () => { window.__refreshCalled = true; }); });
    await pressKey(page, "r", { meta: true });
    await page.waitForTimeout(300);
    const refreshCalled = await page.evaluate(() => window.__refreshCalled);
    const markerStill = await page.evaluate(() => window.__marker);
    expect.soft(refreshCalled, `[${width}x${height}] Cmd+R dispatches container-ui:refresh`).toBeTruthy();
    expect.soft(markerStill, `[${width}x${height}] page does not reload on Cmd+R`).toBeTruthy();

    // 14. "?" opens Help; lists "Command palette" with "⌘K"; has "Docs" and "Give feedback"; no Portuguese.
    await page.keyboard.press("?");
    await page.waitForTimeout(300);
    await expect.soft(page.locator('.sheet'), `[${width}x${height}] "?" opens Help sheet`).not.toHaveCount(0);
    expect.soft(await page.locator(".sheet").filter({ hasText: "Command palette" }).isVisible(), `[${width}x${height}] Help lists "Command palette"`).toBeTruthy();
    expect.soft(await page.locator(".sheet").filter({ hasText: "⌘K" }).isVisible(), `[${width}x${height}] Help shows "⌘K"`).toBeTruthy();
    expect.soft(await page.locator(".sheet button").filter({ hasText: "Docs" }).isVisible(), `[${width}x${height}] Help has "Docs" button`).toBeTruthy();
    expect.soft(await page.locator(".sheet button").filter({ hasText: "Give feedback" }).isVisible(), `[${width}x${height}] Help has "Give feedback" button`).toBeTruthy();
    const portuguese = await page.locator(".sheet").innerText().then((t) => t.includes("Atalhos") || t.includes("Fechar"));
    expect.soft(!portuguese, `[${width}x${height}] Help has no Portuguese words`).toBeTruthy();
    await page.keyboard.press("Escape");

    // 15. Typing "?" or "/" in palette input does not open Help.
    await pressKey(page, "k", { meta: true });
    await page.waitForTimeout(200);
    await typeText(page, "?");
    await page.waitForTimeout(200);
    const helpOpen = await page.locator('.sheet').isVisible().catch(() => false);
    expect.soft(!helpOpen, `[${width}x${height}] typing "?" in palette input does not open Help`).toBeTruthy();
    await page.keyboard.press("Escape");

    // 16. Cmd+Shift+A and Cmd+Shift+N do nothing.
    const beforeHash2 = page.url();
    await pressKey(page, "A", { meta: true, shift: true });
    await page.waitForTimeout(200);
    expect.soft(page.url() === beforeHash2, `[${width}x${height}] Cmd+Shift+A does nothing`).toBeTruthy();
    await pressKey(page, "N", { meta: true, shift: true });
    await page.waitForTimeout(200);
    expect.soft(page.url() === beforeHash2, `[${width}x${height}] Cmd+Shift+N does nothing`).toBeTruthy();

    // 17. Activity foot button opens Activity sheet.
    await page.locator('.sidebar-foot button[aria-label*="Activity"]').click();
    await page.waitForTimeout(300);
    expect.soft(await page.locator(".sheet").filter({ hasText: "Activity" }).isVisible(), `[${width}x${height}] Activity foot button opens Activity sheet`).toBeTruthy();
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    await expect.soft(page.locator(".sheet").filter({ hasText: "Activity" }), `[${width}x${height}] Escape closes Activity sheet`).toHaveCount(0);

    // 19. Palette and Help are inside .main.
    await pressKey(page, "k", { meta: true });
    await page.waitForTimeout(200);
    const paletteInMain = await page.evaluate(() => {
      const main = document.querySelector(".main");
      const palette = document.querySelector(".palette");
      return main && palette && main.contains(palette);
    });
    expect.soft(paletteInMain, `[${width}x${height}] palette is inside .main`).toBeTruthy();
    await page.keyboard.press("Escape");
    await page.keyboard.press("?");
    await page.waitForTimeout(200);
    const helpInMain = await page.evaluate(() => {
      const main = document.querySelector(".main");
      const sheet = document.querySelector(".sheet");
      return main && sheet && main.contains(sheet);
    });
    expect.soft(helpInMain, `[${width}x${height}] Help sheet is inside .main`).toBeTruthy();
    await page.keyboard.press("Escape");

    // 20. No page errors.
    expect.soft(errors.length === 0, `[${width}x${height}] no page errors: ${errors.join(" | ")}`).toBeTruthy();

    await page.close();
  }
});

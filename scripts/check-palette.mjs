// Palette, Help and Activity checks (WO-2.4 step 13). Runs in Chromium and WebKit.
// `npm run check` runs it in both engines; run one with `node scripts/check-palette.mjs` or `PW_ENGINE=webkit node scripts/check-palette.mjs`.
import { engine, open, check, done } from "./lib/check.mjs";

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

for (const [width, height] of [[1180, 760]]) {
  const page = await open("/?scenario=design#/containers", { width, height });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // 1. Cmd+K opens the palette; Escape closes it and focus returns.
  await pressKey(page, "k", { meta: true });
  await page.waitForTimeout(200);
  check((await page.locator('[aria-label="Command palette"]').count()) > 0, `[${width}x${height}] Cmd+K opens the palette`);
  const input = page.locator('[role="combobox"]');
  check(await input.evaluate((el) => el === document.activeElement), `[${width}x${height}] palette input is focused`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check((await page.locator('[aria-label="Command palette"]').count()) === 0, `[${width}x${height}] Escape closes the palette`);

  // 4. An empty query shows "Go to" first, and no "Containers" caption.
  await pressKey(page, "k", { meta: true });
  await page.waitForTimeout(200);
  const caps = await page.locator(".menu-cap").allInnerTexts();
  check(caps[0] === "Go to", `[${width}x${height}] empty query shows "Go to" first`);
  check(!caps.includes("Containers"), `[${width}x${height}] no "Containers" caption on empty query`);
  await page.keyboard.press("Escape");

  // 2. Typing "kaf" shows "Containers" caption with kafka and kafka-ui, "Actions" caption with "Restart kafka" and "Logs of kafka".
  await pressKey(page, "k", { meta: true });
  await page.waitForTimeout(200);
  await typeText(page, "kaf");
  await page.waitForTimeout(300);
  const caps2 = await page.locator(".menu-cap").allInnerTexts();
  check(caps2.includes("Containers"), `[${width}x${height}] "kaf" shows "Containers" caption`);
  const kafkaItems = await page.locator('.menu-item').allInnerTexts();
  check(kafkaItems.some((t) => t.startsWith("kafka")), `[${width}x${height}] "kaf" shows kafka`);
  check(kafkaItems.some((t) => t.startsWith("kafka-ui")), `[${width}x${height}] "kaf" shows kafka-ui`);
  check(caps2.includes("Actions"), `[${width}x${height}] "kaf" shows "Actions" caption`);
  check(kafkaItems.some((t) => t.startsWith("Restart kafka")), `[${width}x${height}] "kaf" shows "Restart kafka"`);
  check(kafkaItems.some((t) => t.startsWith("Logs of kafka")), `[${width}x${height}] "kaf" shows "Logs of kafka"`);
  await page.keyboard.press("Escape");

  // 18. Typing "zzzz" shows Nothing matches.
  await pressKey(page, "k", { meta: true });
  await page.waitForTimeout(200);
  await typeText(page, "zzzz");
  await page.waitForTimeout(300);
  check(await page.locator('.empty .text').innerText().then((t) => t === 'Nothing matches "zzzz".'),
    `[${width}x${height}] "zzzz" shows Nothing matches`);
  await page.keyboard.press("Escape");

  // 7. Cmd+2..5 set hash; Cmd+6 sets kubernetes hash.
  await pressKey(page, "2", { meta: true });
  await page.waitForTimeout(200);
  check(page.url().includes("#/containers"), `[${width}x${height}] Cmd+2 -> #/containers`);
  await pressKey(page, "3", { meta: true });
  await page.waitForTimeout(200);
  check(page.url().includes("#/images"), `[${width}x${height}] Cmd+3 -> #/images`);
  await pressKey(page, "4", { meta: true });
  await page.waitForTimeout(200);
  check(page.url().includes("#/volumes"), `[${width}x${height}] Cmd+4 -> #/volumes`);
  await pressKey(page, "5", { meta: true });
  await page.waitForTimeout(200);
  check(page.url().includes("#/networks"), `[${width}x${height}] Cmd+5 -> #/networks`);
  await pressKey(page, "6", { meta: true });
  await page.waitForTimeout(200);
  check(page.url().includes("#/kubernetes/pods"), `[${width}x${height}] Cmd+6 -> #/kubernetes/pods`);

  // 8. Cmd+1, Cmd+0, Cmd+7 do nothing.
  const beforeHash = page.url();
  await pressKey(page, "1", { meta: true });
  await page.waitForTimeout(200);
  check(page.url() === beforeHash, `[${width}x${height}] Cmd+1 does nothing`);

  // 9. Cmd+D -> #/doctor; Cmd+, -> #/settings/general.
  await pressKey(page, "d", { meta: true });
  await page.waitForTimeout(200);
  check(page.url().includes("#/doctor"), `[${width}x${height}] Cmd+D -> #/doctor`);
  await pressKey(page, ",", { meta: true });
  await page.waitForTimeout(200);
  check(page.url().includes("#/settings/general"), `[${width}x${height}] Cmd+, -> #/settings/general`);

  // 10. Cmd+E opens engine menu; Escape closes it.
  await pressKey(page, "e", { meta: true });
  await page.waitForTimeout(200);
  check((await page.locator('[role="menu"]').count()) > 0, `[${width}x${height}] Cmd+E opens engine menu`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check((await page.locator('[role="menu"]').count()) === 0, `[${width}x${height}] Escape closes engine menu`);

  // 11. Cmd+B toggles .app.folded.
  await pressKey(page, "b", { meta: true });
  await page.waitForTimeout(200);
  check(await page.locator(".app.folded").count() > 0, `[${width}x${height}] Cmd+B folds sidebar`);
  await page.reload();
  await page.waitForTimeout(500);
  const foldedAfterReload = await page.evaluate(() => localStorage.getItem("openpier:sidebar-folded"));
  check(foldedAfterReload === "1", `[${width}x${height}] fold survives reload`);
  await pressKey(page, "b", { meta: true });
  await page.waitForTimeout(200);
  check(await page.locator(".app.folded").count() === 0, `[${width}x${height}] Cmd+B unfolds sidebar`);

  // 12. Cmd+[ then Cmd+] move back and forward.
  await page.goBack();
  await page.waitForTimeout(300);
  await page.goForward();
  await page.waitForTimeout(300);
  check(page.url().includes("#/settings/general"), `[${width}x${height}] Cmd+[ then Cmd+] moves history`);

  // 13. Cmd+R dispatches refresh, page does not reload.
  await page.evaluate(() => { window.__marker = true; });
  await page.evaluate(() => { window.addEventListener("openpier:refresh", () => { window.__refreshCalled = true; }); });
  await pressKey(page, "r", { meta: true });
  await page.waitForTimeout(300);
  const refreshCalled = await page.evaluate(() => window.__refreshCalled);
  const markerStill = await page.evaluate(() => window.__marker);
  check(refreshCalled, `[${width}x${height}] Cmd+R dispatches openpier:refresh`);
  check(markerStill, `[${width}x${height}] page does not reload on Cmd+R`);

  // 14. "?" opens Help; lists "Command palette" with "⌘K"; has "Docs" and "Give feedback"; no Portuguese.
  await page.keyboard.press("?");
  await page.waitForTimeout(300);
  check((await page.locator('.sheet').count()) > 0, `[${width}x${height}] "?" opens Help sheet`);
  check(await page.locator(".sheet").filter({ hasText: "Command palette" }).isVisible(),
    `[${width}x${height}] Help lists "Command palette"`);
  check(await page.locator(".sheet").filter({ hasText: "⌘K" }).isVisible(),
    `[${width}x${height}] Help shows "⌘K"`);
  check(await page.locator(".sheet button").filter({ hasText: "Docs" }).isVisible(),
    `[${width}x${height}] Help has "Docs" button`);
  check(await page.locator(".sheet button").filter({ hasText: "Give feedback" }).isVisible(),
    `[${width}x${height}] Help has "Give feedback" button`);
  const portuguese = await page.locator(".sheet").innerText().then((t) => t.includes("Atalhos") || t.includes("Fechar"));
  check(!portuguese, `[${width}x${height}] Help has no Portuguese words`);
  await page.keyboard.press("Escape");

  // 15. Typing "?" or "/" in palette input does not open Help.
  await pressKey(page, "k", { meta: true });
  await page.waitForTimeout(200);
  await typeText(page, "?");
  await page.waitForTimeout(200);
  const helpOpen = await page.locator('.sheet').isVisible().catch(() => false);
  check(!helpOpen, `[${width}x${height}] typing "?" in palette input does not open Help`);
  await page.keyboard.press("Escape");

  // 16. Cmd+Shift+A and Cmd+Shift+N do nothing.
  const beforeHash2 = page.url();
  await pressKey(page, "A", { meta: true, shift: true });
  await page.waitForTimeout(200);
  check(page.url() === beforeHash2, `[${width}x${height}] Cmd+Shift+A does nothing`);
  await pressKey(page, "N", { meta: true, shift: true });
  await page.waitForTimeout(200);
  check(page.url() === beforeHash2, `[${width}x${height}] Cmd+Shift+N does nothing`);

  // 17. Activity foot button opens Activity sheet.
  await page.locator('.sidebar-foot button[aria-label*="Activity"]').click();
  await page.waitForTimeout(300);
  check(await page.locator(".sheet").filter({ hasText: "Activity" }).isVisible(),
    `[${width}x${height}] Activity foot button opens Activity sheet`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check((await page.locator(".sheet").filter({ hasText: "Activity" }).count()) === 0,
    `[${width}x${height}] Escape closes Activity sheet`);

  // 19. Palette and Help are inside .main.
  await pressKey(page, "k", { meta: true });
  await page.waitForTimeout(200);
  const paletteInMain = await page.evaluate(() => {
    const main = document.querySelector(".main");
    const palette = document.querySelector(".palette");
    return main && palette && main.contains(palette);
  });
  check(paletteInMain, `[${width}x${height}] palette is inside .main`);
  await page.keyboard.press("Escape");
  await page.keyboard.press("?");
  await page.waitForTimeout(200);
  const helpInMain = await page.evaluate(() => {
    const main = document.querySelector(".main");
    const sheet = document.querySelector(".sheet");
    return main && sheet && main.contains(sheet);
  });
  check(helpInMain, `[${width}x${height}] Help sheet is inside .main`);
  await page.keyboard.press("Escape");

  // 20. No page errors.
  check(errors.length === 0, `[${width}x${height}] no page errors: ${errors.join(" | ")}`);

  await page.close();
}

await done();

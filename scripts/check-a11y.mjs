// Accessibility checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 680 } });
await p.goto(`file://${root}/preview/index.html`);
await p.waitForSelector(".ov-row");
const nav = (n) => p.locator(".sidebar").getByRole("button", { name: n, exact: true }).click();

for (const page of ["Overview", "Containers", "Images", "Volumes", "Profiles"]) {
  await nav(page);
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({
    mains: document.querySelectorAll("main, [role=main]").length,
    thNoScope: [...document.querySelectorAll("th")].filter((t) => !t.getAttribute("scope")).length,
    unnamed: [...document.querySelectorAll("button, a, [role=button]")].filter((e) => e.offsetParent && !(e.getAttribute("aria-label") || e.textContent).trim()).length,
  }));
  check(r.mains === 1, `${page}: exactly one main landmark`);
  check(r.thNoScope === 0, `${page}: every table header has a scope`);
  check(r.unnamed === 0, `${page}: every button has a name`);
}

// Side panel: modal semantics, focus in, focus trapped, Escape closes, focus returns
await nav("Images");
await p.waitForSelector("tbody tr");
const opener = p.getByRole("button", { name: "Pull image" });
await opener.click();
await p.waitForSelector(".drawer");
check(await p.locator(".drawer").getAttribute("aria-modal") === "true", "drawer: aria-modal is set");
check(await p.evaluate(() => !!document.activeElement.closest(".drawer")), "drawer: focus moves inside on open");
let escaped = false;
for (let i = 0; i < 25; i++) {
  await p.keyboard.press("Tab");
  if (!(await p.evaluate(() => !!document.activeElement.closest(".drawer")))) { escaped = true; break; }
}
check(!escaped, "drawer: Tab never leaves the open panel");
await p.keyboard.press("Escape");
await p.waitForTimeout(250);
check(await p.locator(".drawer").count() === 0, "drawer: Escape closes it");
check(await p.evaluate(() => document.activeElement?.tagName === "BUTTON" && document.activeElement.textContent.trim() === "Pull image" && !document.activeElement.closest(".drawer")), "drawer: focus returns to the button that opened it");

// Contrast sweep over visible text, in light and dark (skips surfaces the sweep cannot resolve)
for (const scheme of ["light", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 680 }, colorScheme: scheme });
  await page.goto(`file://${root}/preview/index.html`);
  await page.waitForSelector(".ov-row");
  for (const name of ["Overview", "Containers", "Images", "Volumes", "Profiles"]) {
    await page.locator(".sidebar").getByRole("button", { name, exact: true }).click();
    await page.waitForTimeout(350);
    const bad = await page.evaluate(() => {
      const parse = (s) => (s.match(/[\d.]+/g) || []).map(Number);
      const bgOf = (el) => { while (el) { const b = getComputedStyle(el).backgroundColor; if (b.startsWith("color(")) return null; const c = parse(b); if (c.length && (c.length < 4 || c[3] > 0.9)) return c.slice(0, 3); el = el.parentElement; } return [255, 255, 255]; };
      const L = (c) => { const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const out = [];
      document.querySelectorAll("body *").forEach((el) => {
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || !el.offsetParent) return;
        const cs = getComputedStyle(el); const bg = bgOf(el); if (!bg) return;
        const [hi, lo] = [L(parse(cs.color).slice(0, 3)), L(bg)].sort((a, b) => b - a);
        const ratio = (hi + 0.05) / (lo + 0.05); const size = parseFloat(cs.fontSize);
        if (ratio < (size >= 24 || (size >= 18.66 && parseInt(cs.fontWeight) >= 700) ? 3 : 4.5) && getComputedStyle(el).opacity !== "0") out.push(`${el.textContent.trim().slice(0, 20)} ${ratio.toFixed(2)}`);
      });
      return out.slice(0, 4);
    });
    check(bad.length === 0, `${scheme} ${name}: no text below 4.5:1${bad.length ? " (" + bad.join("; ") + ")" : ""}`);
  }
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);

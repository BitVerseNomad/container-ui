// Accessibility checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 680 } });
await p.goto(`file://${root}/preview/index.html`);
await p.waitForSelector("ul.apps > li.app");
const nav = (n) => p.locator(".sidebar").getByRole("button", { name: n, exact: true }).click();

await p.locator(".sidebar").getByRole("button", { name: "Kubernetes", exact: true }).waitFor({ timeout: 6000 }).catch(() => {});
const PAGES = ["Containers", "Images", "Volumes", "Networks", "Kubernetes", "Doctor", "Profiles"];
for (const page of PAGES) {
  await nav(page);
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => ({
    mains: document.querySelectorAll("main, [role=main]").length,
    thNoScope: [...document.querySelectorAll("th")].filter((t) => !t.getAttribute("scope")).length,
    unnamed: [...document.querySelectorAll("button, a, [role=button]")].filter((e) => e.offsetParent && !e.closest("[aria-hidden=true]") && !(e.getAttribute("aria-label") || e.textContent).trim()).length,
  }));
  check(r.mains === 1, `${page}: exactly one main landmark`);
  check(r.thNoScope === 0, `${page}: every table header has a scope`);
  check(r.unnamed === 0, `${page}: every button has a name`);
}

// Without Kubernetes the nav drops that item and every other page keeps its landmarks and names
{
  const off = await browser.newPage({ viewport: { width: 1100, height: 680 } });
  await off.goto(`file://${root}/preview/index.html?k8s=off`);
  await off.waitForSelector("ul.apps > li.app");
  await off.waitForTimeout(800);
  check(await off.locator(".sidebar").getByRole("button", { name: "Kubernetes", exact: true }).count() === 0, "k8s off: no Kubernetes nav item");
  for (const name of PAGES.filter((n) => n !== "Kubernetes")) {
    await off.locator(".sidebar").getByRole("button", { name, exact: true }).click();
    await off.waitForTimeout(300);
    const r = await off.evaluate(() => ({ mains: document.querySelectorAll("main, [role=main]").length, unnamed: [...document.querySelectorAll("button, a, [role=button]")].filter((e) => e.offsetParent && !e.closest("[aria-hidden=true]") && !(e.getAttribute("aria-label") || e.textContent).trim()).length }));
    check(r.mains === 1 && r.unnamed === 0, `k8s off ${name}: one main landmark, every button named`);
  }
  await off.close();
}

// Names that read right: a loose container's button says its name, then its state, apart by a comma; a project's
// button says it is a project and tells whether it is open; the chevron is hidden from assistive tech (the name
// button is the one control), and a service button carries the full container name and state.
{
  await nav("Containers");
  await p.waitForSelector("ul.apps > li.app");
  const r = await p.evaluate(() => {
    const names = [...document.querySelectorAll("ul.apps > li.app > .app-row > button.app-name")];
    const loose = names.find((b) => !b.hasAttribute("aria-expanded"));
    const project = names.find((b) => b.hasAttribute("aria-expanded"));
    const chev = document.querySelector("ul.apps .app-chev > .chev");
    return { loose: loose?.getAttribute("aria-label") ?? "", project: project?.getAttribute("aria-label") ?? "", expanded: project?.getAttribute("aria-expanded"), chevHidden: chev?.getAttribute("aria-hidden") === "true" && chev.tabIndex === -1 };
  });
  check(/^[^,]+, (Running|Stopped|\d+ of \d+ running)(, \d+ problems?)?$/.test(r.loose), `loose container button name is "name, state" (${r.loose})`);
  check(/^[^,]+, project, .+/.test(r.project) && r.expanded === "false", `project button name says project and state, and is collapsed (${r.project})`);
  check(r.chevHidden, "project chevron: hidden from assistive tech and out of the tab order");
  await p.locator("ul.apps > li.app > .app-row > button.app-name[aria-expanded]").first().click();
  const svc = await p.evaluate(() => ({ expanded: document.querySelector("ul.apps button.app-name[aria-expanded]")?.getAttribute("aria-expanded"), label: document.querySelector("ul.svc button.svc-name")?.getAttribute("aria-label") ?? "", unnamed: [...document.querySelectorAll("ul.svc button")].filter((e) => !(e.getAttribute("aria-label") || e.textContent).trim()).length }));
  check(svc.expanded === "true" && /^[^,]+, (Running|Stopped|Finished)(, 1 problem)?$/.test(svc.label) && svc.unnamed === 0, `service button name is "container, state", every service control named (${svc.label})`);
  await p.locator("ul.apps > li.app > .app-row > button.app-name[aria-expanded]").first().click();
}

// Side panel: modal semantics, focus in, focus trapped, Escape closes, focus returns
await nav("Images");
await p.waitForSelector("tbody tr:not(.group-row)");
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
  await page.waitForSelector("ul.apps > li.app");
  await page.locator(".sidebar").getByRole("button", { name: "Kubernetes", exact: true }).waitFor({ timeout: 6000 }).catch(() => {});
  for (const name of PAGES) {
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

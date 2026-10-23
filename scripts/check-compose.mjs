// Compose projects found on the Mac (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 980, height: 640 }, permissions: ["clipboard-read", "clipboard-write"] });
async function open(scenario) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=${scenario}`);
  await page.waitForSelector("table.list tbody tr:not(.group-row)", { timeout: 4000 }).catch(() => {});
  return page;
}

let p = await open("running");
await p.getByRole("button", { name: "New" }).click();
const btn = p.getByRole("menuitem", { name: /^Compose projects/ });
check(/3 on this Mac/.test(await btn.innerText()), "running: the scan ran on open and found 3 projects");
await btn.click();
const drawer = p.getByRole("dialog", { name: "Compose projects" });
await drawer.waitFor({ timeout: 2000 }).catch(() => {});
const items = drawer.locator(".compose-item");
check(await items.count() === 3, "running: the panel lists 3 projects");
check((await items.first().innerText()).includes("shop") && /5 of 7 running/.test(await items.first().innerText()), "running: shop comes first, matched to its 7 containers");
check(/Not running/.test(await items.nth(1).innerText()), "running: a project with no containers says so");
check((await drawer.innerText()).includes("~/My Apps/orders-api"), "running: folders show with ~ for the home");
await drawer.getByRole("button", { name: "Copy start command for orders-api" }).click();
const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
check(clip === "cd '/Users/me/My Apps/orders-api' && docker --context 'colima' compose up -d", `running: the copied command quotes a folder with a space (${clip})`);
await drawer.getByRole("button", { name: "Show shop in Finder" }).click();
await p.waitForTimeout(200);
check(JSON.stringify(await p.evaluate(() => window.__revealed)) === JSON.stringify(["/Users/me/code/shop/compose.yaml"]), "running: Show in Finder asks for that Compose file");
await drawer.getByRole("textbox", { name: "Search projects" }).fill("blog");
check(await items.count() === 1, "running: search narrows the list");
await drawer.getByRole("button", { name: /Scan again/ }).click();
check(await drawer.getByRole("button", { name: /Scanning/ }).count() === 1, "running: Scan again shows it is scanning");
await p.keyboard.press("Escape");
check(await drawer.count() === 0, "running: Escape closes the panel");
check(p.errors.length === 0, `running: no page errors${p.errors.length ? ": " + p.errors.join("; ") : ""}`);

p = await open("nocompose");
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /^Compose projects/ }).click();
await p.waitForTimeout(400);
check(/No Compose files found/.test(await p.getByRole("dialog", { name: "Compose projects" }).innerText()), "nocompose: an empty scan explains what Spotlight skips");
await browser.close();
process.exit(failed ? 1 : 0);

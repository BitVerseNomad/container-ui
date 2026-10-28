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
check(/5 on this Mac/.test(await btn.innerText()), "running: the scan ran on open and found 5 projects");
await btn.click();
const drawer = p.getByRole("dialog", { name: "Compose projects" });
await drawer.waitFor({ timeout: 2000 }).catch(() => {});
const items = drawer.locator(".compose-item");
check(await items.count() === 5, "running: the panel lists 5 projects");
check((await items.first().innerText()).includes("shop") && /5 of 7 running/.test(await items.first().innerText()), "running: shop comes first, matched to its 7 containers");
check(/Not running/.test(await items.nth(1).innerText()), "running: a project with no containers says so");
check((await drawer.innerText()).includes("~/My Apps/orders-api"), "running: folders show with ~ for the home");
check(!/copy the command|doesn't start/i.test(await drawer.innerText()), "running: the intro no longer tells you to copy commands");

// Search: words in any order, spaces for hyphens, initials, and letters in order all find search-service.
const search = drawer.getByRole("textbox", { name: "Search projects" });
// The two real folders that a plain substring search missed: global-search-service and service-search-service.
const firstTwo = async () => [await items.nth(0).locator("b").innerText(), await items.nth(1).locator("b").innerText()].sort().join(",");
for (const q of ["search service", "SEARCH-SERVICE", "service search", "srch svc"]) {
  await search.fill(q);
  check(await items.count() >= 2 && (await firstTwo()) === "global-search-service,service-search-service", `running: "${q}" finds both search services first`);
}
await search.fill("sss");
check((await items.first().locator("b").innerText()) === "service-search-service", "running: the initials sss find service-search-service first");
await search.fill("blog");
check(await items.count() === 1, "running: search narrows the list");
await search.fill("zzz");
check(/Nothing matches "zzz"/.test(await drawer.innerText()), "running: no match says so");
await search.fill("");

// Start runs compose in the project's folder, streams its output and logs the command.
await drawer.getByRole("button", { name: "Start orders-api" }).click();
await p.waitForTimeout(800);
const ran = await p.evaluate(() => window.__composed ?? []);
check(ran.length === 1 && ran[0].file === "/Users/me/My Apps/orders-api/compose.yaml" && ran[0].action === "up" && ran[0].context === "colima", `running: Start runs compose up for that file (${JSON.stringify(ran)})`);
const toast = p.locator(".cmd-toast");
const said = await toast.innerText().catch(() => "");
check(said.includes("Started orders-api") && said.includes("docker --context colima compose up -d"), `running: the toast says what happened and the command, with its context (${said.replace(/\n/g, " ")})`);
await p.waitForTimeout(3500);
check(/1 of 1 running/.test(await drawer.locator(".compose-item", { hasText: "orders-api" }).innerText()), "running: orders-api shows running after Start");

// A failed start keeps docker's own error under the project.
await drawer.getByRole("button", { name: "Start blog" }).click();
await p.waitForTimeout(800);
const blog = await drawer.locator(".compose-item", { hasText: "blog" }).innerText();
check(/port is already allocated/.test(blog), "running: a failed start keeps docker's own error under that project");
check(/Port 8080 is already used by web \(in shop\)/.test(blog) && /Down removes what was left/.test(blog), "running: a failed start says who holds the port and how to clean up");

// Down asks first, and Cancel runs nothing.
await drawer.getByRole("button", { name: "Down shop" }).click();
const ask = p.getByRole("alertdialog");
check(/volumes, and the data in them, stay/.test(await ask.innerText()), "running: Down asks first and says volumes stay");
await ask.getByRole("button", { name: "Cancel" }).click();
check((await p.evaluate(() => window.__composed.length)) === 2, "running: cancelling Down runs nothing");

await drawer.locator(".compose-item", { hasText: "orders-api" }).locator("summary").click();
await drawer.getByRole("button", { name: "Copy the stop command for orders-api" }).click();
const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
check(clip === "cd '/Users/me/My Apps/orders-api' && docker --context colima compose stop", `running: the copied command quotes a folder with a space (${clip})`);
await drawer.getByRole("button", { name: "Show shop in Finder" }).click();
await p.waitForTimeout(200);
check(JSON.stringify(await p.evaluate(() => window.__revealed)) === JSON.stringify(["/Users/me/code/shop/compose.yaml"]), "running: Show in Finder asks for that Compose file");
await drawer.getByRole("button", { name: /Scan again/ }).click();
check(await drawer.getByRole("button", { name: /Scanning/ }).count() === 1, "running: Scan again shows it is scanning");
await p.keyboard.press("Escape");
check(await drawer.count() === 0, "running: Escape closes the panel");

// A container search that finds nothing points to the projects that match.
await p.getByRole("textbox", { name: /Search containers/ }).fill("sss");
const hint = p.locator("p.hint", { hasText: "No container matches" });
check(/1 Compose project that isn't running matches/.test(await hint.innerText().catch(() => "")), "running: an empty container search points to a matching project");
await hint.getByRole("button", { name: "Show it" }).click();
check((await p.getByRole("dialog", { name: "Compose projects" }).locator(".compose-item b").first().innerText().catch(() => "")) === "service-search-service", "running: Show it opens the panel already searched");
await p.keyboard.press("Escape");

// Every command of the session, from the sidebar.
await p.getByRole("button", { name: "Commands", exact: true }).click();
const log = p.getByRole("dialog", { name: "Commands" });
check((await log.locator(".cmd-log li").count()) >= 2 && /failed/.test(await log.innerText()), "running: the Commands list has both runs, the failed one marked");
check(p.errors.length === 0, `running: no page errors${p.errors.length ? ": " + p.errors.join("; ") : ""}`);

p = await open("nocompose");
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /^Compose projects/ }).click();
await p.waitForTimeout(400);
check(/No Compose files found/.test(await p.getByRole("dialog", { name: "Compose projects" }).innerText()), "nocompose: an empty scan explains what Spotlight skips");
await browser.close();
process.exit(failed ? 1 : 0);

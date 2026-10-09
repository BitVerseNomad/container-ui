// Pull panel checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
await p.goto(`file://${root}/preview/index.html`);
await p.waitForSelector(".ov-row");
await p.locator(".sidebar").getByRole("button", { name: "Images", exact: true }).click();
await p.waitForSelector("tbody tr");
await p.getByRole("button", { name: "Pull image" }).click();
await p.waitForSelector(".drawer");

check(await p.getByLabel("Search Docker Hub").count() === 1 && await p.getByLabel("Image to pull").count() === 1, "pull: finding and pulling are two separate fields");
check(/nothing is downloaded/i.test(await p.locator(".drawer").innerText()), "pull: says plainly that searching downloads nothing");

await p.getByLabel("Search Docker Hub").fill("mysql");
await p.getByRole("button", { name: "Search", exact: true }).click();
await p.waitForSelector(".hit");
const names = () => p.locator(".hit .hit-name").allInnerTexts().then((a) => a.map((s) => s.replace(/Official/, "").trim()));
let order = await names();
check(order[0] === "mysql" && order.includes("bitnami/mysql"), `pull: results default to most stars first (${order.join(", ")})`);
check(await p.locator(".hit .tag", { hasText: "Official" }).count() === 1, "pull: the official image carries an Official tag");

await p.getByLabel("Sort by").selectOption("name");
order = await names();
check(order[0] === "bitnami/mysql", `pull: sorting by name puts A first (${order.join(", ")})`);

await p.locator(".hit", { hasText: "bitnami/mysql" }).click();
check(await p.locator('.hit[aria-selected="true"]').count() === 1, "pull: the chosen result is highlighted");
check(await p.getByLabel("Image to pull").inputValue() === "bitnami/mysql", "pull: choosing a result fills the image to pull");
check(await p.getByRole("button", { name: "Pull bitnami/mysql" }).count() === 1, "pull: the Pull button names what it will download");
check(await p.locator(".drawer .primary").count() === 1, "pull: only one primary button");

await p.getByRole("button", { name: "Pull bitnami/mysql" }).click();
await p.waitForSelector(".drawer .out-log", { timeout: 5000 }).catch(() => {});
check(await p.locator(".drawer .out-log").count() === 1, "pull: progress is shown");
await p.waitForSelector("text=Pulled bitnami/mysql", { timeout: 8000 }).catch(() => {});
check(await p.locator(".drawer").getByRole("button", { name: /^Run bitnami\/mysql/ }).count() === 1, "pull: Run is offered once pulled");
await p.screenshot({ path: "/tmp/pull-after.png" });
await browser.close();
process.exit(failed ? 1 : 0);

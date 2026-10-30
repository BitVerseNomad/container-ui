// Volumes safety checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
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
await p.waitForSelector(".content");
await p.locator(".sidebar").getByRole("button", { name: "Volumes", exact: true }).click();
await p.waitForSelector("tbody tr:not(.group-row)");
await p.waitForFunction(() => /In use by/.test(document.querySelector("tbody")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
const row = (name) => p.locator("tr", { hasText: name }).first();
check(/In use by 1 container/.test(await row("mysql-data").innerText()) && /db/.test(await row("mysql-data").innerText()), "volumes: mysql-data shows it is in use by db");
check(/Not used/.test(await row("redis-data").innerText()), "volumes: redis-data shows Not used");
check(await row("mysql-data").getByRole("button", { name: /Remove volume mysql-data/ }).isDisabled(), "volumes: an in-use volume cannot be removed");
check(await row("redis-data").getByRole("button", { name: /Remove volume redis-data/ }).isEnabled(), "volumes: an unused named volume can be removed one at a time");
const bulk = p.getByRole("button", { name: /Remove unused anonymous/ });
check(await bulk.count() === 1 && /\(1\)/.test(await bulk.innerText()), "volumes: bulk action is limited to anonymous volumes and counts them");
await bulk.click();
await p.waitForSelector("[role=alertdialog]");
check(/anonymous/i.test(await p.locator("[role=alertdialog]").innerText()), "volumes: the confirmation names what it removes");
await p.locator("[role=alertdialog] .primary").click();
await p.waitForFunction(() => !/aaaaaaaaaaaa/.test(document.querySelector("tbody")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
const after = await p.locator("tbody").innerText();
check(!/aaaaaaaaaaaa/.test(after), "volumes: the unused anonymous volume is gone");
check(/redis-data/.test(after) && /pgdata-old/.test(after), "volumes: unused NAMED volumes survive the bulk action");
await browser.close();
process.exit(failed ? 1 : 0);

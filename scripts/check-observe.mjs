// Observability checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
async function open(tab) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(`file://${root}/preview/index.html`);
  await p.waitForSelector(".ov-row");
  if (tab !== "Overview") await p.locator(".sidebar").getByRole("button", { name: tab, exact: true }).click();
  return p;
}

// Overview: problems in plain words, recent activity, heaviest containers
let p = await open("Overview");
await p.waitForSelector(".problems .problem", { timeout: 8000 }).catch(() => {});
let t = await p.locator(".problems").innerText().catch(() => "");
check(/api/.test(t) && /health check is failing/i.test(t), "overview: an unhealthy container is listed with a plain reason");
check(/report-job/.test(t) && /too much memory/i.test(t), "overview: an out-of-memory stop is called out");
check(/worker/.test(t) && /keeps restarting/i.test(t), "overview: a container that keeps restarting is called out");
check(!/\bweb\b/.test(t), "overview: healthy containers are not listed as problems");
await p.waitForSelector(".activity li", { timeout: 8000 }).catch(() => {});
t = await p.locator(".activity").innerText().catch(() => "");
check(/api became unhealthy/.test(t) && /report-job ran out of memory/.test(t) && /ago/.test(t), "overview: recent activity reads in plain words with times");
check(/Heaviest right now/.test(await p.locator(".content").innerText()) && /kafka/.test(await p.locator(".heaviest").innerText()), "overview: shows the heaviest containers");
check(await p.locator(".content .primary:visible").count() === 1, "overview: still exactly one primary button");
await p.screenshot({ path: "/tmp/obs-overview.png" });
await p.locator(".problem", { hasText: "api" }).getByRole("button", { name: /Open/ }).click();
await p.waitForSelector(".detail");

// container page: health panel with the last check's output
await p.waitForSelector(".health-panel", { timeout: 4000 }).catch(() => {});
t = await p.locator(".health-panel").innerText().catch(() => "");
check(/unhealthy/i.test(t) && /Connection refused/.test(t) && /5 checks in a row/.test(t), "container page: shows what the failing health check said");
check(/Restarts/.test(t), "container page: shows restarts");
await p.screenshot({ path: "/tmp/obs-container.png" });
await p.close();

// containers list: health badges
p = await open("Containers");
await p.waitForSelector("tbody tr");
check(/unhealthy/.test(await p.locator("tr", { hasText: "api" }).first().innerText()), "containers: an unhealthy badge on api");
check(/healthy/.test(await p.locator("tr", { hasText: "web" }).first().innerText()), "containers: a healthy badge on web");
await p.locator("table button.link", { hasText: "report-job" }).click();
await p.waitForSelector(".detail");
t = await p.locator(".health-panel").innerText();
check(/too much memory/i.test(t) && /No health check/i.test(t), "container page: out-of-memory is explained, and a missing health check is said plainly");
await p.getByRole("tab", { name: "Activity" }).click();
await p.waitForSelector(".activity li", { timeout: 4000 }).catch(() => {});
t = await p.locator(".tabpane").innerText();
check(/report-job ran out of memory/.test(t) && !/api became/.test(t), "container page: the Activity tab shows only this container's events");
await p.close();

// volumes: sizes
p = await open("Volumes");
await p.waitForSelector("tbody tr");
await p.waitForFunction(() => /GiB|MiB/.test(document.querySelector("tbody")?.textContent ?? ""), null, { timeout: 6000 }).catch(() => {});
t = await p.locator("tr", { hasText: "pgdata-old" }).innerText();
check(/\d+(\.\d)? (GiB|MiB)/.test(t), `volumes: a size is shown (${t.replace(/\s+/g, " ")})`);
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

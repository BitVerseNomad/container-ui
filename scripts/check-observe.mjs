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
  await p.waitForSelector("table.list tbody tr:not(.group-row)");
  if (tab !== "Containers") await p.locator(".sidebar").getByRole("button", { name: tab, exact: true }).click();
  return p;
}

// Home: problems in plain words under each container's status
let p = await open("Containers");
await p.waitForSelector("table.list .plevel", { timeout: 8000 }).catch(() => {});
const row = (name) => p.locator("table.list tbody tr:not(.group-row)", { has: p.locator("b", { hasText: new RegExp(`^${name}$`) }) }).first().innerText().catch(() => "");
check(/health check is failing/i.test(await row("api")), "home: an unhealthy container shows a plain reason");
check(/too much memory|ran out of memory/i.test(await row("report-job")), "home: an out-of-memory stop is called out");
check(/keeps restarting/i.test(await row("worker")), "home: a container that keeps restarting is called out");
check(!/failing|memory|restarting/i.test(await row("web")), "home: healthy containers carry no problem line");
const dot = (name) => p.locator("table.list tbody tr:not(.group-row)", { has: p.locator("b", { hasText: new RegExp(`^${name}$`) }) }).first().locator(".sdot").getAttribute("class").catch(() => "");
check(/\bbad\b/.test(await dot("api")) && /\bwarn\b/.test(await dot("worker")) && /\bon\b/.test(await dot("web")), "home: the dot follows health (red failing, amber restarting, green fine)");
check(await p.locator(".content .primary:visible").count() === 1, "home: still exactly one primary button");
await p.screenshot({ path: "/tmp/obs-home.png" });
await p.locator("table.list button.link-plain", { hasText: "api" }).first().click();
await p.waitForSelector(".detail");

// container page: health panel with the last check's output
await p.waitForSelector(".health-panel", { timeout: 4000 }).catch(() => {});
let t = await p.locator(".health-panel").innerText().catch(() => "");
check(/unhealthy/i.test(t) && /Connection refused/.test(t) && /5 checks in a row/.test(t), "container page: shows what the failing health check said");
check(/Restarts/.test(t), "container page: shows restarts");
check((t.match(/checks in a row have failed/g) ?? []).length === 1, "container page: the failed-checks line shows once");
await p.locator(".tab", { hasText: "Stats" }).hover();
const lines = await p.evaluate(() => [...document.querySelectorAll(".tab")].filter((el) => getComputedStyle(el).borderBottomColor !== "rgba(0, 0, 0, 0)").length);
check(lines === 1, `container page: only the open tab is underlined, even with another hovered (${lines})`);
check(/^Running · Unhealthy$/.test((await p.locator(".detail header .status").first().innerText().catch(() => "")).trim()), "container page: a red dot reads Running · Unhealthy, not a bare Running");
check((await p.locator(".detail header .status .sdot").count()) === 1, "container page: state has the same dot as the list");
check(/Started .*ago|just now/.test(t) && !/Up since/.test(t), "container page: start time is relative, like the list");
check(await p.getByRole("button", { name: "Open the logs" }).count() === 0, "container page: no 'Open the logs' while the Logs tab is already open");
await p.getByRole("button", { name: "Open a shell" }).click();
await p.waitForFunction(() => (window.__terminal ?? []).length > 0, null, { timeout: 3000 }).catch(() => {});
const term = await p.evaluate(() => window.__terminal ?? []);
check(term.length === 1 && term[0].kind === "shell" && /^[a-z]/.test(term[0].target ?? ""), "container page: Open a shell asks for a Terminal shell in that container");
await p.waitForFunction(() => /\d\d:\d\d:\d\d  /.test(document.querySelector(".logs")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
check(/\d\d:\d\d:\d\d  /.test(await p.locator(".logs").innerText()), "container page: log lines carry a time");
check(await p.getByRole("button", { name: /Following new lines/ }).getAttribute("aria-pressed") === "true", "container page: Following is a real toggle");
await p.screenshot({ path: "/tmp/obs-container.png" });
await p.close();

// containers list: health badges
p = await open("Containers");
await p.waitForFunction(() => /health check is failing/.test(document.querySelector("tbody")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
check(/Its health check is failing/.test(await p.locator("tr", { hasText: "api" }).first().innerText()), "containers: api says in words that its health check is failing");
check(/healthy/.test(await p.locator("tr", { hasText: "web" }).first().innerText()), "containers: a healthy badge on web");
await p.locator("table.list button.link-plain", { hasText: "report-job" }).click();
await p.waitForSelector(".detail");
t = await p.locator(".health-panel").innerText();
check(/ran out of memory/i.test(t) && /more memory than it was allowed/.test(t) && /No health check/i.test(t), "container page: out-of-memory is explained, and a missing health check is said plainly");
await p.getByRole("tab", { name: "Activity" }).click();
await p.waitForSelector(".activity li", { timeout: 4000 }).catch(() => {});
t = await p.locator(".tabpane").innerText();
check(/report-job ran out of memory/.test(t) && !/api became/.test(t), "container page: the Activity tab shows only this container's events");
await p.close();

// container rows: Logs and Shell are one click away
p = await open("Containers");
await p.waitForSelector("tbody tr:not(.group-row)");
await p.getByRole("button", { name: "Open a shell in web" }).click();
await p.waitForFunction(() => (window.__terminal ?? []).length > 0, null, { timeout: 3000 }).catch(() => {});
t = JSON.stringify(await p.evaluate(() => window.__terminal ?? []));
check(/"kind":"shell".*"target":"web"/.test(t), `row Shell: opens a shell in that container (${t})`);
check((await p.getByRole("button", { name: "Open a shell in cache" }).count()) === 0, "row Shell: not offered on a stopped container");
await p.getByRole("button", { name: "Logs for cache" }).click();
await p.waitForSelector(".tabs [aria-selected=true]", { timeout: 3000 }).catch(() => {});
const selTab = await p.locator(".tabs [aria-selected=true]").innerText().catch((e) => String(e));
await p.waitForFunction(() => /cache/.test(document.querySelector(".content")?.textContent ?? ""), null, { timeout: 3000 }).catch(() => {});
check(selTab.trim() === "Logs" && /cache/.test(await p.locator(".content").innerText()), "row Logs: opens that container on its Logs tab");
await p.close();

// volumes: sizes
p = await open("Volumes");
await p.waitForSelector("tbody tr:not(.group-row)");
await p.waitForFunction(() => /GiB|MiB/.test(document.querySelector("tbody")?.textContent ?? ""), null, { timeout: 6000 }).catch(() => {});
t = await p.locator("tr", { hasText: "pgdata-old" }).innerText();
check(/\d+(\.\d)? (GiB|MiB)/.test(t), `volumes: a size is shown (${t.replace(/\s+/g, " ")})`);
await p.close();

// Known apps: a Kafka setup that runs but can't work is called out, with commands to copy
p = await open("Containers");
const krow = (name) => p.locator("table.list tbody tr:not(.group-row)", { has: p.locator("b", { hasText: new RegExp(`^${name}$`) }) }).first();
await p.waitForFunction(() => /Can.t reach Kafka/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
check(/Can't reach Kafka/.test(await krow("kafka-ui").innerText().catch(() => "")), "apps: Kafka UI pointed at localhost is called out on its row");
check(/inside its own container/.test(await krow("kafka-ui").locator(".plevel").getAttribute("title").catch(() => "")), "apps: the row tooltip carries the full reason");
check(/Only reachable from your Mac/.test(await krow("kafka").innerText().catch(() => "")), "apps: a broker that only advertises localhost is called out");
await krow("kafka-ui").locator("button.link-plain").click();
await p.waitForSelector(".health-panel pre.cmd", { timeout: 8000 }).catch(() => {});
const cmd = await p.locator(".health-panel pre.cmd").first().innerText().catch(() => "");
check(/KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS='kafka:19092'/.test(cmd) && /rename kafka-ui kafka-ui-old/.test(cmd) && !/rm -f/.test(cmd), "apps: the detail page gives a safe replace command that uses the broker's name");
check(await p.getByRole("button", { name: /Copy commands/ }).count() > 0, "apps: the commands can be copied");
check(/Can't reach Kafka/.test(await p.locator("header").first().innerText().catch(() => "")), "apps: the status line names the problem");
check(p.errors.length === 0, `apps: no page errors (${p.errors.join("; ")})`);
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

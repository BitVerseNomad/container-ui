// Observability checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
async function open(tab) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(`file://${root}/preview/index.html`);
  await p.waitForSelector("ul.apps > li.app");
  if (tab !== "Containers") await p.locator(".sidebar").getByRole("button", { name: tab, exact: true }).click();
  return p;
}

// Home: problems in plain words under each app's row; an opened project shows each under its own service
let p = await open("Containers");
await p.waitForSelector("li.app .problem", { timeout: 8000 }).catch(() => {});
const appRow = (name) => p.locator("li.app", { has: p.locator(".app-row .app-name", { hasText: new RegExp(`^${name}$`) }) }).first();
const svcRow = (name) => p.locator("ul.svc > li", { has: p.locator(".svc-name", { hasText: new RegExp(`^${name}\\b`) }) }).first();
const shop = await appRow("shop").innerText();
check(/api · health check is failing/i.test(shop), "home: an unhealthy container shows a plain reason, under its project row with its name");
check(/ran out of memory/i.test(shop), "home: an out-of-memory stop is called out");
check(/worker · keeps restarting/i.test(shop), "home: a container that keeps restarting is called out");
check(!/web ·/.test(shop) && await appRow("shop").locator(".problem:not(.off)").count() === 3 && await appRow("shop").locator(".problem.off").count() === 1, "home: healthy containers carry no problem line (cache, simply stopped, has the one plain line)");
const markOf = (r) => r.locator(".mark").first().getAttribute("class");
check(/\bbad\b/.test(await markOf(appRow("kafka-ui"))) && /\bwarn\b/.test(await markOf(appRow("kafka"))) && /\bbad\b/.test(await markOf(appRow("shop"))), "home: the mark follows the worst problem (kafka-ui and shop red, kafka amber)");
await appRow("shop").locator(".app-name").click();
check(/\bbad\b/.test(await markOf(svcRow("api"))) && /\bwarn\b/.test(await markOf(svcRow("worker"))) && await svcRow("web").locator(".mark .dot.on").count() === 1, "home: the mark follows health per service (red failing, amber restarting, green fine)");
check(await svcRow("api").locator(".problem").count() === 1 && /Health check is failing/.test(await svcRow("api").locator(".problem").innerText()) && await svcRow("web").locator(".problem").count() === 0, "home: opened, each problem sits under its own service");
check(await p.locator(".content .primary:visible").count() === 1 + await p.locator(".content .problem .primary:visible").count(), "home: still exactly one primary button outside the problem lines");
await p.screenshot({ path: "/tmp/obs-home.png" });
await p.locator('ul.svc button.svc-name[aria-label^="api,"]').click();
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

// the home carries no health badge; the container page says healthy
p = await open("Containers");
await p.locator(".app-name", { hasText: /^shop$/ }).click();
await p.waitForSelector("ul.svc li .problem", { timeout: 6000 }).catch(() => {});
check(!/healthy/i.test(await p.locator("ul.svc > li", { hasText: "web" }).first().innerText()), "containers: no health badge on the list, just a plain row for web");
await p.locator('ul.svc button.svc-name[aria-label^="web,"]').click();
await p.waitForSelector(".health-panel", { timeout: 4000 }).catch(() => {});
check(/healthy/i.test(await p.locator(".health-panel").innerText().catch(() => "")), "containers: the container page says web is healthy");
await p.close();
p = await open("Containers");
await p.locator(".app-name", { hasText: /^shop$/ }).click();
await p.locator('ul.svc button.svc-name[aria-label^="report-job,"]').click();
await p.waitForSelector(".detail");
t = await p.locator(".health-panel").innerText();
check(/ran out of memory/i.test(t) && /more memory than it was allowed/.test(t) && /No health check/i.test(t), "container page: out-of-memory is explained, and a missing health check is said plainly");
await p.getByRole("tab", { name: "Activity" }).click();
await p.waitForSelector(".activity li", { timeout: 4000 }).catch(() => {});
t = await p.locator(".tabpane").innerText();
check(/report-job ran out of memory/.test(t) && !/api became/.test(t), "container page: the Activity tab shows only this container's events");
await p.close();

// container rows: Logs and Shell are one menu click away
p = await open("Containers");
await p.locator(".app-name", { hasText: /^shop$/ }).click();
await p.getByRole("button", { name: "More actions for web", exact: true }).click();
await p.getByRole("menuitem", { name: "Open a shell" }).click();
await p.waitForFunction(() => (window.__terminal ?? []).length > 0, null, { timeout: 3000 }).catch(() => {});
t = JSON.stringify(await p.evaluate(() => window.__terminal ?? []));
check(/"kind":"shell".*"target":"web"/.test(t), `row Shell: opens a shell in that container (${t})`);
await p.getByRole("button", { name: "More actions for cache", exact: true }).click();
check((await p.getByRole("menuitem", { name: "Open a shell" }).count()) === 0, "row Shell: not offered on a stopped container");
await p.getByRole("menuitem", { name: "Logs" }).click();
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
const krow = (name) => p.locator("li.app", { has: p.locator(".app-row .app-name", { hasText: new RegExp(`^${name}$`) }) }).first();
await p.waitForFunction(() => /Can.t reach Kafka/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
check(/Can't reach Kafka/.test(await krow("kafka-ui").innerText().catch(() => "")), "apps: Kafka UI pointed at localhost is called out on its row");
check(/(inside its own container|localhost is the container itself)/i.test(await krow("kafka-ui").locator(".problem").getAttribute("title").catch(() => "")), "apps: the row tooltip carries the full reason");
check(/Only reachable from your Mac/.test(await krow("kafka").innerText().catch(() => "")), "apps: a broker that only advertises localhost is called out");
await krow("kafka-ui").locator("button.app-name").click();
await p.locator("details.fix-commands summary").first().click({ timeout: 8000 }).catch(() => {});
const cmd = await p.locator(".health-panel pre.cmd").first().innerText().catch(() => "");
check(/KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS='kafka:19092'/.test(cmd) && /rename kafka-ui kafka-ui-old/.test(cmd) && !/rm -f/.test(cmd), "apps: the detail page gives a safe replace command that uses the broker's name");
check(await p.getByRole("button", { name: /Copy commands/ }).count() > 0, "apps: the commands can be copied");
check(/Can't reach Kafka/.test(await p.locator("header").first().innerText().catch(() => "")), "apps: the status line names the problem");
check(p.errors.length === 0, `apps: no page errors (${p.errors.join("; ")})`);
await p.close();

// Fix: one click replaces both containers, and the problems go away
p = await open("Containers");
const frow = (name) => p.locator("li.app", { has: p.locator(".app-row .app-name", { hasText: new RegExp(`^${name}$`) }) }).first();
await p.waitForFunction(() => /Can.t reach Kafka/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
await frow("kafka-ui").locator("button.app-name").click();
const fixBtn = p.getByRole("button", { name: /^Fix kafka and kafka-ui$/ });
await fixBtn.waitFor({ timeout: 8000 }).catch(() => {});
check(await fixBtn.count() === 1, "fix: Kafka UI's page has one Fix kafka and kafka-ui button");
check(await p.locator("details.fix-commands pre.cmd").count() > 0 && !(await p.locator("details.fix-commands").getAttribute("open")), "fix: the commands are still there, folded away");
await fixBtn.click();
const dialog = p.getByRole("alertdialog");
check(/^Replace kafka and kafka-ui\? kafka will start with no topics\./.test(await dialog.innerText().catch(() => "")) && /no topics/.test(await dialog.innerText().catch(() => "")), "fix: it asks first, names both, and warns about topics");
await dialog.getByRole("button", { name: /^Replace/ }).click();
await p.waitForSelector(".fix-result.ok", { timeout: 45000 }).catch(() => {});
check(/Fixed\. kafka and kafka-ui were replaced/.test(await p.locator(".fix-result.ok").first().innerText().catch(() => "")), "fix: the page says both were replaced");
const after = await p.evaluate(() => window.__mock.state().ctrs.filter((c) => /^kafka/.test(c.name)).map((c) => `${c.name}:${c.state}:${c.networks.join("+")}:${c.env.find((e) => /ADVERTISED|BOOTSTRAP/.test(e)) ?? ""}`));
check(after.length === 2 && after.every((x) => x.includes(":running:")) && after.some((x) => x.startsWith("kafka:") && /PLAINTEXT:\/\/kafka:19092/.test(x)) && after.some((x) => x.startsWith("kafka-ui:") && /devnet/.test(x) && /kafka:19092/.test(x)), `fix: two new containers run with the fixed settings and no -old left (${after.join(" | ")})`);
await p.waitForFunction(() => !/Can.t reach Kafka/.test(document.querySelector("header")?.innerText ?? ""), null, { timeout: 15000 }).catch(() => {});
check(!/Can't reach Kafka/.test(await p.locator("header").first().innerText().catch(() => "")), "fix: the page no longer reports the problem");
check(p.errors.length === 0, `fix: no page errors (${p.errors.join("; ")})`);
await p.close();

// Fix that fails half-way: the broker is replaced, Kafka UI's new copy won't start, so the old one comes back
p = await open("Containers");
await p.waitForFunction(() => /Can.t reach Kafka/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
await p.evaluate(() => window.__mock.failRunOnce("kafka-ui"));
await p.locator("li.app", { has: p.locator(".app-row .app-name", { hasText: /^kafka-ui$/ }) }).first().locator("button.app-name").click();
await p.getByRole("button", { name: /^Fix kafka and kafka-ui$/ }).click({ timeout: 8000 }).catch(() => {});
await p.getByRole("alertdialog").getByRole("button", { name: /^Replace/ }).click().catch(() => {});
await p.waitForFunction(() => /A fix is running/.test(document.body.innerText), null, { timeout: 8000 }).catch(() => {});
check(/A fix is running/.test(await p.locator("header").first().innerText().catch(() => "")) && (await p.getByRole("button", { name: "Remove" }).count()) === 0, "fix fails: Stop and Remove are locked while it runs");
await p.waitForSelector(".fix-result.bad", { timeout: 60000 }).catch(() => {});
const bad = await p.locator(".fix-result.bad").first().innerText().catch(() => "");
check(/kafka was replaced, but kafka-ui couldn't be fixed/.test(bad) && /simulated/.test(bad) && /The old kafka-ui is back as it was/.test(bad), `fix fails: the page says what happened (${bad.slice(0, 160)})`);
const back = await p.evaluate(() => window.__mock.state().ctrs.filter((c) => /^kafka-ui/.test(c.name)).map((c) => `${c.name}:${c.state}`));
check(back.length === 1 && back[0] === "kafka-ui:running", `fix fails: the old kafka-ui runs again under its own name (${back.join(" | ")})`);
check(p.errors.length === 0, `fix fails: no page errors (${p.errors.join("; ")})`);
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

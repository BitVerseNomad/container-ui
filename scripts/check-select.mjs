// Containers rows: no selection and no bulk bar, the "..." menus, Remove asking first, and the Kubernetes-owned row
// (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
const home = "ul.apps > li.app";
async function open(scenario) {
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=${scenario}`);
  await page.waitForSelector(home, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);
  return page;
}
const appRow = (p, name) => p.locator("li.app", { has: p.locator(".app-row .app-name", { hasText: new RegExp(`^${name}$`) }) });
const expand = async (p, name) => { const b = appRow(p, name).locator(".app-row .app-name"); if (await b.getAttribute("aria-expanded") === "false") await b.click(); };
const more = (p, who) => p.getByRole("button", { name: `More actions for ${who}`, exact: true });
const items = async (p) => (await p.getByRole("menuitem").allInnerTexts()).map((t) => t.split("\n")[0].trim());
const ids = async (p) => (await p.evaluate(() => window.__mock.state())).ctrs.map((c) => c.id);
const idOf = async (p, name) => (await p.evaluate(() => window.__mock.state())).ctrs.find((c) => c.name === name)?.id;

// Kubernetes pods: one row, owned by the cluster. Its pod containers never show on home; its button opens the tab.
let p = await open("k8spods");
const kube = appRow(p, "Kubernetes");
check(await kube.count() === 1, "k8spods: one Kubernetes row");
const order = await p.locator(`${home} > .app-row .app-name`).allInnerTexts();
check(order[order.length - 1] === "Kubernetes" && order.length === 4, `k8spods: Kubernetes comes last (${order.join(", ")})`);
check(await p.getByText("k8s_coredns", { exact: false }).count() === 0 && await p.getByText(/^coredns · /).count() === 0, "k8spods: pod containers are not listed on home, not even by pod name");
check(/2 containers/.test(await kube.locator(".app-state").innerText()), "k8spods: the Kubernetes row counts its containers");
check(await kube.locator("button.app-name").getAttribute("aria-expanded") === null && await kube.locator(".app-chev .chev").count() === 0, "k8spods: the Kubernetes row does not expand into pods");
check(await p.getByRole("checkbox").count() === 0, "k8spods: no row has a box to select it");
check(await kube.getByRole("button", { name: /^(Stop|Start|Restart|Remove)/ }).count() === 0 && await kube.locator("button.more").count() === 0 && await p.getByRole("button", { name: /^(Stop|Remove|Restart) k8s_/ }).count() === 0, "k8spods: the Kubernetes row has no Stop, Start, Restart or Remove, and no menu");
check(await kube.locator("button.main").innerText() === "Open" && await kube.locator("button.main").getAttribute("aria-label") === "Open the Kubernetes tab", "k8spods: its main button is Open");
check(await kube.locator(".problem").count() === 0 && !/The cluster restarts them/.test(await p.locator(".content").innerText()), "k8spods: no problem lines and no note about who manages the pods");
await kube.locator("button.main").click();
await p.waitForTimeout(500);
check(await p.locator(".sidebar nav .nav-item.active").getAttribute("aria-current") === "page" && /Kubernetes/.test(await p.locator(".sidebar nav .nav-item.active").innerText()), "k8spods: Open goes to the Kubernetes tab");
await p.locator(".sidebar nav").getByRole("button", { name: "Containers", exact: true }).click();
await p.waitForSelector(home, { timeout: 4000 });
await kube.locator("button.app-name").click();
await p.waitForTimeout(500);
check(/Kubernetes/.test(await p.locator(".sidebar nav .nav-item.active").innerText()), "k8spods: the row's name opens the Kubernetes tab too");
check(p.errors.length === 0, `k8spods: no page errors${p.errors.length ? ": " + p.errors.join("; ") : ""}`);
await p.close();

// Running: nothing to select, one "..." menu per row, and Remove asks first
p = await open("running");
check(await p.getByRole("checkbox").count() === 0 && await p.getByRole("region", { name: "Selected containers" }).count() === 0 && await p.getByRole("checkbox", { name: /Select all/ }).count() === 0, "running: no checkboxes, no select all, no selection bar");
await expand(p, "shop");
check(await p.getByRole("checkbox").count() === 0, "running: an opened project has no checkboxes either");
const titleMid = await p.locator(".page-head h1").evaluate((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
const newMid = await p.locator(".page-action").evaluate((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
check(Math.abs(titleMid - newMid) <= 4, `running: New sits on the title row like Pull image and New profile (${Math.round(titleMid)}, ${Math.round(newMid)})`);
check(await p.evaluate(() => { const c = document.querySelector(".content"); return c.scrollWidth <= c.clientWidth + 1; }), "running: no sideways scroll at 980px");
const rowsBefore = await p.locator(`${home} > .app-row .app-name`).allInnerTexts();

// The menus
await more(p, "kafka").click();
check(JSON.stringify(await items(p)) === JSON.stringify(["Logs", "Open a shell", "Restart", "Not an issue", "Remove…"]), `menu: a loose running container with a problem offers Logs, Open a shell, Restart, Not an issue, Remove… (${(await items(p)).join(", ")})`);
await p.keyboard.press("Escape");
await more(p, "web").click();
check(JSON.stringify(await items(p)) === JSON.stringify(["Logs", "Open a shell", "Restart", "Stop", "Remove…"]), `menu: a running service offers Logs, Open a shell, Restart, Stop, Remove… (${(await items(p)).join(", ")})`);
await p.keyboard.press("Escape");
await more(p, "cache").click();
check(JSON.stringify(await items(p)) === JSON.stringify(["Logs", "Start", "Remove…"]), `menu: a stopped service offers Logs, Start, Remove… and no shell or Restart (${(await items(p)).join(", ")})`);
await p.keyboard.press("Escape");
await more(p, "api").click();
check((await items(p)).includes("Not an issue"), "menu: a service with a problem offers Not an issue");
await p.keyboard.press("Escape");
await more(p, "db").click();
check(!(await items(p)).includes("Not an issue"), "menu: a service with no problem does not offer Not an issue");
await p.keyboard.press("Escape");
await more(p, "shop").click();
const pm = await items(p);
check(JSON.stringify(pm.filter((t) => !/^Start (the \d+ stopped|[\w-]+)$/.test(t))) === JSON.stringify(["Rebuild", "Logs", "Restart", "Show in Finder", "Remove…"]), `menu: a project offers Rebuild, Logs, Restart, Show in Finder, Remove… (${pm.join(", ")})`);
check(pm.filter((t) => /^Start (the \d+ stopped|[\w-]+)$/.test(t)).length === 1 && /report-job|the 1 stopped/.test(pm[0]), "menu: a partly running project also offers, first, to start its one stopped service");
await p.keyboard.press("Escape");
await p.getByRole("button", { name: "More actions for kafka", exact: true }).focus();
await p.keyboard.press("Enter");
check(await p.evaluate(() => document.activeElement?.getAttribute("role") === "menuitem") && await p.getByRole("menu").count() === 1, "menu: opens from the keyboard and moves focus to the first item");
await p.keyboard.press("Escape");
check(await p.getByRole("menu").count() === 0 && await p.evaluate(() => document.activeElement?.getAttribute("aria-label") === "More actions for kafka"), "menu: Escape closes it and focus goes back to the … button");

// "Not an issue" takes the problem line away
check(await appRow(p, "shop").locator("ul.svc li", { hasText: "api" }).locator(".problem").count() === 1, "mute: api has a problem line before");
await more(p, "api").click();
await p.getByRole("menuitem", { name: "Not an issue" }).click();
await p.waitForTimeout(300);
check(await appRow(p, "shop").locator("ul.svc li", { hasText: "api" }).locator(".problem").count() === 0, "mute: Not an issue takes api's problem line away");

// Remove asks first, names the container, and removes exactly that one ID
const all0 = await ids(p);
const webId = await idOf(p, "web");
await more(p, "web").click();
await p.getByRole("menuitem", { name: "Remove…" }).click();
await p.waitForSelector("[role=alertdialog]");
const ask = await p.locator(".modal").innerText();
check(/Remove web\?/.test(ask) && /running and will be stopped first/.test(ask) && /image and volumes stay/.test(ask), `remove: asks first, names the container and says it is running (${ask.replace(/\n/g, " / ")})`);
check((await ids(p)).length === all0.length, "remove: nothing is removed while the question is open");
await p.locator(".modal").getByRole("button", { name: "Cancel" }).click();
await p.waitForTimeout(500);
check((await ids(p)).length === all0.length && await more(p, "web").count() === 1, "remove: Cancel keeps the container");
await more(p, "web").click();
await p.getByRole("menuitem", { name: "Remove…" }).click();
await p.waitForSelector("[role=alertdialog]");
await p.locator(".modal").getByRole("button", { name: "Remove" }).click();
await p.waitForFunction(() => !document.querySelector('[aria-label="More actions for web"]'), null, { timeout: 8000 }).catch(() => {});
const all1 = await ids(p);
check(all0.filter((i) => !all1.includes(i)).join() === webId && all1.every((i) => all0.includes(i)), `remove: confirming removes exactly web's ID and nothing else (${all0.length} to ${all1.length} containers)`);
// a loose container: same question, same single removal
const kafkaId = await idOf(p, "kafka");
await more(p, "kafka").click();
await p.getByRole("menuitem", { name: "Remove…" }).click();
await p.waitForSelector("[role=alertdialog]");
await p.locator(".modal").getByRole("button", { name: "Remove" }).click();
await p.waitForFunction(() => !document.querySelector('[aria-label="More actions for kafka"]'), null, { timeout: 8000 }).catch(() => {});
const all2 = await ids(p);
check(all1.filter((i) => !all2.includes(i)).join() === kafkaId && all2.every((i) => all1.includes(i)) && await appRow(p, "kafka").count() === 0 && await appRow(p, "kafka-ui").count() === 1, "remove: a loose container's row goes, and kafka-ui next to it stays");

// A busy row locks its own buttons and menu, and says so for assistive tech
await p.getByRole("button", { name: "Stop shop", exact: true }).click();
const busyMain = appRow(p, "shop").locator("button.main");
check(await busyMain.getAttribute("aria-disabled") === "true" && /Stopping/.test(await busyMain.innerText()), "busy: the main button says Stopping… and is aria-disabled");
await more(p, "shop").click();
const disabled = await p.getByRole("menuitem").evaluateAll((els) => els.filter((e) => e.getAttribute("aria-disabled") === "true").map((e) => e.textContent.trim()));
check(disabled.some((t) => /Restart/.test(t)) && disabled.some((t) => /Remove/.test(t)), `busy: the project's Restart and Remove… are aria-disabled while it works (${disabled.join(", ")})`);
await p.keyboard.press("Escape");
await p.waitForTimeout(3500);
check(JSON.stringify(await p.locator(`${home} > .app-row .app-name`).allInnerTexts()) === JSON.stringify(rowsBefore.filter((n) => n !== "kafka")), "busy: Stopping a project does not reorder the rows");
check(p.errors.length === 0, `running: no page errors${p.errors.length ? ": " + p.errors.join("; ") : ""}`);
await browser.close();
process.exit(failed ? 1 : 0);

// Containers selection and Kubernetes-owned rows (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
async function open(scenario) {
  const page = await browser.newPage({ viewport: { width: 980, height: 640 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=${scenario}`);
  await page.waitForSelector("table.list tbody tr:not(.group-row)", { timeout: 4000 }).catch(() => {});
  return page;
}
const rowCount = (p) => p.locator("table.list tbody tr:not(.group-row)").count();

// Kubernetes pods: their own folded group, locked rows
let p = await open("k8spods");
const kubeToggle = p.getByRole("button", { name: /Kubernetes pods/ });
check(await kubeToggle.count() === 1, "k8spods: a Kubernetes pods group is shown");
check(await kubeToggle.getAttribute("aria-expanded") === "false", "k8spods: the Kubernetes group starts folded");
check(await p.getByText("k8s_coredns", { exact: false }).count() === 0, "k8spods: pod containers are hidden while folded");
await kubeToggle.click();
check(await p.getByRole("checkbox", { name: /k8s_|coredns/ }).count() === 0, "k8spods: a pod row has no box to select it");
check(await p.getByText(/^coredns · /).count() >= 1, "k8spods: pods are named by container, pod and namespace");
check(await p.getByRole("button", { name: /^(Stop|Remove|Restart) k8s_/ }).count() === 0, "k8spods: pod rows have no stop, restart or remove");
check(await p.getByText(/The cluster restarts them/).count() === 1, "k8spods: the group says who manages them");
await p.getByRole("checkbox", { name: "Select all shown containers" }).check();
const bar = p.getByRole("region", { name: "Selected containers" });
check((await bar.innerText()).includes("9 selected"), "k8spods: select all picks the 9 normal containers, not the pods");
check(p.errors.length === 0, `k8spods: no page errors${p.errors.length ? ": " + p.errors.join("; ") : ""}`);
await p.close();

// Selection and bulk actions
p = await open("running");
check(await p.getByRole("region", { name: "Selected containers" }).count() === 0, "running: no selection bar until something is picked");
const titleMid = await p.locator(".page-head h1").evaluate((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
const newMid = await p.locator(".page-action").evaluate((e) => { const r = e.getBoundingClientRect(); return r.top + r.height / 2; });
check(Math.abs(titleMid - newMid) <= 4, `running: New sits on the title row like Pull image and New profile (${Math.round(titleMid)}, ${Math.round(newMid)})`);
const tops = await p.locator(".toolbar > :not(.page-action)").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
check(Math.max(...tops) - Math.min(...tops) <= 2, `running: the toolbar fits on one line at 980px (${tops.join(", ")})`);
const secondRow = p.locator("table.list tbody tr:not(.group-row)").nth(1);
const y0 = (await secondRow.boundingBox()).y;
await p.getByRole("checkbox", { name: "Select web" }).check();
check(Math.abs((await secondRow.boundingBox()).y - y0) < 1, "running: ticking the first box does not move the rows");
const tint = await p.locator("tr.picked td").first().evaluate((el) => getComputedStyle(el).backgroundColor);
const plain = await secondRow.locator("td").first().evaluate((el) => getComputedStyle(el).backgroundColor);
check(tint !== plain, `running: a picked row is tinted (${tint} vs ${plain})`);
await p.getByRole("checkbox", { name: "Select web" }).uncheck();
await p.getByRole("button", { name: "shop", exact: true }).click();
await p.getByRole("checkbox", { name: "Select all shown containers" }).check();
const picks = await p.getByRole("region", { name: "Selected containers" }).innerText();
const visible = await p.getByRole("checkbox", { name: /^Select (?!all)/ }).count();
check(picks.includes(`${visible} selected`), `running: select all with shop folded picks only the ${visible} visible rows (${picks.split("\n")[0]})`);
await p.getByRole("checkbox", { name: "Select all shown containers" }).uncheck();
await p.getByRole("button", { name: "shop", exact: true }).click();
await p.getByRole("checkbox", { name: "Select web" }).check();
await p.getByRole("checkbox", { name: "Select cache" }).check();
const sel = p.getByRole("region", { name: "Selected containers" });
const selText = await sel.innerText();
check(selText.includes("2 selected"), "running: picking two rows shows 2 selected");
check(/Start/.test(selText) && /Stop/.test(selText), "running: a running and a stopped pick offer both Start and Stop");
await sel.getByRole("button", { name: /Stop/ }).click();
await p.waitForTimeout(600);
check(await p.getByRole("button", { name: "Start web" }).count() === 1, "running: bulk Stop stopped web");
check(await p.getByRole("region", { name: "Selected containers" }).count() === 0, "running: the selection clears after an action");
const before = await rowCount(p);
await p.getByRole("checkbox", { name: "Select web" }).check();
await p.getByRole("checkbox", { name: "Select cache" }).check();
await p.getByRole("region", { name: "Selected containers" }).getByRole("button", { name: /Remove/ }).click();
const dlg = p.locator(".modal");
await p.waitForSelector("[role=alertdialog]"); const ask = await dlg.innerText(); check(/Remove 2 containers\?\s+(web, cache|cache, web)/.test(ask), `running: remove asks once and names both (${ask.replace(/\n/g, " / ")})`);
await dlg.getByRole("button", { name: "Remove" }).click();
await p.waitForTimeout(600);
check(await rowCount(p) === before - 2, "running: confirmed remove takes both rows away");
await p.getByRole("checkbox", { name: "Select db" }).check();
await p.getByRole("textbox", { name: "Search containers" }).fill("kafka");
check(await p.getByRole("region", { name: "Selected containers" }).count() === 0, "running: a picked row filtered out of view is not acted on");
await p.getByRole("textbox", { name: "Search containers" }).fill("");
const chip = p.getByRole("button", { name: "Copy localhost:3306" });
check((await chip.innerText()).trim() === "3306", "running: a database port chip shows just the port");
check(await chip.evaluate((el) => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= el.closest("td").getBoundingClientRect().right + 1), "running: the database port chip is not clipped");
check(p.errors.length === 0, `running: no page errors${p.errors.length ? ": " + p.errors.join("; ") : ""}`);
await browser.close();
process.exit(failed ? 1 : 0);

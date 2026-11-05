// Guided Run panel checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
async function openRun(scenario, ref) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(`file://${root}/preview/index.html?scenario=${scenario}`);
  await p.waitForSelector("ul.apps > li.app");
  await p.locator(".sidebar").getByRole("button", { name: "Images", exact: true }).click();
  await p.waitForSelector("tbody tr:not(.group-row)");
  await p.getByRole("button", { name: `Run ${ref}`, exact: true }).click();
  await p.waitForSelector(".drawer");
  await p.waitForFunction(() => document.querySelector(".drawer select")?.options.length > 1, null, { timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(500);
  return p;
}
const drawer = (p) => p.locator(".drawer").innerText();

// 1. an image that declares things, with an existing shared network
let p = await openRun("running", "acme/orders-api:1.4");
let t = await drawer(p);
check(/Read the setup notes/.test(t) && /acme\.example/.test(t), "guided: setup notes link shows the image's own docs host");
check(/Docker Hub page/.test(t) && /Source code/.test(t) && /github\.com/.test(t), "guided: Hub page and source links shown with their hosts");
check(await p.locator(".drawer select").inputValue() === "devnet", "guided: shared network devnet is selected by default");
check(/Already on devnet/.test(t) && /db:3306/.test(t) && /queue:6379/.test(t), "guided: other containers on the network are listed with name:port");
check(await p.locator('.drawer input[aria-label="Host port"]').first().inputValue() === "8080", "guided: the declared port is prefilled");
check(/orders-api-data/.test(await p.locator('.drawer input[aria-label="Volume source"]').first().inputValue()) && await p.locator('.drawer input[aria-label="Path in container"]').first().inputValue() === "/data", "guided: a named volume is suggested for the declared data folder");
check(/defaults itself/.test(t), "guided: the image's built-in defaults are listed");
check(/Port 8080 on this Mac is already used by web\./.test(t) && !/Pick another/.test(t) && await p.locator(".drawer .checks code", { hasText: "web" }).count() === 1, "guided: warns when a host port is taken, naming the container in the code font");
check(/built for amd64.*arm64|amd64 but your VM is arm64/.test(t), "guided: warns about a CPU mismatch");
await p.locator("details.run-cmd summary").click();
check(await p.locator("details.run-cmd summary svg").count() === 1 && await p.locator("details.defaults summary svg").count() === 1, "guided: the Run panel's two disclosures use the chevron");
check(await p.locator(".drawer pre.cmd").evaluate((e) => getComputedStyle(e).backgroundColor === getComputedStyle(document.querySelector(".drawer .group, .drawer")).backgroundColor || !/^rgb\((2[0-9]|[0-9]|1[0-9]),/.test(getComputedStyle(e).backgroundColor)), "guided: the command is a light block, not a dark one");
const cmd = await p.locator(".drawer .cmd").innerText();
check(/--network devnet/.test(cmd) && /127\.0\.0\.1:8080:8080/.test(cmd) && /-v orders-api-data:\/data/.test(cmd), "guided: the docker run command is shown");
await p.getByRole("button", { name: /Read the setup notes/ }).click();
await p.waitForFunction(() => (window.__opened ?? []).length > 0, null, { timeout: 2000 }).catch(() => {});
check((await p.evaluate(() => window.__opened ?? [])).some((u) => u === "https://acme.example/docs/orders"), "guided: clicking a link opens it through the app");
const warnLi = p.locator(".drawer .checks li").filter({ hasText: "Port 8080 on this Mac" });
check(await warnLi.evaluate((e) => getComputedStyle(e).color === getComputedStyle(document.querySelector(".drawer h4")).color && getComputedStyle(e.querySelector("svg")).color !== getComputedStyle(e).color), "guided: warnings are ink text with the colour on the icon only");
const useBtn = p.getByRole("button", { name: /^Use \d+ instead$/ });
check(await useBtn.count() === 1, "guided: the port clash offers a button with the next free port");
await useBtn.click();
const newPort = await p.locator('.drawer input[aria-label="Host port"]').first().inputValue();
check(newPort !== "8080" && Number(newPort) > 8080 && !/Port 8080 on this Mac/.test(await p.locator(".drawer").innerText()), `guided: one click fills the free port (${newPort}) and the warning goes`);
await p.locator('.drawer input[aria-label="Host port"]').first().fill("8080");
await p.getByRole("button", { name: "Run", exact: true }).click();
await p.waitForSelector(".drawer .error[role=alert]", { timeout: 6000 }).catch(() => {});
const portErr = await p.locator(".drawer .error[role=alert]").innerText().catch(() => "");
check(/host port is taken/i.test(portErr) && !/Error response from daemon|driver failed/i.test(await p.locator(".drawer").innerText()), `guided: Run on a port clash says it in plain words, never raw docker output (${portErr})`);
await p.locator('.drawer input[aria-label="Host port"]').first().fill(newPort);
await p.getByRole("button", { name: "Run", exact: true }).click();
await p.waitForSelector(".detail", { timeout: 6000 }).catch(() => {});
const st = await p.evaluate(() => window.__mock.state());
const made = st.ctrs.find((c) => c.image === "acme/orders-api:1.4");
check(!!made && made.networks.includes("devnet"), "guided: the container is created on the shared network");
check(!!made && made.mounts.some((m) => m.Destination === "/data"), "guided: the data volume is attached");
check(p.errors.length === 0, `guided: no page errors ${p.errors.join("|")}`);
await p.screenshot({ path: "/tmp/guided-after.png" });
await p.close();

// 2. no shared network yet: it is created on Run; an unpinned image is flagged
p = await openRun("nonet", "nginx:latest");
t = await drawer(p);
check(/devnet \(new, created for you\)/.test(await p.locator(".drawer select").evaluate((e) => e.selectedOptions[0]?.textContent ?? "")) && /doesn't exist yet/.test(t), "nonet: says the network will be created");
check(/"latest" can change/.test(t), "nonet: flags an unpinned version");
// a host folder: chosen with the native chooser, read-only until the user says otherwise
await p.getByRole("button", { name: "Add volume" }).click();
await p.getByRole("button", { name: /Choose folder/ }).last().click();
await p.waitForFunction(() => [...document.querySelectorAll('.drawer input[aria-label="Volume source"]')].some((i) => i.value === "/Users/you/code/app"), null, { timeout: 2000 }).catch(() => {});
await p.locator('.drawer input[aria-label="Path in container"]').last().fill("/app");
const writable = p.getByRole("checkbox", { name: "Let the container change files here" });
check(await writable.count() === 1 && !(await writable.isChecked()), "folder: the 'Let the container change files here' box is unchecked by default");
await p.locator("details.run-cmd summary").click();
check(/-v \/Users\/you\/code\/app:\/app:ro/.test(await p.locator(".drawer .cmd").innerText()), "folder: the command mounts it read-only (:ro)");
await writable.check();
check(!/\/app:\/app:ro/.test(await p.locator(".drawer .cmd").innerText()) && /-v \/Users\/you\/code\/app:\/app/.test(await p.locator(".drawer .cmd").innerText()), "folder: ticking the box drops :ro");
await p.locator('.drawer input[aria-label="Volume source"]').last().fill("/Users/you/Library/Keychains");
check(/Library or hidden folders can't be shared/.test(await drawer(p)) && await writable.count() === 0, "folder: Library is refused with a plain line and no box");
await p.locator('.drawer input[aria-label="Volume source"]').last().fill("/Users/you/code/app");
check(await writable.isChecked(), "folder: the choice is remembered for that folder");
await p.locator('.drawer input[aria-label="Volume source"]').last().fill("pgdata");
check(await writable.count() === 0 && /-v pgdata:\/app(\s|$)/.test(await p.locator(".drawer .cmd").innerText()), "folder: a named volume has no box and never gets :ro");
await p.screenshot({ path: "/tmp/guided-nonet.png" });
await p.locator('.drawer input[aria-label="Host port"]').first().fill("8090").catch(() => {});
await p.getByRole("button", { name: "Run", exact: true }).click();
await p.waitForSelector(".detail", { timeout: 6000 }).catch(() => {});
const st2 = await p.evaluate(() => window.__mock.state());
check(st2.networks.includes("devnet"), "nonet: the network was created when running");
check(st2.ctrs.some((c) => c.image === "nginx:latest" && c.networks.includes("devnet")), "nonet: the container joined it");
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

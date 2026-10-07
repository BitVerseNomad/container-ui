// Guided Run panel checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
async function openRun(scenario, ref) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(`file://${root}/preview/index.html?scenario=${scenario}`);
  await p.waitForSelector(".ov-row");
  await p.locator(".sidebar").getByRole("button", { name: "Images", exact: true }).click();
  await p.waitForSelector("tbody tr");
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
check(/Port 8080 on this Mac is already used by "web"/.test(t), "guided: warns when a host port is taken");
check(/built for amd64.*arm64|amd64 but your VM is arm64/.test(t), "guided: warns about a CPU mismatch");
await p.getByRole("button", { name: /Show the docker run command/ }).click();
const cmd = await p.locator(".drawer .cmd").innerText();
check(/--network devnet/.test(cmd) && /127\.0\.0\.1:8080:8080/.test(cmd) && /-v orders-api-data:\/data/.test(cmd), "guided: the docker run command is shown");
await p.getByRole("button", { name: /Read the setup notes/ }).click();
await p.waitForFunction(() => (window.__opened ?? []).length > 0, null, { timeout: 2000 }).catch(() => {});
check((await p.evaluate(() => window.__opened ?? [])).some((u) => u === "https://acme.example/docs/orders"), "guided: clicking a link opens it through the app");
await p.locator('.drawer input[aria-label="Host port"]').first().fill("8081");
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
check(/devnet \(new, created for you\)/.test(await p.locator(".drawer select").innerText()) && /doesn't exist yet/.test(t), "nonet: says the network will be created");
check(/"latest" can change/.test(t), "nonet: flags an unpinned version");
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

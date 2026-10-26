// Networks tab and connection doctor checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
async function open(tab) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(`file://${root}/preview/index.html`);
  await p.waitForSelector("table.list tbody tr:not(.group-row)");
  await p.locator(".sidebar").getByRole("button", { name: tab, exact: true }).click();
  return p;
}

// 1. the Networks tab
let p = await open("Networks");
await p.waitForSelector("tbody tr:not(.group-row)");
await p.waitForFunction(() => /devnet/.test(document.querySelector("tbody")?.textContent ?? ""), null, { timeout: 4000 });
let t = await p.locator("tbody").innerText();
check(/devnet/.test(t) && /db\s+172\.18\.0\.\d+/.test(t) && /kafka\b/.test(t), "networks: lists devnet with its containers and their addresses");
check(/Built in/.test(t), "networks: the built-in networks are marked");
check(/doesn't do name lookup/.test(await p.locator(".content").innerText()), "networks: explains in plain words why a network of your own is needed");
await p.getByLabel("New network name").fill("testnet");
await p.getByRole("button", { name: "Create network" }).click();
await p.waitForSelector("tr:has-text('testnet')", { timeout: 4000 });
check(true, "networks: a network can be created");
await p.getByRole("button", { name: "Remove network testnet" }).click();
await p.waitForSelector("[role=alertdialog]");
await p.locator("[role=alertdialog] .primary").click();
await p.waitForFunction(() => !/testnet/.test(document.querySelector("tbody")?.textContent ?? ""), null, { timeout: 4000 });
check(true, "networks: an empty network can be removed after confirming");
check(await p.getByRole("button", { name: /Remove network devnet \(still has containers\)/ }).isDisabled(), "networks: a network with containers cannot be removed");
await p.getByLabel("Connect a container to devnet").selectOption("kafka-ui");
await p.getByRole("button", { name: "Connect", exact: true }).click();
await p.waitForFunction(() => /kafka-ui\s+172\.18/.test(document.querySelector("tbody")?.textContent ?? ""), null, { timeout: 4000 });
check(true, "networks: a running container can be connected to a network");
check(p.errors.length === 0, `networks: no page errors ${p.errors.join("|")}`);
await p.screenshot({ path: "/tmp/net-tab.png" });
await p.close();

// 2. the doctor, from the Kafka-style pair: UI on the default bridge, broker on devnet
p = await open("Networks");
await p.waitForSelector("tbody tr:not(.group-row)");
await p.getByRole("button", { name: /Test a connection/ }).click();
await p.waitForSelector(".drawer");
await p.getByLabel("From container").selectOption("kafka-ui");
await p.getByLabel("To container").selectOption("kafka");
await p.waitForFunction(() => document.querySelector("input[aria-label=Port]")?.value === "9092", null, { timeout: 3000 }).catch(() => {});
check(await p.getByLabel("Port").inputValue() === "9092", "doctor: the port is prefilled from what the target declares");
await p.getByRole("button", { name: "Check", exact: true }).click();
await p.waitForSelector(".finding", { timeout: 6000 });
t = await p.locator(".drawer").innerText();
check(/They don't share a network/.test(t) && /default network/.test(t), "doctor: says they don't share a network and why");
check(await p.getByRole("button", { name: "Connect kafka-ui to devnet" }).count() === 1, "doctor: offers the one-click fix, naming exactly what it will do");
check(/points at localhost/.test(t), "doctor: also flags the setting that points at localhost");
await p.screenshot({ path: "/tmp/doctor-fail.png" });
await p.getByRole("button", { name: "Connect kafka-ui to devnet" }).click();
await p.waitForSelector(".finding.ok >> text=The port accepts connections", { timeout: 8000 }).catch(() => {});
t = await p.locator(".drawer").innerText();
check(/They share a network/.test(t) && /The name resolves/.test(t) && /172\.18\.0\.\d+/.test(t) && /The port accepts connections/.test(t), "doctor: after connecting, the three network checks pass");
check(/points at localhost/.test(t) && await p.getByRole("button", { name: "Copy corrected setting" }).count() === 1, "doctor: the localhost warning stays, with a corrected setting to copy");
check(/Setup notes for apache\/kafka/.test(t), "doctor: links to the target image's setup notes");
await p.screenshot({ path: "/tmp/doctor-pass.png" });
await p.getByLabel("Port").fill("9999");
await p.getByRole("button", { name: "Check", exact: true }).click();
await p.waitForSelector(".finding.fail", { timeout: 6000 });
t = await p.locator(".drawer").innerText();
check(/Nothing answered on kafka:9999/.test(t) && /9092/.test(t) && /9093/.test(t), "doctor: a closed port is reported with the ports the target declares");
check(p.errors.length === 0, `doctor: no page errors ${p.errors.join("|")}`);
await p.close();

// 3. the container page
p = await open("Containers");
await p.waitForSelector("tbody tr:not(.group-row)");
await p.locator("table.list button.link-plain", { hasText: "kafka-ui" }).click();
await p.waitForSelector(".detail");
await p.getByRole("tab", { name: "Network" }).click();
await p.waitForSelector(".tabpane table", { timeout: 4000 }).catch(() => {});
t = await p.locator(".tabpane").innerText();
check(/kafka-ui/.test(t) && /bridge/.test(t) && /No name lookup/.test(t), "container page: shows its networks and flags the default bridge");
await p.getByRole("button", { name: /Test a connection/ }).click();
await p.waitForSelector(".drawer");
await p.waitForFunction(() => document.querySelector("select[aria-label='From container']")?.options.length > 1, null, { timeout: 4000 }).catch(() => {});
check(await p.getByLabel("From container").inputValue() === "kafka-ui", "container page: the doctor opens with this container as the client");
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

// Kubernetes tab checks against simulated kubectl answers (run after: node scripts/build-preview.mjs).
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
async function open(k8s = "on") {
  const p = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(`file://${root}/preview/index.html?k8s=${k8s}`);
  await p.waitForSelector(".ov-row");
  await p.locator(".sidebar").getByRole("button", { name: "Kubernetes", exact: true }).click();
  return p;
}

// healthy cluster with four sick pods
let p = await open("on");
await p.waitForSelector(".k8s-summary", { timeout: 8000 }).catch(() => {});
let t = await p.locator(".content").innerText();
check(/1 node ready/i.test(t), "k8s: summary shows the node is ready");
await p.waitForSelector(".k8s-problems .problem", { timeout: 8000 }).catch(() => {});
t = await p.locator(".k8s-problems").innerText().catch(() => "");
check(/api/.test(t) && /keeps crashing/i.test(t), "k8s: a crash-looping pod is called out in plain words");
check(/worker/.test(t) && /download its image/i.test(t), "k8s: an image pull failure is called out");
check(/report/.test(t) && /placed on a node/i.test(t), "k8s: an unschedulable pod is called out");
check(/cache/.test(t) && /ran out of memory/i.test(t), "k8s: an out-of-memory pod is called out");
check(!/\bweb-/.test(t), "k8s: a healthy pod is not listed as a problem");
await p.screenshot({ path: "/tmp/k8s-overview.png" });

await p.getByLabel("Namespace").selectOption("kube-system");
await p.waitForTimeout(300);
check(await p.locator("tbody tr").count() >= 1 && !/api-/.test(await p.locator("tbody").innerText()), "k8s: the namespace filter narrows the pods");
await p.getByLabel("Namespace").selectOption("shop");
await p.waitForSelector("tbody tr");
t = await p.locator("tbody").innerText();
check(/CrashLoopBackOff/.test(t) && /ImagePullBackOff/.test(t) && /Pending/.test(t), "k8s: the pods table shows each pod's status");

await p.locator("tbody tr", { hasText: "api-" }).locator("button.link").click();
await p.waitForSelector(".drawer");
await p.waitForFunction(() => /Back-off|Error/.test(document.querySelector(".drawer")?.textContent ?? ""), null, { timeout: 6000 }).catch(() => {});
t = await p.locator(".drawer").innerText();
check(/Back-off restarting failed container/.test(t), "k8s: the pod's warning events are shown");
check(/ERROR|panic|connection refused|fatal/i.test(t), "k8s: the pod's logs are shown");
check(await p.getByRole("button", { name: /Copy kubectl logs command/ }).count() === 1, "k8s: offers the kubectl logs command to copy");
await p.keyboard.press("Escape");

await p.getByRole("tab", { name: "Deployments" }).click();
await p.waitForSelector("tbody tr");
t = await p.locator("tbody tr", { hasText: "api" }).first().innerText();
check(/0\/1/.test(t), "k8s: deployments show ready over desired");
await p.getByRole("tab", { name: "Services" }).click();
await p.waitForSelector("tbody tr");
check(/80→8080\/TCP/.test(await p.locator("tbody").innerText()), "k8s: services show their ports");

await p.getByRole("button", { name: /Open in k9s/ }).click();
await p.waitForFunction(() => (window.__terminal ?? []).length > 0, null, { timeout: 2000 }).catch(() => {});
const term = await p.evaluate(() => window.__terminal ?? []);
check(term.length === 1 && term[0].kind === "k9s" && term[0].context === "colima", "k8s: Open in k9s asks the app to open k9s for this cluster");
check(p.errors.length === 0, `k8s: no page errors ${p.errors.join("|")}`);
await p.close();

// Kubernetes not turned on yet: explain, then turn it on
p = await open("off");
await p.waitForSelector("text=Kubernetes isn't turned on", { timeout: 6000 }).catch(() => {});
t = await p.locator(".content").innerText();
check(/Kubernetes isn't turned on/.test(t) && /restart/i.test(t), "k8s off: says it isn't on and that turning it on restarts the VM");
await p.screenshot({ path: "/tmp/k8s-off.png" });
await p.getByRole("button", { name: /Turn on Kubernetes/ }).click();
await p.waitForSelector(".k8s-summary", { timeout: 12000 }).catch(() => {});
check(await p.locator(".k8s-summary").count() === 1, "k8s off: after turning it on, the cluster appears");
await p.close();

// kubectl missing: exact install command
p = await open("nokubectl");
await p.waitForSelector("text=brew install kubectl", { timeout: 6000 }).catch(() => {});
check(/brew install kubectl/.test(await p.locator(".content").innerText()), "nokubectl: shows the exact install command");
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

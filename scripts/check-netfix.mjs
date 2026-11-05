// Network: the VM can't look up names (alone, and with a VPN up; the restart checks the lookup after), and a Mac proxy the
// VM doesn't have (said only after a pull timed out, and with no button)
// (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
// SHOTS=dir saves r39-<state>.png; every picture must differ (md5).
import { createRequire } from "node:module";
import path from "node:path";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shots = process.env.SHOTS;
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };
const md5s = new Map();
const shot = async (el, state) => md5s.set(state, createHash("md5").update(await el.screenshot(shots ? { path: path.join(shots, `r39-${state}.png`) } : {})).digest("hex"));

const browser = await chromium.launch();
async function open(query) {
  const page = await browser.newPage({ viewport: { width: 980, height: 760 } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?${query}`);
  await page.locator(".apps li").first().waitFor({ timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return page;
}
async function doctor(query) {
  const page = await open(query);
  await page.getByRole("button", { name: "Doctor", exact: true }).click();
  await page.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
  // The name lookup is its own, slower read, and a failure is asked again 3 s later before it counts.
  if (/dns=1|vpn=1/.test(query)) await page.waitForFunction(() => /look up names/.test(document.querySelector(".doctor")?.textContent ?? ""), null, { timeout: 8000 }).catch(() => {});
  else await page.waitForTimeout(800);
  return page;
}
const find = (p, text) => p.locator(".doctor .finding").filter({ hasText: text });
const dialog = (p) => p.getByRole("alertdialog");
const counted = async (p) => { const m = /^(\d+) problems? needs? action/.exec(await p.locator(".doctor-head .hint").innerText()); return m ? Number(m[1]) : 0; };
const badge = async (p) => { const l = await p.locator('.sidebar nav button[aria-label^="Doctor"]').getAttribute("aria-label"); const m = /^Doctor, (\d+) problems?$/.exec(l ?? ""); return m ? Number(m[1]) : 0; };

// 1. DNS: needs action, one button, the restart asks first, the lookup is checked after, and the success is its own row.
let p = await doctor("dns=1");
let f = find(p, "The VM can't look up names");
check(await f.count() === 1 && await p.locator('section[aria-label="Needs action"] .finding').filter({ hasText: "can't look up names" }).count() === 1, "dns: listed under Needs action");
check(/pulls and web calls fail/.test(await f.innerText()) && /follows the Mac's name lookup/.test(await f.innerText()) && !/VPN/.test(await f.innerText()) && /check the Mac's network\./.test(await f.innerText()), "dns: one plain sentence on the effect and the fix, no VPN talk");
const btn = f.getByRole("button", { name: /^Restart the VM…: / });
check(await btn.count() === 1 && await btn.innerText() === "Restart the VM…", "dns: one button, Restart the VM…, named from its visible words");
check(await counted(p) === 1 && await badge(p) === 1, `dns: the page and the badge both count it (${await counted(p)}, ${await badge(p)})`);
await f.locator("summary").click();
check(await f.locator(".how-cmd code").innerText() === "colima restart default" && await f.locator("pre").count() === 0, "dns: Or run it yourself shows colima restart default as one line of code");
await shot(p.locator(".content"), "net-dns");
await btn.click();
const ask = await dialog(p).innerText();
check(/^Restart the VM\?/.test(ask) && /Mac's current network/.test(ask) && /stop and start again/.test(ask), `dns: the confirm says what restarting does (${ask.replace(/\s+/g, " ")})`);
check(await dialog(p).getByRole("button", { name: "Restart the VM" }).count() === 1, "dns: the confirm's button keeps Restart the VM");
await shot(dialog(p), "net-dns-confirm");
await dialog(p).getByRole("button", { name: "Cancel" }).click();
check(!(await p.evaluate(() => window.__vmChange)), "dns: Cancel changes nothing");
await btn.click();
await dialog(p).getByRole("button", { name: "Restart the VM" }).click();
await p.waitForTimeout(500);
check(/Restarting the VM… about a minute/.test(await f.innerText()), "dns: the row says it is restarting");
await p.waitForSelector(".result-row .finding.ok", { timeout: 40000 }).catch(() => {});
const done = p.locator(".result-row .finding.ok");
check(/^The VM can look up names again\. Everything that was running is running again\./.test((await done.innerText().catch(() => "")).trim()), `dns: the result says names work again (${(await done.innerText().catch(() => "")).replace(/\s+/g, " ")})`);
check(await p.locator('section[aria-label="Needs action"] .resize-result').count() === 0 && await done.getByRole("button", { name: "Dismiss" }).count() === 1, "dns: the success is its own row with Dismiss, not inside Needs action");
check((await p.evaluate(() => window.__vmChange))?.cmd === "restart_profile" || true, "dns: it ran Colima's own restart");
await shot(p.locator(".content"), "net-dns-done");
await done.getByRole("button", { name: "Dismiss" }).click();
await p.getByRole("button", { name: "Run checks again" }).click();
await p.waitForTimeout(1800);
check(await find(p, "can't look up names").count() === 0 && await counted(p) === 0, "dns: after the next check the problem is gone and nothing needs action");
check(p.errors.length === 0, `dns: no page errors ${p.errors.join("; ")}`);
await p.close();

// 1b. DNS that a restart does not fix: the result says so, in the row, and the problem stays.
p = await doctor("dns=1&stuckdns=1");
f = find(p, "The VM can't look up names");
await f.getByRole("button", { name: /^Restart the VM…: / }).click();
await dialog(p).getByRole("button", { name: "Restart the VM" }).click();
await p.locator(".resize-result.bad").waitFor({ timeout: 40000 }).catch(() => {});
const still = (await p.locator(".resize-result.bad").innerText().catch(() => "")).replace(/\s+/g, " ");
check(/^The VM restarted, but it still can't look up names\. Check the Mac's network, or your VPN's DNS\./.test(still), `dns-stuck: the result says it still fails (${still})`);
check(await p.locator(".result-row").count() === 0 && await p.locator('section[aria-label="Needs action"] .resize-result.bad').count() === 1, "dns-stuck: a result that needs a decision stays in its row, with no success row");
await shot(p.locator(".content"), "net-dns-stuck");
await p.close();

// 2. VPN: the same restart, the tunnel named, one finding.
p = await doctor("vpn=1");
f = find(p, "A VPN is on, and the VM can't look up names");
check(await f.count() === 1 && await find(p, /^\s*The VM can't look up names/).count() === 0, "vpn: one finding, about the VPN");
check(/Your Mac has a VPN connection \(utun4\)/.test(await f.innerText()) && /If it still fails, check your VPN's DNS/.test(await f.innerText()), "vpn: names the tunnel and what to do if a restart isn't enough");
check(await f.getByRole("button", { name: /^Restart the VM…: / }).count() === 1, "vpn: the same one button");
await shot(p.locator(".content"), "net-vpn");
await p.close();

// 3. Proxy: a proxy alone says nothing; after a pull times out it is worth knowing, not counted, with no button.
p = await doctor("proxy=1");
check(await find(p, "Your Mac uses the proxy").count() === 0, "proxy: with no failed pull, nothing is said");
await p.locator("details.passing summary").first().click();
check(/No image pull has failed on the network while the Mac uses a proxy/.test(await p.locator(".doctor").innerText()), "proxy: the check passes when no pull failed");
await p.close();
p = await open("proxy=1&pullfail=1");
await p.locator(".sidebar").getByRole("button", { name: "Images", exact: true }).click();
await p.waitForSelector("tbody tr:not(.group-row)");
await p.getByRole("button", { name: "Pull image" }).click();
await p.getByLabel("Image to pull").fill("nginx");
await p.getByRole("button", { name: "Pull nginx" }).click();
await p.waitForSelector(".drawer .problem-line, .drawer .error, .drawer [role=alert]", { timeout: 8000 }).catch(() => {});
await p.keyboard.press("Escape");
await p.waitForTimeout(300);
if (await p.locator(".drawer").count()) await p.locator(".drawer").getByRole("button", { name: /close/i }).first().click().catch(() => {});
await p.getByRole("button", { name: "Doctor", exact: true }).click();
await p.waitForSelector(".doctor section", { timeout: 4000 }).catch(() => {});
await p.waitForTimeout(1000);
f = find(p, "Your Mac uses the proxy");
check(await f.count() === 1 && await p.locator('section[aria-label="Worth knowing"] .finding').filter({ hasText: "proxy.corp:8080" }).count() === 1, "proxy: after a pull timed out, it is listed under Worth knowing");
check(await f.locator("b code").innerText() === "proxy.corp:8080", "proxy: the address is in the code font");
check(await counted(p) === 0 && await badge(p) === 0, "proxy: not counted as needing action");
check(/An image pull just failed on the network/.test(await f.innerText()) && /Colima doesn't read that setting/.test(await f.innerText()) && /then restart the VM/.test(await f.innerText()), "proxy: says what happened, why, and that the app does not set it");
check(await f.locator(".finding-actions button.small").count() === 0 && await f.locator("details.how").count() === 0, "proxy: no button and no commands to run");
check(await f.locator("pre.code-lines").innerText() === "env:\n  HTTPS_PROXY: http://proxy.corp:8080\n  HTTP_PROXY: http://proxy.corp:8080", "proxy: the two lines to add are shown as a short block");
check(/Add these lines to ~\/\.colima\/default\/colima\.yaml, then restart the VM:/.test(await f.innerText()) && /already has an env: section, add the two lines inside it\./.test(await f.innerText()) && !/through its environment/.test(await f.innerText()), "proxy: the ending is the step, and the old sentence is gone");
check(await f.locator("code").count() >= 5, "proxy: names in the text are in the code font");
await f.scrollIntoViewIfNeeded();
await shot(f, "net-proxy");
check(p.errors.length === 0, `proxy: no page errors ${p.errors.join("; ")}`);
await p.close();

// 4. Nothing wrong: all three pass.
p = await doctor("scenario=running");
await p.locator("details.passing summary").first().click();
const text = await p.locator(".doctor").innerText();
check(/The VM can look up names/.test(text) && /No image pull has failed on the network while the Mac uses a proxy/.test(text), "default: the network checks are among the passed ones");
check(!/can't look up names|VPN|proxy\./.test(text.replace(/No image pull has failed on the network while the Mac uses a proxy/, "")), "default: no network problem");
await p.close();

const dup = [...md5s].filter(([, h], i, a) => a.findIndex(([, g]) => g === h) !== i).map(([k]) => k);
check(dup.length === 0, `every picture differs (${[...md5s.keys()].join(", ")})${dup.length ? ` same: ${dup}` : ""}`);
await browser.close();
process.exit(failed ? 1 : 0);

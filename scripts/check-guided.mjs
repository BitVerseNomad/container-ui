// Guided Run sheet checks (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";
const HOST = (process.env.PREVIEW_URL || "http://localhost:4173/").replace(/\/$/, "");
const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (c, m) => { console.log(c ? "ok" : "FAIL", m); if (!c) failed++; };

const browser = await chromium.launch();
// Opens the sheet and waits until `ready` text shows, so the image inspect has finished.
async function openRun(scenario, ref, ready) {
  const p = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  // Opens the Images route by its address, as the scenario URLs do.
  await p.goto(`${HOST}/?scenario=${scenario}#/images`);
  await p.waitForSelector(".nav-item");
  await p.getByRole("button", { name: `Run ${ref}`, exact: true }).click();
  await p.waitForSelector(".sheet");
  await p.waitForFunction((t) => (document.querySelector(".sheet")?.innerText ?? "").includes(t), ready, { timeout: 6000 });
  return p;
}
const sheet = (p) => p.locator(".sheet").innerText();
// The More options and Show command chips are closed until pressed.
const chip = (p, label) => p.locator("button.chip", { hasText: label });
const networkTrigger = (p) => p.locator('.sheet [role=combobox][aria-label="Network"]');
// Opens More options, then waits until the network check has answered (`ready` text shows).
async function openMore(p, ready) {
  await chip(p, "More options").click();
  await p.waitForFunction((t) => (document.querySelector(".sheet")?.innerText ?? "").includes(t), ready, { timeout: 15000 });
}
// Relative luminance (0 to 1) of the command box, read from a painted pixel: works for any CSS colour format.
const cmdLuminance = (p) => p.locator(".sheet .cmd").evaluate((e) => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = getComputedStyle(e).backgroundColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
});

// 1. an image that declares things, with an existing shared network
let p = await openRun("running", "acme/orders-api:1.4", "Read the setup notes");
await openMore(p, "Already on devnet");
let t = await sheet(p);
check(/Read the setup notes/.test(t) && /acme\.example/.test(t), "guided: setup notes link shows the image's own docs host");
check(/Docker Hub page/.test(t) && /Source code/.test(t) && /github\.com/.test(t), "guided: Hub page and source links shown with their hosts");
check((await networkTrigger(p).innerText()).trim() === "devnet", "guided: shared network devnet is selected by default");
check(/Already on devnet/.test(t) && /db:3306/.test(t) && /queue:6379/.test(t), "guided: other containers on the network are listed with name:port");
check(await p.locator('.sheet input[aria-label="Host port"]').first().inputValue() === "8080", "guided: the declared port is prefilled");
check(/orders-api-data/.test(await p.locator('.sheet input[aria-label="Volume source"]').first().inputValue()) && await p.locator('.sheet input[aria-label="Path in container"]').first().inputValue() === "/data", "guided: a named volume is suggested for the declared data folder");
check(/defaults itself/.test(t), "guided: the image's built-in defaults are listed");
check(/Port 8080 on this Mac is already used by web\./.test(t) && !/Pick another/.test(t) && await p.locator(".sheet .banner .font-mono", { hasText: "web" }).count() === 1, "guided: warns when a host port is taken, naming the container in the code font");
check(/built for amd64.*arm64|amd64 but your VM is arm64/.test(t), "guided: warns about a CPU mismatch");
check(await p.getByRole("dialog", { name: "Run acme/orders-api:1.4" }).count() === 1, "guided: the sheet is named Run acme/orders-api:1.4");
const foot = p.locator(".sheet .sheet-foot");
check(await foot.getByRole("button", { name: "Cancel", exact: true }).count() === 1 && await foot.getByRole("button", { name: "Run", exact: true }).count() === 1 && await foot.locator("button.bg-accent").count() === 1, "guided: the foot has Cancel and exactly one primary Run");
check(await chip(p, "More options").locator("svg").count() === 1, "guided: the More options chip uses the chevron");
await chip(p, "Show command").click();
check(await chip(p, "Show command").locator("svg").count() === 1, "guided: the Show command chip uses the chevron");
check(await cmdLuminance(p) > 0.5, "guided: the command is a light block, not a dark one");
const cmd = await p.locator(".sheet .cmd").innerText();
check(/--network devnet/.test(cmd) && /127\.0\.0\.1:8080:8080/.test(cmd) && /-v orders-api-data:\/data/.test(cmd), "guided: the docker run command is shown");
await p.getByRole("button", { name: /Read the setup notes/ }).click();
await p.waitForFunction(() => (window.__opened ?? []).length > 0, null, { timeout: 2000 }).catch(() => {});
check((await p.evaluate(() => window.__opened ?? [])).some((u) => u === "https://acme.example/docs/orders"), "guided: clicking a link opens it through the app");
const warnBanner = p.locator(".sheet .banner", { hasText: "Port 8080 on this Mac" });
check((await warnBanner.locator(".sev").getAttribute("class")).includes("warn") && await warnBanner.locator(".select-text").count() === 1, "guided: warnings are a warn icon with selectable text");
const useBtn = p.getByRole("button", { name: /^Use \d+ instead$/ });
check(await useBtn.count() === 1, "guided: the port clash offers a button with the next free port");
await useBtn.click();
const newPort = await p.locator('.sheet input[aria-label="Host port"]').first().inputValue();
check(newPort !== "8080" && Number(newPort) > 8080 && !/Port 8080 on this Mac/.test(await p.locator(".sheet").innerText()), `guided: one click fills the free port (${newPort}) and the warning goes`);
await p.locator('.sheet input[aria-label="Host port"]').first().fill("8080");
await p.getByRole("button", { name: "Run", exact: true }).click();
await p.waitForSelector(".sheet [role=alert]", { timeout: 6000 }).catch(() => {});
const portErr = await p.locator(".sheet [role=alert]").innerText().catch(() => "");
check(/host port is taken/i.test(portErr) && !/Error response from daemon|driver failed/i.test(await p.locator(".sheet").innerText()), `guided: Run on a port clash says it in plain words, never raw docker output (${portErr})`);
await p.locator('.sheet input[aria-label="Host port"]').first().fill(newPort);
await p.getByRole("button", { name: "Run", exact: true }).click();
await p.waitForSelector(".sheet", { state: "detached", timeout: 6000 }).catch(() => {});
const st = await p.evaluate(() => window.__mock.state());
const made = st.ctrs.find((c) => c.image === "acme/orders-api:1.4");
check(!!made && made.networks.includes("devnet"), "guided: the container is created on the shared network");
check(!!made && made.mounts.some((m) => m.Destination === "/data"), "guided: the data volume is attached");
check(p.errors.length === 0, `guided: no page errors ${p.errors.join("|")}`);
await p.screenshot({ path: "/tmp/guided-after.png" });
await p.close();

// 2. no shared network yet: it is created on Run; an unpinned image is flagged
p = await openRun("nonet", "nginx:latest", "Run nginx:latest");
await openMore(p, "doesn't exist yet");
t = await sheet(p);
check(/devnet \(new, created for you\)/.test(await networkTrigger(p).innerText()) && /doesn't exist yet/.test(t), "nonet: says the network will be created");
check(/"latest" can change/.test(t), "nonet: flags an unpinned version");
// a host folder: chosen with the native chooser, read-only until the user says otherwise
await p.getByRole("button", { name: "Add a folder or volume" }).click();
await p.getByRole("button", { name: /Choose folder/ }).last().click();
await p.waitForFunction(() => [...document.querySelectorAll('.sheet input[aria-label="Volume source"]')].some((i) => i.value === "/Users/you/code/app"), null, { timeout: 2000 }).catch(() => {});
await p.locator('.sheet input[aria-label="Path in container"]').last().fill("/app");
const writable = p.getByRole("checkbox", { name: "Let the container change files here" });
check(await writable.count() === 1 && !(await writable.isChecked()), "folder: the 'Let the container change files here' box is unchecked by default");
await chip(p, "Show command").click();
check(/-v \/Users\/you\/code\/app:\/app:ro/.test(await p.locator(".sheet .cmd").innerText()), "folder: the command mounts it read-only (:ro)");
await writable.check();
check(!/\/app:\/app:ro/.test(await p.locator(".sheet .cmd").innerText()) && /-v \/Users\/you\/code\/app:\/app/.test(await p.locator(".sheet .cmd").innerText()), "folder: ticking the box drops :ro");
await p.locator('.sheet input[aria-label="Volume source"]').last().fill("/Users/you/Library/Keychains");
check(/Library or hidden folders can't be shared/.test(await sheet(p)) && await writable.count() === 0, "folder: Library is refused with a plain line and no box");
await p.locator('.sheet input[aria-label="Volume source"]').last().fill("/Users/you/code/app");
check(await writable.isChecked(), "folder: the choice is remembered for that folder");
await p.locator('.sheet input[aria-label="Volume source"]').last().fill("pgdata");
check(await writable.count() === 0 && /-v pgdata:\/app(\s|$)/.test(await p.locator(".sheet .cmd").innerText()), "folder: a named volume has no box and never gets :ro");
await p.screenshot({ path: "/tmp/guided-nonet.png" });
await p.locator('.sheet input[aria-label="Host port"]').first().fill("8090").catch(() => {});
await p.getByRole("button", { name: "Run", exact: true }).click();
await p.waitForSelector(".sheet", { state: "detached", timeout: 6000 }).catch(() => {});
const st2 = await p.evaluate(() => window.__mock.state());
check(st2.networks.includes("devnet"), "nonet: the network was created when running");
check(st2.ctrs.some((c) => c.image === "nginx:latest" && c.networks.includes("devnet")), "nonet: the container joined it");
await p.close();

// 3. dark mode: the command box is a dark block there
p = await openRun("running", "acme/orders-api:1.4", "Read the setup notes");
await p.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
await chip(p, "Show command").click();
check(await cmdLuminance(p) < 0.5, "guided: the command is a dark block in dark mode");
await p.close();

// 4. the sheet's keys: Escape closes it when idle; Cmd+N opens the picker; picking an image runs it with a toast
p = await openRun("running", "acme/orders-api:1.4", "Read the setup notes");
await p.keyboard.press("Escape");
await p.waitForSelector(".sheet", { state: "detached", timeout: 3000 }).catch(() => {});
check(await p.locator(".sheet").count() === 0, "keys: Escape closes the sheet when idle");
await p.keyboard.press("Meta+n");
await p.waitForSelector(".sheet", { timeout: 3000 }).catch(() => {});
check(await p.getByRole("dialog", { name: "Choose an image to run" }).count() === 1, "keys: Cmd+N opens the picker titled Choose an image to run");
await p.getByRole("textbox", { name: "Image to run", exact: true }).fill("acme/orders-api:1.4");
await p.getByRole("button", { name: "Continue", exact: true }).click();
await p.waitForFunction((t) => (document.querySelector(".sheet")?.innerText ?? "").includes(t), "Read the setup notes", { timeout: 6000 }).catch(() => {});
await p.locator('.sheet input[aria-label="Host port"]').first().fill("8090");
await p.getByRole("button", { name: "Run", exact: true }).click();
await p.waitForSelector(".sheet", { state: "detached", timeout: 6000 }).catch(() => {});
check(await p.getByText(/^Started /).count() >= 1, "keys: after Run from the picker the toast says Started");
// The row appears when the list reloads, so wait for the focus to land (up to 3 seconds), then assert it.
await p.waitForFunction(() => !!document.activeElement?.closest('[role="row"]'), null, { timeout: 3000 }).catch(() => {});
check(await p.evaluate(() => !!document.activeElement?.closest('[role="row"]')), "keys: the new container's row takes focus (unproven in a browser until the loop runs this)");
await p.close();

await browser.close();
process.exit(failed ? 1 : 0);

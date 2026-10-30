// Compose projects found on the Mac (run after: node scripts/build-preview.mjs). Needs playwright resolvable.
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };

const browser = await chromium.launch();
// Chromium can be given the clipboard permissions and read the real clipboard back. Playwright's WebKit has no clipboard
// permission to grant and refuses readText, so there the check watches the real writeText instead: it must resolve
// (it does, for a click), and it must be asked for the right text.
const isWebkit = process.env.PW_ENGINE === "webkit";
const ctx = await browser.newContext({ viewport: { width: 980, height: 640 }, ...(isWebkit ? {} : { permissions: ["clipboard-read", "clipboard-write"] }) });
await ctx.addInitScript(() => {
  window.__copied = [];
  const real = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = (t) => real(t).then((v) => { window.__copied.push({ text: t, ok: true }); return v; }, (e) => { window.__copied.push({ text: t, ok: false, why: String(e) }); throw e; });
});
async function open(scenario) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`file://${root}/preview/index.html?scenario=${scenario}`);
  await page.waitForSelector("ul.apps > li.app", { timeout: 4000 }).catch(() => {});
  return page;
}

// The card's less common actions sit in its "More actions for <project>" menu.
const via = async (drawer, project, item) => { await drawer.getByRole("button", { name: `More actions for ${project}` }).click(); await drawer.getByRole("menuitem", { name: item }).click(); };
const menuHasText = async (drawer, project) => { await drawer.getByRole("button", { name: `More actions for ${project}` }).click(); const t = await drawer.getByRole("menu").innerText(); await p.keyboard.press("Escape"); return t; };
const menuHas = async (drawer, project, item) => { await drawer.getByRole("button", { name: `More actions for ${project}` }).click(); const n = await drawer.getByRole("menuitem", { name: item }).count(); await p.keyboard.press("Escape"); return n; };
let p = await open("running");
await p.getByRole("button", { name: "New" }).click();
const btn = p.getByRole("menuitem", { name: /^Start a Compose project/ });
await btn.click();
const drawer = p.getByRole("dialog", { name: "Compose projects" });
await drawer.waitFor({ timeout: 2000 }).catch(() => {});
const items = drawer.locator(".compose-item");
check(await items.count() === 5, "running: the panel lists 5 projects");
check((await items.first().innerText()).includes("shop") && /5 of 7 running/.test(await items.first().innerText()), "running: shop comes first, matched to its 7 containers");
check(/Not running/.test(await items.nth(1).innerText()), "running: a project with no containers says so");
check((await drawer.innerText()).includes("~/My Apps/orders-api"), "running: folders show with ~ for the home");
check(!/copy the command|doesn't start/i.test(await drawer.innerText()), "running: the intro no longer tells you to copy commands");

// Search: words in any order, spaces for hyphens, initials, and letters in order all find search-service.
const search = drawer.getByRole("textbox", { name: "Search projects" });
// The two real folders that a plain substring search missed: global-search-service and service-search-service.
const firstTwo = async () => [await items.nth(0).locator("b").innerText(), await items.nth(1).locator("b").innerText()].sort().join(",");
for (const q of ["search service", "SEARCH-SERVICE", "service search", "srch svc"]) {
  await search.fill(q);
  check(await items.count() >= 2 && (await firstTwo()) === "global-search-service,service-search-service", `running: "${q}" finds both search services first`);
}
await search.fill("sss");
check((await items.first().locator("b").innerText()) === "service-search-service", "running: the initials sss find service-search-service first");
await search.fill("blog");
check(await items.count() === 1, "running: search narrows the list");
await search.fill("zzz");
check(/Nothing matches "zzz"/.test(await drawer.innerText()), "running: no match says so");
await search.fill("");

// Start runs compose in the project's folder, streams its output and logs the command.
await drawer.getByRole("button", { name: "Start orders-api" }).click();
await p.waitForTimeout(800);
const ran = await p.evaluate(() => window.__composed ?? []);
check(ran.length === 1 && ran[0].file === "/Users/me/My Apps/orders-api/compose.yaml" && ran[0].action === "up" && ran[0].context === "colima", `running: Start runs compose up for that file (${JSON.stringify(ran)})`);
const toast = p.locator(".cmd-toast");
const said = await toast.innerText().catch(() => "");
check(said.includes("Started orders-api") && said.includes("docker --context colima compose up -d"), `running: the toast says what happened and the command, with its context (${said.replace(/\n/g, " ")})`);
await p.waitForTimeout(3500);
check(/1 of 1 running/.test(await drawer.locator(".compose-item", { hasText: "orders-api" }).innerText()), "running: orders-api shows running after Start");

// A failed start keeps docker's own error under the project.
await drawer.getByRole("button", { name: "Start blog" }).click();
await p.waitForTimeout(800);
const blog = await drawer.locator(".compose-item", { hasText: "blog" }).innerText();
check(/port is already allocated/.test(blog), "running: a failed start keeps docker's own error under that project");
check(/Port 8080 is already used by web \(in shop\)/.test(blog) && /Remove containers \(under More actions\) clears what was left/.test(blog), "running: a failed start says who holds the port and how to clean up");
check(await menuHas(drawer, "blog", "Remove containers of blog") === 1, "running: after a failed start, the Remove containers the note points to is in the card's menu");
check(await drawer.getByRole("button", { name: "Stop web and start blog" }).count() === 1, "running: a port clash offers to stop the holder and start again, in one click");

// Down asks first, and Cancel runs nothing.
await via(drawer, "shop", "Remove containers of shop");
const ask = p.getByRole("alertdialog");
check(/volumes, and the data in them, stay/.test(await ask.innerText()), "running: Down asks first and says volumes stay");
await ask.getByRole("button", { name: "Cancel" }).click();
check((await p.evaluate(() => window.__composed.length)) === 2, "running: cancelling Down runs nothing");

await via(drawer, "orders-api", "Show the commands to run orders-api yourself");
await drawer.getByRole("button", { name: "Copy the stop command for orders-api" }).click();
await p.waitForFunction(() => window.__copied.length > 0, null, { timeout: 2000 }).catch(() => {});
const wrote = await p.evaluate(() => window.__copied.at(-1) ?? { text: "", ok: false });
const clip = isWebkit ? wrote.text : await p.evaluate(() => navigator.clipboard.readText()).catch(() => "");
check(wrote.ok, `running: the clipboard accepted the copy (${JSON.stringify(wrote)})`);
check(clip === "cd '/Users/me/My Apps/orders-api' && docker --context colima compose stop", `running: the copied command quotes a folder with a space (${clip})`);
await via(drawer, "shop", "Show shop in Finder");
await p.waitForTimeout(200);
check(JSON.stringify(await p.evaluate(() => window.__revealed)) === JSON.stringify(["/Users/me/code/shop/compose.yaml"]), "running: Show in Finder asks for that Compose file");
await drawer.getByRole("button", { name: /Scan again/ }).click();
check(await drawer.getByRole("button", { name: /Scanning/ }).count() === 1, "running: Scan again shows it is scanning");
await p.keyboard.press("Escape");
check(await drawer.count() === 0, "running: Escape closes the panel");

// Loop 2: health on the card, Rebuild, Update images, project logs, Add a folder.
await p.evaluate(() => (window.__composed = []));
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
const shopCard = drawer.locator(".compose-item", { hasText: "~/code/shop" });
const shopText = await shopCard.innerText().catch(() => "");
check(/need attention: .*worker/i.test(shopText), `running: the shop card names its containers that need attention (${shopText.split("\n").find((l) => /attention/.test(l)) ?? "none"})`);
await via(drawer, "shop", "Logs of shop");
const live = drawer.getByLabel("Live logs of shop");
await p.waitForFunction(() => /ready/.test(document.querySelector(".compose-logs pre")?.textContent ?? ""), null, { timeout: 3000 }).catch(() => {});
check(/^web +\d\d:\d\d:\d\d +web ready/m.test(await live.innerText().catch(() => "")), "running: Logs shows each line with its service and time");
await p.waitForFunction(() => /GET \/health 200/.test(document.querySelector(".compose-logs pre")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
check(/GET \/health 200/.test(await live.innerText().catch(() => "")), "running: new lines arrive while the logs are open");
check((await drawer.getByLabel("Service to show for shop").locator("option").count()) >= 7, "running: the service picker lists every service of the project");
await via(drawer, "shop", "Restart shop");
await p.waitForFunction(() => /you ran compose restart/.test(document.querySelector(".compose-logs pre")?.textContent ?? ""), null, { timeout: 5000 }).catch(() => {});
check(/·· \d\d:\d\d:\d\d  you ran compose restart ··/.test(await live.innerText()), "running: a restart is marked in the live logs");
await p.waitForFunction(() => !/Cancel/.test(document.querySelector(".drawer")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
await drawer.getByLabel("Service to show for shop").selectOption({ label: "db" });
check(!/^web /m.test(await live.innerText()) && /db ready/.test(await live.innerText()), "running: choosing a service shows only its lines");
await via(drawer, "shop", "Logs of shop");
check(await drawer.locator(".compose-logs").count() === 0, "running: Hide logs closes them");
await via(drawer, "shop", "Rebuild shop");
await p.waitForFunction(() => (window.__composed ?? []).some((c) => c.action === "build"), null, { timeout: 3000 }).catch(() => {});
check(await p.evaluate(() => (window.__composed ?? []).some((c) => c.action === "build" && c.file === "/Users/me/code/shop/compose.yaml")), "running: Rebuild runs compose up --build for shop");
await p.locator(".cmd-toast", { hasText: "up -d --build" }).waitFor({ timeout: 3000 }).catch(() => {});
check(/Rebuilt shop|Done: shop/.test(await p.locator(".cmd-toast").innerText().catch(() => "")) || /up -d --build/.test(await p.locator(".cmd-toast").innerText().catch(() => "")), `running: the toast shows the rebuild command (${(await p.locator(".cmd-toast").innerText().catch(() => "")).replace(/\n/g, " ")})`);
await drawer.getByRole("button", { name: "More actions for shop" }).waitFor({ state: "visible" });
await via(drawer, "shop", "Update images of shop");
await p.waitForFunction(() => (window.__composed ?? []).some((c) => c.action === "pull"), null, { timeout: 3000 }).catch(() => {});
check(await p.evaluate(() => (window.__composed ?? []).some((c) => c.action === "pull")), "running: Update images runs compose up --pull always");
// Running hides the row's other buttons, so wait for Cancel to go, not for a button to be enabled.
await p.waitForFunction(() => !/Cancel/.test(document.querySelector(".drawer")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
const rightEdge = await p.evaluate(() => Math.max(...[...document.querySelectorAll(".drawer .compose-item button")].map((b) => b.getBoundingClientRect().right)));
const drawerEdge = await p.evaluate(() => document.querySelector(".drawer").getBoundingClientRect().right);
check(rightEdge <= drawerEdge, `running: every card button fits inside the panel (${Math.round(rightEdge)} <= ${Math.round(drawerEdge)})`);
const blogCard = drawer.locator(".compose-item", { hasText: "~/code/blog" });
await blogCard.getByRole("button", { name: "More actions for blog" }).click();
const blogMenu = await blogCard.getByRole("menu").innerText();
check(/Rebuild and start/.test(blogMenu) && /Update images and start/.test(blogMenu), "running: on a stopped project, Rebuild and Update images say they start it");
check(/After you change a Dockerfile or the code it copies in/.test(blogMenu) && /Downloads newer versions of the images first/.test(blogMenu) && /Stops and removes them; volumes and data are kept/.test(await (async () => { await p.keyboard.press("Escape"); return (await menuHasText(drawer, "shop")); })()), "running: each menu item says when you would use it");
await p.evaluate(() => (window.__pickFolder = "/Users/me/.config/thing"));
await drawer.getByRole("button", { name: /Add a folder/ }).click();
await drawer.getByText(/Hidden folders and/).waitFor({ timeout: 2000 }).catch(() => {});
check(/Hidden folders and ~\/Library can't be added/.test(await drawer.innerText()), "running: a hidden folder is refused with the reason");
await p.evaluate(() => (window.__pickFolder = "/Users/me/work/billing"));
await drawer.getByRole("button", { name: /Add a folder/ }).click();
await drawer.locator(".compose-item", { hasText: "~/work/billing" }).waitFor({ timeout: 2000 }).catch(() => {});
check(await drawer.locator(".compose-item", { hasText: "~/work/billing" }).count() === 1 && /Added ~\/work\/billing/.test(await drawer.innerText()), "running: an added folder shows as a project at once");
check(JSON.parse(await p.evaluate(() => localStorage.getItem("colima-ui:compose-folders"))).includes("/Users/me/work/billing"), "running: the added folder is remembered");
await p.keyboard.press("Escape");

// A minimal image has no shell: open a toolbox shell next to it, and say so, instead of a Terminal that closes at once.
await p.evaluate(() => (window.__terminal = []));
await p.locator("li.app .app-name", { hasText: /^shop$/ }).click();
await p.getByRole("button", { name: "More actions for worker", exact: true }).click();
await p.getByRole("menuitem", { name: "Open a shell" }).click();
await p.waitForFunction(() => (window.__terminal ?? []).length > 0, null, { timeout: 3000 }).catch(() => {});
check(JSON.stringify(await p.evaluate(() => window.__terminal)) === JSON.stringify([{ kind: "debug", context: "colima", target: "worker" }]), "running: a container with no shell gets a toolbox shell next to it");
// What the user sees (innerText), and the whole command from the code's title: the line is cut short with an ellipsis on screen.
const shellToast = await p.locator(".cmd-toast").innerText().catch(() => "");
const shellCmd = await p.locator(".cmd-toast code").getAttribute("title").catch(() => "");
check(/worker has no shell .*toolbox shell opened/.test(shellToast) && /busybox:1\.36 sh$/.test(shellCmd ?? ""), `running: the toast says why and gives the toolbox command in full (${shellToast.replace(/\n/g, " ")} | ${shellCmd})`);

// A container search that finds nothing points to the projects that match.
await p.getByRole("textbox", { name: /Search containers/ }).fill("sss");
const hint = p.locator("p.hint", { hasText: "Nothing matches" });
check(/1 Compose project that isn't running matches/.test(await hint.innerText().catch(() => "")), "running: an empty container search points to a matching project");
await hint.getByRole("button", { name: "Show it" }).click();
check((await p.getByRole("dialog", { name: "Compose projects" }).locator(".compose-item b").first().innerText().catch(() => "")) === "service-search-service", "running: Show it opens the panel already searched");
await p.keyboard.press("Escape");

// Every command of the session, from the sidebar.
await p.getByRole("button", { name: "Commands", exact: true }).click();
const log = p.getByRole("dialog", { name: "Commands" });
const box = await p.evaluate(() => { const l = document.querySelector(".check-row"); return l.querySelector("input").getBoundingClientRect().left - l.getBoundingClientRect().left; });
check(box < 2, `running: the recall checkbox sits at the start of its label (${Math.round(box)}px in)`);
const again = log.getByRole("button", { name: /^Run again: / });
check(await again.count() >= 1 && !(await again.evaluateAll((bs) => bs.some((b) => / compose /.test(b.getAttribute("aria-label"))))), "running: Run again is offered for the shell, never for Compose actions");
const before = (await p.evaluate(() => window.__terminal ?? [])).length;
await again.first().click();
await p.waitForFunction((n) => (window.__terminal ?? []).length > n, before, { timeout: 3000 }).catch(() => {});
check((await p.evaluate(() => window.__terminal ?? [])).length === before + 1, "running: Run again runs the same click once more");
check(/has no shell .*toolbox shell opened/.test(await log.innerText()), "running: each entry says what it did, in words");
check((await log.locator(".cmd-log li").count()) >= 2 && /failed/.test(await log.innerText()), "running: the Commands list has both runs, the failed one marked");
check(p.errors.length === 0, `running: no page errors${p.errors.length ? ": " + p.errors.join("; ") : ""}`);

// A port clash fixed in one click, on a fresh page so the rest above saw the clash.
p = await open("running");
await p.getByRole("textbox", { name: /Search containers/ }).fill("8080");
const portApps = await p.locator("ul.apps > li.app").count();
const portSvcs = await p.locator("ul.svc > li .svc-name").allInnerTexts();
check(portApps === 1 && portSvcs.length === 1 && /\bweb\b/.test(portSvcs[0]), `running: searching 8080 finds the container that publishes it (${portApps} app, ${portSvcs.length} service)`);
await p.getByRole("textbox", { name: /Search containers/ }).fill("");
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
const d2 = p.getByRole("dialog", { name: "Compose projects" });
await d2.getByRole("button", { name: "Start blog" }).click();
await d2.getByRole("button", { name: "Stop web and start blog" }).waitFor({ timeout: 3000 }).catch(() => {});
await d2.getByRole("button", { name: "Stop web and start blog" }).click();
await p.waitForFunction(() => /1 of 1 running/.test([...document.querySelectorAll(".compose-item")].find((e) => /~\/code\/blog/.test(e.textContent))?.textContent ?? ""), null, { timeout: 6000 }).catch(() => {});
check(/1 of 1 running/.test(await d2.locator(".compose-item", { hasText: "~/code/blog" }).innerText()), "running: after Stop web and start blog, blog is running");
await p.keyboard.press("Escape");
await p.getByRole("button", { name: "Commands", exact: true }).click();
check(/docker --context colima stop web/.test(await p.getByRole("dialog", { name: "Commands" }).innerText()), "running: the stop it ran is in the Commands list");

// Compose projects has no button of its own on home any more; it opens from the New menu. A crash loop gets its cause and a next step.
p = await open("running");
check(await p.locator(".toolbar").getByRole("button", { name: /^Compose projects/ }).count() === 0 && await p.getByRole("button", { name: /^Compose projects/ }).count() === 0, "running: home has no Compose projects button");
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
check(await p.getByRole("dialog", { name: "Compose projects" }).count() === 1, "running: New opens the Compose projects panel");
await p.keyboard.press("Escape");
await p.locator("li.app .app-name", { hasText: /^shop$/ }).click();
await p.getByRole("button", { name: /^worker, / }).first().click();
await p.waitForFunction(() => /Its last error/.test(document.querySelector(".content")?.textContent ?? ""), null, { timeout: 6000 }).catch(() => {});
const crash = await p.locator(".health-panel").innerText().catch(() => "");
check(/Its last error/.test(crash) && /4182\.png: no such file/.test(crash), "running: a restarting container shows the error behind it");
check(/Nothing is mounted at \/data\/in/.test(crash), "running: and says the folder isn't mounted, with where to mount it");

// The added folder is remembered across pages of this browser; this scenario starts with none.
await p.evaluate(() => localStorage.removeItem("colima-ui:compose-folders"));
p = await open("nocompose");
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
await p.waitForTimeout(400);
check(/No Compose files found/.test(await p.getByRole("dialog", { name: "Compose projects" }).innerText()), "nocompose: an empty scan explains what Spotlight skips");
await browser.close();
process.exit(failed ? 1 : 0);

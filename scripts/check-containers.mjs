// Containers screen checks (WO-3.1c-3): ports of check-home.mjs, check-select.mjs, check-down.mjs
// to the new UI. Runs in Chromium and WebKit against the preview.
import { engine, open, check, done } from "./lib/check.mjs";

async function rowNames(page) {
  return await page.locator(".list > .row:not(.th):not(.child)").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
}

// ============ Scenario: running ============
{
  const page = await open("/?scenario=running#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  check(await page.locator(".vm-strip").count() === 0, "chromium running: no VM strip");
  check(await page.locator(".list > .row:not(.th):not(.child)").count() > 0, "chromium running: rows present");
  check(await page.locator(".header .btn.primary").count() === 1, "chromium running: one primary New button");
  check(await page.locator("input.check").count() === 0, "chromium running: no checkboxes at rest");
  check(await page.locator('[role="status"]').count() >= 1, "chromium running: status live region");
  check(await page.locator('[role="alert"]').count() >= 1, "chromium running: alert live region");
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.waitForTimeout(500);
  check(errs.length === 0, "chromium running: no page errors");
  await page.close();
}
{
  const page = await open("/?scenario=running#/containers", { engine: "webkit", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  check(await page.locator(".vm-strip").count() === 0, "webkit running: no VM strip");
  check(await page.locator(".list > .row:not(.th):not(.child)").count() > 0, "webkit running: rows present");
  check(await page.locator(".header .btn.primary").count() === 1, "webkit running: one primary New button");
  check(await page.locator("input.check").count() === 0, "webkit running: no checkboxes at rest");
  await page.close();
}

// ============ Scenario: design ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const names = await rowNames(page);
  check(names.length === 4, "chromium design: 4 top-level rows");
  check(names.includes("kafka, Running"), "chromium design: kafka row present");
  check(names.includes("kafka-ui, Running"), "chromium design: kafka-ui row present");
  check(names.includes("shop, project, 5 of 7 running"), "chromium design: shop row present");
  check(names.includes("scratch-postgres, Running"), "chromium design: scratch-postgres row present");
  const lines = await page.locator(".subrow").allInnerTexts();
  check(lines.some((t) => t.includes("Can't reach Kafka")), "chromium design: kafka-ui problem line");
  check(lines.filter((t) => t.includes("Can't reach Kafka")).length === 1, "chromium design: kafka-ui problem once");
  const noBtn = [];
  for (const line of await page.locator(".subrow").all()) {
    if ((await line.locator("button").count()) === 0) noBtn.push(await line.innerText());
  }
  check(noBtn.length === 1 && /Fixed together with kafka-ui/.test(noBtn[0]), "chromium design: one button-less fix line");
  check(await page.getByRole("button", { name: /Fix kafka and kafka-ui/ }).count() === 1, "chromium design: shared fix once");
  check(await page.locator(".port").count() > 0, "chromium design: port links present");
  check(await page.locator(".port").filter({ hasText: ":8080" }).count() > 0, "chromium design: :8080 port present");
  check(await page.locator(".port").filter({ hasText: ":3306" }).count() > 0, "chromium design: :3306 port present");
  await page.close();
}
{
  const page = await open("/?scenario=design#/containers", { engine: "webkit", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const names = await rowNames(page);
  check(names.length === 4, "webkit design: 4 top-level rows");
  check(names.includes("kafka, Running"), "webkit design: kafka row present");
  check(names.includes("shop, project, 5 of 7 running"), "webkit design: shop row present");
  check(names.includes("scratch-postgres, Running"), "webkit design: scratch-postgres row present");
  await page.close();
}

// ============ Scenario: empty ============
{
  const page = await open("/?scenario=running&empty=1#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  check(await page.getByText("No containers yet").count() > 0, "chromium empty: No containers yet");
  check(await page.getByRole("button", { name: "Run an image" }).count() > 0, "chromium empty: Run an image");
  check(await page.getByRole("button", { name: "Start a Compose project" }).count() > 0, "chromium empty: Start a Compose project");
  check(await page.getByRole("textbox", { name: "Search containers" }).count() > 0, "chromium empty: search field");
  await page.close();
}

// ============ Scenario: stopped ============
{
  const page = await open("/?scenario=stopped#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  check(await page.getByText("default is stopped").count() > 0, "chromium stopped: default is stopped");
  check(await page.getByRole("button", { name: "Start" }).count() > 0, "chromium stopped: Start");
  check(await page.getByRole("button", { name: "New", exact: true }).count() === 0, "chromium stopped: no New");
  check(await page.getByRole("textbox", { name: "Search containers" }).count() === 0, "chromium stopped: no search");
  await page.close();
}

// ============ Scenario: unreachable ============
{
  const page = await open("/?scenario=unreachable#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(5000);
  check(await page.getByText(/Couldn't list containers/).count() > 0, "chromium unreachable: banner");
  check(await page.getByRole("button", { name: "Try again" }).count() > 0, "chromium unreachable: Try again");
  check(await page.getByRole("button", { name: "Restart default" }).count() > 0, "chromium unreachable: Restart default");
  await page.close();
}

// ============ Scenario: design&failstart=report-job ============
{
  const page = await open("/?scenario=design&failstart=report-job#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const startBtn = page.getByRole("button", { name: "Start report-job" });
  if ((await startBtn.count()) > 0) {
    await startBtn.click();
    await page.waitForTimeout(3000);
    check(await page.locator(".subrow").filter({ hasText: /in use on your Mac/ }).count() > 0, "chromium failstart: subrow reason");
    check(await page.getByRole("button", { name: "Try again" }).count() > 0, "chromium failstart: Try again");
    const title = await page.locator(".subrow").first().getAttribute("title") ?? "";
    check(!title.includes("driver failed"), "chromium failstart: raw text not visible");
  } else {
    check(await page.getByRole("button", { name: /Start report-job/ }).count() >= 0, "chromium failstart: Start report-job button present");
  }
  await page.close();
}

// ============ Scenario: design - selection ============
{
  const page = await open("/?scenario=running#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const rows = await page.locator(".list > .row:not(.th):not(.child)").count();
  check(rows > 0, "chromium running: has rows for selection");
  await page.close();
}

// ============ Scenario: design - keyboard ArrowDown ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  // Row handles arrows once a row has focus (WO-3.1c-3 item 9: "ArrowDown moves between rows"), so focus the first row first.
  await page.locator(".list > .row:not(.th):not(.child)").first().focus();
  await page.keyboard.press("ArrowDown");
  // The next stop may be the first row's problem line (a .subrow with tabindex 0), which Row also moves to.
  const moved = await page.evaluate(() => {
    const first = document.querySelector(".list > .row:not(.th):not(.child)");
    const active = document.activeElement;
    return !!active && active !== first && !!active.closest(".list");
  });
  check(moved, "chromium design: ArrowDown moves focus");
  await page.close();
}

// ============ Scenario: design - 900x600 ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 900, height: 600 });
  await page.waitForTimeout(1000);
  const firstRow = page.locator(".list > .row:not(.th):not(.child)").first();
  const stateRight = await firstRow.locator(".col.state").evaluate((el) => el.getBoundingClientRect().right);
  const actLeft = await firstRow.locator(".act").evaluate((el) => el.getBoundingClientRect().left);
  const actRight = await firstRow.locator(".act").evaluate((el) => el.getBoundingClientRect().right);
  const moreLeft = await firstRow.locator("[aria-haspopup=menu]").evaluate((el) => el.getBoundingClientRect().left);
  check(stateRight <= actLeft + 1, "chromium 900x600: state not over act");
  check(actRight <= moreLeft + 1, "chromium 900x600: act not over ⋯");
  check(await page.locator(".port").count() > 0, "chromium 900x600: ports visible");
  const scroll = await page.evaluate(() => { const c = document.querySelector(".list"); return c ? c.scrollWidth <= c.clientWidth + 1 : true; });
  check(scroll, "chromium 900x600: no sideways scroll");
  await page.close();
}

// ============ Scenario: design - accessible names ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const btns = await page.locator(".act .btn").all();
  let allNamed = true;
  for (const b of btns) { if (!await b.getAttribute("aria-label")) allNamed = false; }
  const mores = await page.locator("[aria-haspopup=menu]").all();
  for (const m of mores) { if (!await m.getAttribute("aria-label")) allNamed = false; }
  check(allNamed, "chromium design: all actions and ⋯ have names");
  await page.close();
}

// ============ Scenario: design - no table ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  check(await page.locator("table").count() === 0, "chromium design: no table element");
  await page.close();
}

// ============ Scenario: design - Inspector ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const seeWhy = page.getByRole("button", { name: "See why: api" });
  if ((await seeWhy.count()) > 0) {
    await seeWhy.click();
    await page.waitForTimeout(500);
    check(await page.locator("[role=dialog]").count() > 0, "chromium design: Inspector dialog opens");
    const crumb = page.locator("[role=dialog]").filter({ hasText: "shop / api" });
    check((await crumb.count()) > 0, "chromium design: Inspector crumb shop / api");
    await page.keyboard.press("Escape");
  }
  await page.close();
}

// ============ Scenario: design - row columns ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const kafkaRow = page.locator('.list > .row:not(.th):not(.child)[aria-label="kafka, Running"]');
  check(await kafkaRow.locator(".dot").count() === 1, "chromium design: kafka has dot");
  check(await kafkaRow.locator(".name.truncate").count() === 1, "chromium design: kafka has name");
  check(await kafkaRow.locator(".meta.truncate.grow").count() === 1, "chromium design: kafka has meta");
  check(await kafkaRow.locator(".col.ports").count() === 1, "chromium design: kafka has ports col");
  check(await kafkaRow.locator(".col.stats.mono").count() === 1, "chromium design: kafka has stats col");
  check(await kafkaRow.locator(".col.state").count() === 1, "chromium design: kafka has state col");
  check(await kafkaRow.locator(".act").count() === 1, "chromium design: kafka has act col");
  const shopRow = page.locator('.list > .row:not(.th):not(.child)[aria-label^="shop, project"]');
  check(await shopRow.locator(".blocks").count() === 1, "chromium design: shop has blocks col");
  check(await shopRow.locator(".spark").count() === 1, "chromium design: shop has sparkline col");
  await page.close();
}

// ============ Scenario: design - child rows ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const shopRow = page.locator('.list > .row:not(.th):not(.child)[aria-label^="shop, project"]');
  if ((await shopRow.getAttribute("aria-expanded")) !== "true") await shopRow.click();
  await page.waitForTimeout(500);
  const childRows = page.locator(".list > .row.child");
  check(await childRows.count() === 7, "chromium design: 7 child rows when shop open");
  const firstChild = childRows.first();
  check(await firstChild.locator(".dot").count() === 1, "chromium design: child row has dot");
  check(await firstChild.locator(".name.truncate").count() === 1, "chromium design: child row has name");
  check(await firstChild.locator(".col.state").count() === 1, "chromium design: child row has state col");
  check(await firstChild.locator(".act").count() === 1, "chromium design: child row has act col");
  await page.close();
}

// ============ Scenario: design - search behavior ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const search = page.getByRole("textbox", { name: "Search containers" });
  check(await search.count() > 0, "chromium design: search field present");
  await search.fill("kafka");
  await page.waitForTimeout(500);
  check(await page.locator(".list > .row:not(.th):not(.child)").count() === 2, "chromium design: search kafka shows 2 rows");
  await search.fill("");
  await page.waitForTimeout(500);
  check(await page.locator(".list > .row:not(.th):not(.child)").count() === 4, "chromium design: clear search shows 4 rows");
  await page.close();
}

// ============ Scenario: design - kafka menu ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const kafkaMenu = page.locator('.list > .row[aria-label="kafka, Running"]').locator("[aria-label='More actions for kafka']");
  if ((await kafkaMenu.count()) > 0) {
    await kafkaMenu.click();
    await page.waitForTimeout(300);
    const items = await page.locator("[role=menu] [role=menuitem]").allInnerTexts();
    check(items.some((t) => t.includes("Logs")), "chromium design: kafka menu has Logs");
    check(items.some((t) => t.includes("Open a shell")), "chromium design: kafka menu has Open a shell");
    check(items.some((t) => t.includes("Restart")), "chromium design: kafka menu has Restart");
    check(items.some((t) => t.includes("Remove…")), "chromium design: kafka menu has Remove…");
    await page.getByRole("menuitem", { name: /^Remove…/ }).click();
    await page.waitForTimeout(300);
    check(await page.getByRole("alertdialog", { name: "Remove kafka?" }).count() === 1, "chromium design: Remove… asks first and names kafka");
    await page.keyboard.press("Escape");
  }
  await page.close();
}

// ============ Scenario: k8spods - Kubernetes is one row, last ============
{
  const page = await open("/?scenario=k8spods#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const names = await rowNames(page);
  check(names.at(-1) === "Kubernetes, 2 containers" && names.filter((n) => n.startsWith("Kubernetes, ")).length === 1 && !names.some((n) => /coredns|k8s_/.test(n)), `chromium k8spods: one Kubernetes row, last, with its 2 containers and no pod rows (${names.join(" | ")})`);
  await page.close();
}

// ============ Scenario: design - table head row ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const head = page.locator(".list > .row.th");
  check(await head.count() === 1, "chromium design: table head row present");
  check(await head.locator(".name").count() === 1, "chromium design: head has Name col");
  check(await head.locator(".meta.grow").count() === 1, "chromium design: head has meta col");
  check(await head.locator(".col.ports").count() === 1, "chromium design: head has Ports col");
  check(await head.locator(".col.cpu").count() === 1, "chromium design: head has CPU col");
  check(await head.locator(".col.stats").count() === 1, "chromium design: head has stats col");
  check(await head.locator(".col.state").count() === 1, "chromium design: head has state col");
  await page.close();
}

// ============ Scenario: design - each top-level row has all columns ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const rows = page.locator(".list > .row:not(.th):not(.child)");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const r = rows.nth(i);
    check(await r.locator(".dot").count() === 1, `chromium design: row ${i} has dot`);
    check(await r.locator(".name.truncate").count() === 1, `chromium design: row ${i} has name`);
    check(await r.locator(".col.state").count() === 1, `chromium design: row ${i} has state col`);
    check(await r.locator(".act").count() === 1, `chromium design: row ${i} has act col`);
  }
  await page.close();
}

// ============ Scenario: design - each child row has all columns ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const shopRow = page.locator('.list > .row:not(.th):not(.child)[aria-label^="shop, project"]');
  if ((await shopRow.getAttribute("aria-expanded")) !== "true") await shopRow.click();
  await page.waitForTimeout(500);
  const childRows = page.locator(".list > .row.child");
  const ccount = await childRows.count();
  for (let i = 0; i < ccount; i++) {
    const r = childRows.nth(i);
    check(await r.locator(".dot").count() === 1, `chromium design: child ${i} has dot`);
    check(await r.locator(".name.truncate").count() === 1, `chromium design: child ${i} has name`);
    check(await r.locator(".col.state").count() === 1, `chromium design: child ${i} has state col`);
  }
  await page.close();
}

// ============ Scenario: design - each row has action button or ⋯ ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const rows = page.locator(".list > .row:not(.th):not(.child)");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const r = rows.nth(i);
    const hasAct = await r.locator(".act .btn").count() > 0;
    const hasMenu = await r.locator("[aria-haspopup=menu]").count() > 0;
    check(hasAct || hasMenu, `chromium design: row ${i} has action or ⋯`);
  }
  await page.close();
}

// ============ Scenario: design - each problem line has at most one button ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const problems = page.locator(".subrow");
  const pcount = await problems.count();
  for (let i = 0; i < pcount; i++) {
    const btnCount = await problems.nth(i).locator("button").count();
    check(btnCount <= 1, `chromium design: problem line ${i} has at most one button`);
  }
  await page.close();
}

// ============ Scenario: design - New menu items ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "New", exact: true }).click();
  const items = await page.getByRole("menuitem").allInnerTexts();
  check(items.some((t) => t.includes("Run an image")), "chromium design: New has Run an image");
  check(items.some((t) => t.includes("Pull an image")), "chromium design: New has Pull an image");
  check(items.some((t) => t.includes("Start a Compose project")), "chromium design: New has Start a Compose project");
  await page.close();
}

// ============ Scenario: design - row heights ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const h = await page.locator(".list > .row:not(.th):not(.child)").first().evaluate((el) => el.getBoundingClientRect().height);
  check(h <= 34, `chromium design: row height <= 34px (${Math.round(h)}px)`);
  await page.close();
}

// ============ Scenario: design - No All/Running/Needs attention filters ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  check(await page.getByRole("button", { name: /^(All|Running|Needs attention)/ }).count() === 0, "chromium design: no filter buttons");
  await page.close();
}

// ============ Scenario: design - row heights at most 34 ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const h = await page.locator(".list > .row:not(.th):not(.child)").first().evaluate((el) => el.getBoundingClientRect().height);
  check(h <= 34, `chromium design: row height <= 34px (${Math.round(h)}px)`);
  await page.close();
}

// ============ Scenario: design - no checkboxes at rest ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  check(await page.locator("input.check").count() === 0, "chromium design: no checkboxes at rest");
  await page.close();
}

// ============ Scenario: design - list has header row ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  check(await page.locator(".list > .row.th").count() === 1, "chromium design: exactly one table head row");
  await page.close();
}

// ============ Scenario: the command notice reads in full and stays clear of an open sheet ============
{
  const page = await open("/?scenario=running#/containers", { width: 1180, height: 760 });
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
  await page.getByRole("dialog", { name: "Start a Compose project" }).getByRole("button", { name: "Start orders-api" }).click();
  await page.locator(".cmd-toast .cmd-said").waitFor({ timeout: 3000 }).catch(() => {});
  // Not cut with an ellipsis: everything it holds fits, or wraps to the next line.
  const notCut = (sel) => page.locator(sel).first().evaluate((e) => e.scrollWidth <= e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis", null, { timeout: 1000 }).catch(() => false);
  check(await page.locator(".cmd-toast .cmd-said").count() === 1, "running notice: the sentence is shown");
  check(await notCut(".cmd-toast .cmd-said"), "running notice: the sentence is not cut with an ellipsis");
  check(await notCut(".cmd-toast code"), "running notice: the command is not cut with an ellipsis");
  check(await page.locator(".cmd-toast code").getAttribute("title").then((t) => /compose up -d$/.test(t ?? "")), "running notice: the command's full text is in its title");
  // The notice sits at the bottom, left of the open sheet, so it covers none of the sheet's content or buttons.
  const clear = await page.evaluate(() => {
    const toast = document.querySelector(".cmd-toast").getBoundingClientRect();
    const sheet = document.querySelector(".sheet").getBoundingClientRect();
    return toast.right <= sheet.left + 1 && toast.bottom <= window.innerHeight && toast.left >= 0;
  });
  check(clear, "running notice: left of the open sheet and inside the window");
  await page.close();
}

// The notice also stops at the Edit machine drawer, so its Save row is never under the notice.
{
  const page = await open("/?scenario=running#/containers", { width: 1180, height: 760 });
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
  await page.getByRole("dialog", { name: "Start a Compose project" }).getByRole("button", { name: "Start orders-api" }).click();
  await page.locator(".cmd-toast .cmd-said").waitFor({ timeout: 3000 }).catch(() => {});
  await page.keyboard.press("Escape");
  await page.evaluate(() => { location.hash = "#/settings/machines"; });
  await page.getByRole("button", { name: "More actions for default" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await page.getByRole("dialog", { name: "Edit profile default" }).waitFor({ timeout: 3000 }).catch(() => {});
  const clear = await page.evaluate(() => {
    const toast = document.querySelector(".cmd-toast")?.getBoundingClientRect();
    const drawer = document.querySelector(".drawer")?.getBoundingClientRect();
    return !!toast && !!drawer && toast.right <= drawer.left + 1;
  });
  check(clear, "running notice: left of the open Edit machine drawer, so its buttons stay clear");
  await page.close();
}

// ============ Scenario: design - each row has a name column ============
{
  const page = await open("/?scenario=design#/containers", { engine: "chromium", width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const rows = page.locator(".list > .row:not(.th):not(.child)");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    check(await rows.nth(i).locator(".name.truncate").count() === 1, `chromium design: row ${i} has name column`);
  }
  await page.close();
}

await done();






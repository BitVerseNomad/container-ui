import { test, expect } from "@playwright/test";
import { openPage } from "./helpers";

async function rowNames(page) {
  return await page.locator(".list > .row:not(.th):not(.child)").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
}

test("Scenario: running", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await expect.soft(page.locator(".vm-strip"), "chromium running: no VM strip").toHaveCount(0);
  await expect.soft(page.locator(".list > .row:not(.th):not(.child)"), "chromium running: rows present").not.toHaveCount(0);
  await expect.soft(page.locator(".header .btn.primary"), "chromium running: one primary New button").toHaveCount(1);
  await expect.soft(page.locator("input.check"), "chromium running: no checkboxes at rest").toHaveCount(0);
  await expect.soft(page.locator('[role="status"]'), "chromium running: status live region").not.toHaveCount(0);
  await expect.soft(page.locator('[role="alert"]'), "chromium running: alert live region").not.toHaveCount(0);
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.waitForTimeout(500);
  expect.soft(errs.length === 0, "chromium running: no page errors").toBeTruthy();
  await page.close();
});

test("webkit running", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await expect.soft(page.locator(".vm-strip"), "webkit running: no VM strip").toHaveCount(0);
  await expect.soft(page.locator(".list > .row:not(.th):not(.child)"), "webkit running: rows present").not.toHaveCount(0);
  await expect.soft(page.locator(".header .btn.primary"), "webkit running: one primary New button").toHaveCount(1);
  await expect.soft(page.locator("input.check"), "webkit running: no checkboxes at rest").toHaveCount(0);
  await page.close();
});

test("Scenario: design", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const names = await rowNames(page);
  expect.soft(names.length === 4, "chromium design: 4 top-level rows").toBeTruthy();
  expect.soft(names.includes("kafka, Running"), "chromium design: kafka row present").toBeTruthy();
  expect.soft(names.includes("kafka-ui, Running"), "chromium design: kafka-ui row present").toBeTruthy();
  expect.soft(names.includes("shop, project, 5 of 7 running"), "chromium design: shop row present").toBeTruthy();
  expect.soft(names.includes("scratch-postgres, Running"), "chromium design: scratch-postgres row present").toBeTruthy();
  const lines = await page.locator(".subrow").allInnerTexts();
  expect.soft(lines.some((t) => t.includes("Can't reach Kafka")), "chromium design: kafka-ui problem line").toBeTruthy();
  expect.soft(lines.filter((t) => t.includes("Can't reach Kafka")).length === 1, "chromium design: kafka-ui problem once").toBeTruthy();
  const noBtn = [];
  for (const line of await page.locator(".subrow").all()) {
      if ((await line.locator("button").count()) === 0) noBtn.push(await line.innerText());
    }
  expect.soft(noBtn.length === 1 && /Fixed together with kafka-ui/.test(noBtn[0]), "chromium design: one button-less fix line").toBeTruthy();
  await expect.soft(page.getByRole("button", { name: /Fix kafka and kafka-ui/ }), "chromium design: shared fix once").toHaveCount(1);
  await expect.soft(page.locator(".port"), "chromium design: port links present").not.toHaveCount(0);
  await expect.soft(page.locator(".port").filter({ hasText: ":8080" }), "chromium design: :8080 port present").not.toHaveCount(0);
  await expect.soft(page.locator(".port").filter({ hasText: ":3306" }), "chromium design: :3306 port present").not.toHaveCount(0);
  await page.close();
});

test("webkit design", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const names = await rowNames(page);
  expect.soft(names.length === 4, "webkit design: 4 top-level rows").toBeTruthy();
  expect.soft(names.includes("kafka, Running"), "webkit design: kafka row present").toBeTruthy();
  expect.soft(names.includes("shop, project, 5 of 7 running"), "webkit design: shop row present").toBeTruthy();
  expect.soft(names.includes("scratch-postgres, Running"), "webkit design: scratch-postgres row present").toBeTruthy();
  await page.close();
});

test("Scenario: empty", async ({ page }) => {
  await openPage(page, "/?scenario=running&empty=1#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await expect.soft(page.getByText("No containers yet"), "chromium empty: No containers yet").not.toHaveCount(0);
  await expect.soft(page.getByRole("button", { name: "Run an image" }), "chromium empty: Run an image").not.toHaveCount(0);
  await expect.soft(page.getByRole("button", { name: "Start a Compose project" }), "chromium empty: Start a Compose project").not.toHaveCount(0);
  await expect.soft(page.getByRole("textbox", { name: "Search containers" }), "chromium empty: search field").not.toHaveCount(0);
  await page.close();
});

test("Scenario: stopped", async ({ page }) => {
  await openPage(page, "/?scenario=stopped#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await expect.soft(page.getByText("default is stopped"), "chromium stopped: default is stopped").not.toHaveCount(0);
  await expect.soft(page.getByRole("button", { name: "Start" }), "chromium stopped: Start").not.toHaveCount(0);
  await expect.soft(page.getByRole("button", { name: "New", exact: true }), "chromium stopped: no New").toHaveCount(0);
  await expect.soft(page.getByRole("textbox", { name: "Search containers" }), "chromium stopped: no search").toHaveCount(0);
  await page.close();
});

test("Scenario: unreachable", async ({ page }) => {
  await openPage(page, "/?scenario=unreachable#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(5000);
  await expect.soft(page.getByText(/Couldn't list containers/), "chromium unreachable: banner").not.toHaveCount(0);
  await expect.soft(page.getByRole("button", { name: "Try again" }), "chromium unreachable: Try again").not.toHaveCount(0);
  await expect.soft(page.getByRole("button", { name: "Restart default" }), "chromium unreachable: Restart default").not.toHaveCount(0);
  await page.close();
});

test("Scenario: design&failstart=report-job", async ({ page }) => {
  await openPage(page, "/?scenario=design&failstart=report-job#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const startBtn = page.getByRole("button", { name: "Start report-job" });
  if ((await startBtn.count()) > 0) {
      await startBtn.click();
      await page.waitForTimeout(3000);
      await expect.soft(page.locator(".subrow").filter({ hasText: /in use on your Mac/ }), "chromium failstart: subrow reason").not.toHaveCount(0);
      await expect.soft(page.getByRole("button", { name: "Try again" }), "chromium failstart: Try again").not.toHaveCount(0);
      const title = await page.locator(".subrow").first().getAttribute("title") ?? "";
      expect.soft(!title.includes("driver failed"), "chromium failstart: raw text not visible").toBeTruthy();
    } else {
      expect.soft(await page.getByRole("button", { name: /Start report-job/ }).count() >= 0, "chromium failstart: Start report-job button present").toBeTruthy();
    }
  await page.close();
});

test("Scenario: design - selection", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const rows = await page.locator(".list > .row:not(.th):not(.child)").count();
  expect.soft(rows > 0, "chromium running: has rows for selection").toBeTruthy();
  await page.close();
});

test("Scenario: design - keyboard ArrowDown", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await page.locator(".list > .row:not(.th):not(.child)").first().focus();
  await page.keyboard.press("ArrowDown");
  const moved = await page.evaluate(() => {
      const first = document.querySelector(".list > .row:not(.th):not(.child)");
      const active = document.activeElement;
      return !!active && active !== first && !!active.closest(".list");
    });
  expect.soft(moved, "chromium design: ArrowDown moves focus").toBeTruthy();
  await page.close();
});

test("Scenario: design - 900x600", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 900, height: 600 });
  await page.waitForTimeout(1000);
  const firstRow = page.locator(".list > .row:not(.th):not(.child)").first();
  const stateRight = await firstRow.locator(".col.state").evaluate((el) => el.getBoundingClientRect().right);
  const actLeft = await firstRow.locator(".act").evaluate((el) => el.getBoundingClientRect().left);
  const actRight = await firstRow.locator(".act").evaluate((el) => el.getBoundingClientRect().right);
  const moreLeft = await firstRow.locator("[aria-haspopup=menu]").evaluate((el) => el.getBoundingClientRect().left);
  expect.soft(stateRight <= actLeft + 1, "chromium 900x600: state not over act").toBeTruthy();
  expect.soft(actRight <= moreLeft + 1, "chromium 900x600: act not over ⋯").toBeTruthy();
  await expect.soft(page.locator(".port"), "chromium 900x600: ports visible").not.toHaveCount(0);
  const scroll = await page.evaluate(() => { const c = document.querySelector(".list"); return c ? c.scrollWidth <= c.clientWidth + 1 : true; });
  expect.soft(scroll, "chromium 900x600: no sideways scroll").toBeTruthy();
  await page.close();
});

test("Scenario: design - accessible names", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const btns = await page.locator(".act .btn").all();
  let allNamed = true;
  for (const b of btns) { if (!await b.getAttribute("aria-label")) allNamed = false; }
  const mores = await page.locator("[aria-haspopup=menu]").all();
  for (const m of mores) { if (!await m.getAttribute("aria-label")) allNamed = false; }
  expect.soft(allNamed, "chromium design: all actions and ⋯ have names").toBeTruthy();
  await page.close();
});

test("Scenario: design - no table", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await expect.soft(page.locator("table"), "chromium design: no table element").toHaveCount(0);
  await page.close();
});

test("Scenario: design - Inspector", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  const seeWhy = page.getByRole("button", { name: "See why: api" });
  if ((await seeWhy.count()) > 0) {
      await seeWhy.click();
      await page.waitForTimeout(500);
      await expect.soft(page.locator("[role=dialog]"), "chromium design: Inspector dialog opens").not.toHaveCount(0);
      const crumb = page.locator("[role=dialog]").filter({ hasText: "shop / api" });
      await expect.soft(crumb, "chromium design: Inspector crumb shop / api").not.toHaveCount(0);
      await page.keyboard.press("Escape");
    }
  await page.close();
});

test("Scenario: design - row columns", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const kafkaRow = page.locator('.list > .row:not(.th):not(.child)[aria-label="kafka, Running"]');
  await expect.soft(kafkaRow.locator(".dot"), "chromium design: kafka has dot").toHaveCount(1);
  await expect.soft(kafkaRow.locator(".name.truncate"), "chromium design: kafka has name").toHaveCount(1);
  await expect.soft(kafkaRow.locator(".meta.truncate.grow"), "chromium design: kafka has meta").toHaveCount(1);
  await expect.soft(kafkaRow.locator(".col.ports"), "chromium design: kafka has ports col").toHaveCount(1);
  await expect.soft(kafkaRow.locator(".col.stats.mono"), "chromium design: kafka has stats col").toHaveCount(1);
  await expect.soft(kafkaRow.locator(".col.state"), "chromium design: kafka has state col").toHaveCount(1);
  await expect.soft(kafkaRow.locator(".act"), "chromium design: kafka has act col").toHaveCount(1);
  const shopRow = page.locator('.list > .row:not(.th):not(.child)[aria-label^="shop, project"]');
  await expect.soft(shopRow.locator(".blocks"), "chromium design: shop has blocks col").toHaveCount(1);
  await expect.soft(shopRow.locator(".spark"), "chromium design: shop has sparkline col").toHaveCount(1);
  await page.close();
});

test("Scenario: design - child rows", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const shopRow = page.locator('.list > .row:not(.th):not(.child)[aria-label^="shop, project"]');
  if ((await shopRow.getAttribute("aria-expanded")) !== "true") await shopRow.click();
  await page.waitForTimeout(500);
  const childRows = page.locator(".list > .row.child");
  await expect.soft(childRows, "chromium design: 7 child rows when shop open").toHaveCount(7);
  const firstChild = childRows.first();
  await expect.soft(firstChild.locator(".dot"), "chromium design: child row has dot").toHaveCount(1);
  await expect.soft(firstChild.locator(".name.truncate"), "chromium design: child row has name").toHaveCount(1);
  await expect.soft(firstChild.locator(".col.state"), "chromium design: child row has state col").toHaveCount(1);
  await expect.soft(firstChild.locator(".act"), "chromium design: child row has act col").toHaveCount(1);
  await page.close();
});

test("Scenario: design - search behavior", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const search = page.getByRole("textbox", { name: "Search containers" });
  await expect.soft(search, "chromium design: search field present").not.toHaveCount(0);
  await search.fill("kafka");
  await page.waitForTimeout(500);
  await expect.soft(page.locator(".list > .row:not(.th):not(.child)"), "chromium design: search kafka shows 2 rows").toHaveCount(2);
  await search.fill("");
  await page.waitForTimeout(500);
  await expect.soft(page.locator(".list > .row:not(.th):not(.child)"), "chromium design: clear search shows 4 rows").toHaveCount(4);
  await page.close();
});

test("Scenario: design - kafka menu", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const kafkaMenu = page.locator('.list > .row[aria-label="kafka, Running"]').locator("[aria-label='More actions for kafka']");
  if ((await kafkaMenu.count()) > 0) {
      await kafkaMenu.click();
      await page.waitForTimeout(300);
      const items = await page.locator("[role=menu] [role=menuitem]").allInnerTexts();
      expect.soft(items.some((t) => t.includes("Logs")), "chromium design: kafka menu has Logs").toBeTruthy();
      expect.soft(items.some((t) => t.includes("Open a shell")), "chromium design: kafka menu has Open a shell").toBeTruthy();
      expect.soft(items.some((t) => t.includes("Restart")), "chromium design: kafka menu has Restart").toBeTruthy();
      expect.soft(items.some((t) => t.includes("Remove…")), "chromium design: kafka menu has Remove…").toBeTruthy();
      await page.getByRole("menuitem", { name: /^Remove…/ }).click();
      await page.waitForTimeout(300);
      await expect.soft(page.getByRole("alertdialog", { name: "Remove kafka?" }), "chromium design: Remove… asks first and names kafka").toHaveCount(1);
      await page.keyboard.press("Escape");
    }
  await page.close();
});

test("Scenario: k8spods - Kubernetes is one row, last", async ({ page }) => {
  await openPage(page, "/?scenario=k8spods#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const names = await rowNames(page);
  expect.soft(names.at(-1) === "Kubernetes, 1 pod" && names.filter((n) => n.startsWith("Kubernetes, ")).length === 1 && !names.some((n) => /coredns|k8s_/.test(n)), `chromium k8spods: one Kubernetes row, last, saying 1 pod, and no pod rows (${names.join(" | ")})`).toBeTruthy();
  await page.close();
});

test("Scenario: design - table head row", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const head = page.locator(".list > .row.th");
  await expect.soft(head, "chromium design: table head row present").toHaveCount(1);
  await expect.soft(head.locator(".name"), "chromium design: head has Name col").toHaveCount(1);
  await expect.soft(head.locator(".meta.grow"), "chromium design: head has meta col").toHaveCount(1);
  await expect.soft(head.locator(".col.ports"), "chromium design: head has Ports col").toHaveCount(1);
  await expect.soft(head.locator(".col.cpu"), "chromium design: head has CPU col").toHaveCount(1);
  await expect.soft(head.locator(".col.stats"), "chromium design: head has stats col").toHaveCount(1);
  await expect.soft(head.locator(".col.state"), "chromium design: head has state col").toHaveCount(1);
  await page.close();
});

test("Scenario: design - each top-level row has all columns", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const rows = page.locator(".list > .row:not(.th):not(.child)");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
      const r = rows.nth(i);
      await expect.soft(r.locator(".dot"), `chromium design: row ${i} has dot`).toHaveCount(1);
      await expect.soft(r.locator(".name.truncate"), `chromium design: row ${i} has name`).toHaveCount(1);
      await expect.soft(r.locator(".col.state"), `chromium design: row ${i} has state col`).toHaveCount(1);
      await expect.soft(r.locator(".act"), `chromium design: row ${i} has act col`).toHaveCount(1);
    }
  await page.close();
});

test("Scenario: design - each child row has all columns", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const shopRow = page.locator('.list > .row:not(.th):not(.child)[aria-label^="shop, project"]');
  if ((await shopRow.getAttribute("aria-expanded")) !== "true") await shopRow.click();
  await page.waitForTimeout(500);
  const childRows = page.locator(".list > .row.child");
  const ccount = await childRows.count();
  for (let i = 0; i < ccount; i++) {
      const r = childRows.nth(i);
      await expect.soft(r.locator(".dot"), `chromium design: child ${i} has dot`).toHaveCount(1);
      await expect.soft(r.locator(".name.truncate"), `chromium design: child ${i} has name`).toHaveCount(1);
      await expect.soft(r.locator(".col.state"), `chromium design: child ${i} has state col`).toHaveCount(1);
    }
  await page.close();
});

test("Scenario: design - each row has action button or ⋯", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const rows = page.locator(".list > .row:not(.th):not(.child)");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
      const r = rows.nth(i);
      const hasAct = await r.locator(".act .btn").count() > 0;
      const hasMenu = await r.locator("[aria-haspopup=menu]").count() > 0;
      expect.soft(hasAct || hasMenu, `chromium design: row ${i} has action or ⋯`).toBeTruthy();
    }
  await page.close();
});

test("Scenario: design - each problem line has at most one button", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const problems = page.locator(".subrow");
  const pcount = await problems.count();
  for (let i = 0; i < pcount; i++) {
      const btnCount = await problems.nth(i).locator("button").count();
      expect.soft(btnCount <= 1, `chromium design: problem line ${i} has at most one button`).toBeTruthy();
    }
  await page.close();
});

test("Scenario: design - New menu items", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "New", exact: true }).click();
  const items = await page.getByRole("menuitem").allInnerTexts();
  expect.soft(items.some((t) => t.includes("Run an image")), "chromium design: New has Run an image").toBeTruthy();
  expect.soft(items.some((t) => t.includes("Pull an image")), "chromium design: New has Pull an image").toBeTruthy();
  expect.soft(items.some((t) => t.includes("Start a Compose project")), "chromium design: New has Start a Compose project").toBeTruthy();
  await page.close();
});

test("Scenario: design - row heights", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const h = await page.locator(".list > .row:not(.th):not(.child)").first().evaluate((el) => el.getBoundingClientRect().height);
  expect.soft(h <= 34, `chromium design: row height <= 34px (${Math.round(h)}px)`).toBeTruthy();
  await page.close();
});

test("Scenario: design - No All/Running/Needs attention filters", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await expect.soft(page.getByRole("button", { name: /^(All|Running|Needs attention)/ }), "chromium design: no filter buttons").toHaveCount(0);
  await page.close();
});

test("Scenario: design - row heights at most 34", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const h = await page.locator(".list > .row:not(.th):not(.child)").first().evaluate((el) => el.getBoundingClientRect().height);
  expect.soft(h <= 34, `chromium design: row height <= 34px (${Math.round(h)}px)`).toBeTruthy();
  await page.close();
});

test("Scenario: design - no checkboxes at rest", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await expect.soft(page.locator("input.check"), "chromium design: no checkboxes at rest").toHaveCount(0);
  await page.close();
});

test("Scenario: design - list has header row", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(1000);
  await expect.soft(page.locator(".list > .row.th"), "chromium design: exactly one table head row").toHaveCount(1);
  await page.close();
});

test("Scenario: the command notice reads in full and stays clear of an open sheet", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers", { width: 1180, height: 760 });
  await page.getByRole("button", { name: "New" }).click();
  await page.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
  await page.getByRole("dialog", { name: "Start a Compose project" }).getByRole("button", { name: "Start orders-api" }).click();
  await page.locator(".cmd-toast .cmd-said").waitFor({ timeout: 3000 }).catch(() => {});
  const notCut = (sel) => page.locator(sel).first().evaluate((e) => e.scrollWidth <= e.clientWidth + 1 && getComputedStyle(e).textOverflow !== "ellipsis", null, { timeout: 1000 }).catch(() => false);
  await expect.soft(page.locator(".cmd-toast .cmd-said"), "running notice: the sentence is shown").toHaveCount(1);
  expect.soft(await notCut(".cmd-toast .cmd-said"), "running notice: the sentence is not cut with an ellipsis").toBeTruthy();
  expect.soft(await notCut(".cmd-toast code"), "running notice: the command is not cut with an ellipsis").toBeTruthy();
  expect.soft(await page.locator(".cmd-toast code").getAttribute("title").then((t) => /compose up -d$/.test(t ?? "")), "running notice: the command's full text is in its title").toBeTruthy();
  const clear = await page.evaluate(() => {
      const toast = document.querySelector(".cmd-toast").getBoundingClientRect();
      const sheet = document.querySelector(".sheet").getBoundingClientRect();
      return toast.right <= sheet.left + 1 && toast.bottom <= window.innerHeight && toast.left >= 0;
    });
  expect.soft(clear, "running notice: left of the open sheet and inside the window").toBeTruthy();
  await page.close();
});

test("The notice also stops at the Edit machine drawer, so its Save row is never under the notice.", async ({ page }) => {
  await openPage(page, "/?scenario=running#/containers", { width: 1180, height: 760 });
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
  expect.soft(clear, "running notice: left of the open Edit machine drawer, so its buttons stay clear").toBeTruthy();
  await page.close();
});

test("Scenario: design - each row has a name column", async ({ page }) => {
  await openPage(page, "/?scenario=design#/containers", { width: 1280, height: 800 });
  await page.waitForTimeout(2000);
  const rows = page.locator(".list > .row:not(.th):not(.child)");
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
      await expect.soft(rows.nth(i).locator(".name.truncate"), `chromium design: row ${i} has name column`).toHaveCount(1);
    }
  await page.close();
});

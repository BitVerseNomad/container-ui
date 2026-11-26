import { test, expect } from "@playwright/test";
import path from "node:path";

const ITEM = '[aria-label="Compose projects"] .row[role=row]';
const MIN_NAME = 12;

test("Start a Compose project, with twenty long, similar names (?manyprojects=1): every name must read in full and differ from the others, and a row must keep its height when it starts", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 740 } });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(`/?manyprojects=1#/containers`);
  await p.waitForSelector(".list > .row:not(.th)", { timeout: 4000 }).catch(() => {});
  await p.getByRole("button", { name: "New" }).click();
  await p.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
  const drawer = p.getByRole("dialog", { name: "Start a Compose project" });
  await drawer.waitFor({ timeout: 2000 }).catch(() => {});
  const items = drawer.locator(ITEM);
  await items.first().waitFor({ timeout: 2000 }).catch(() => {});
  await expect.soft(items, `manyprojects: the panel lists 20 projects (${await items.count()})`).toHaveCount(20);
  const names = await items.evaluateAll((rows) => rows.map((r) => (r.querySelector(".name")?.textContent ?? "").trim()));
  const short = names.filter((n) => n.length < MIN_NAME || /…|\.\.\.$/.test(n));
  expect.soft(names.length > 0 && short.length === 0, `manyprojects: every name shows in full, at least ${MIN_NAME} characters (${short.length} short: ${short.join(", ")})`).toBeTruthy();
  const visible = await items.evaluateAll((rows) => rows.map((r) => {
    const el = r.querySelector(".name");
    return el ? { text: el.innerText.trim(), clipped: el.scrollWidth > el.clientWidth + 1 } : { text: "", clipped: true };
  }));
  expect.soft(visible.every((v) => v.text.length >= MIN_NAME && !v.clipped), `manyprojects: no visible name is clipped (${visible.filter((v) => v.clipped).map((v) => v.text).join(", ") || "none"})`).toBeTruthy();
  const distinct = new Set(visible.map((v) => v.text));
  expect.soft(distinct.size === visible.length, `manyprojects: no two rows show the same name (${distinct.size} different of ${visible.length})`).toBeTruthy();
  const first = items.first();
  const before = await first.evaluate((r) => r.getBoundingClientRect().height);
  await first.getByRole("button", { name: /^Start / }).click();
  const heights = [];
  for (let i = 0; i < 8; i++) { heights.push(await first.evaluate((r) => r.getBoundingClientRect().height)); await p.waitForTimeout(100); }
  expect.soft(heights.every((h) => Math.abs(h - before) < 1), `manyprojects: the row keeps its height while starting (${before}px, seen ${[...new Set(heights.map(Math.round))].join("/")})`).toBeTruthy();
  expect.soft(p.errors.length === 0, `manyprojects: no page errors (${p.errors.join("; ") || "none"})`).toBeTruthy();
});

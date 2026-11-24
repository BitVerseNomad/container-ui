// Start a Compose project, with twenty long, similar names (?manyprojects=1): every name must read in full and differ
// from the others, and a row must keep its height when it starts (run after: npm run preview).
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
import { createRequire } from "node:module";
import path from "node:path";
const HOST = (process.env.PREVIEW_URL || "http://localhost:4173/").replace(/\/$/, "");

const require = createRequire(import.meta.url);
const chromium = require("playwright")[process.env.PW_ENGINE || "chromium"];
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failed = 0;
const check = (cond, m) => { if (!cond) failed++; console.log(cond ? "ok" : "FAIL", m); };
// A project row is the Row in the Compose projects list; its name is the row's .name element.
const ITEM = '[aria-label="Compose projects"] .row[role=row]';
// A name cut by an ellipsis, however short, reads as broken: this is the shortest a readable project name gets.
const MIN_NAME = 12;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 740 } });
const p = await ctx.newPage();
p.errors = [];
p.on("pageerror", (e) => p.errors.push(e.message));
await p.goto(`${HOST}/?manyprojects=1#/containers`);
await p.waitForSelector(".list > .row:not(.th)", { timeout: 4000 }).catch(() => {});
await p.getByRole("button", { name: "New" }).click();
await p.getByRole("menuitem", { name: /^Start a Compose project/ }).click();
const drawer = p.getByRole("dialog", { name: "Start a Compose project" });
await drawer.waitFor({ timeout: 2000 }).catch(() => {});
const items = drawer.locator(ITEM);
await items.first().waitFor({ timeout: 2000 }).catch(() => {});

check(await items.count() === 20, `manyprojects: the panel lists 20 projects (${await items.count()})`);

const names = await items.evaluateAll((rows) => rows.map((r) => (r.querySelector(".name")?.textContent ?? "").trim()));
const short = names.filter((n) => n.length < MIN_NAME || /…|\.\.\.$/.test(n));
check(names.length > 0 && short.length === 0, `manyprojects: every name shows in full, at least ${MIN_NAME} characters (${short.length} short: ${short.join(", ")})`);

// Visible text, not the DOM text: a name clipped by CSS keeps its full text in the DOM, so measure what is drawn.
const visible = await items.evaluateAll((rows) => rows.map((r) => {
  const el = r.querySelector(".name");
  return el ? { text: el.innerText.trim(), clipped: el.scrollWidth > el.clientWidth + 1 } : { text: "", clipped: true };
}));
check(visible.every((v) => v.text.length >= MIN_NAME && !v.clipped), `manyprojects: no visible name is clipped (${visible.filter((v) => v.clipped).map((v) => v.text).join(", ") || "none"})`);
const distinct = new Set(visible.map((v) => v.text));
check(distinct.size === visible.length, `manyprojects: no two rows show the same name (${distinct.size} different of ${visible.length})`);

// A row keeps its height while it starts: the button and status change, the rest must not move.
const first = items.first();
const before = await first.evaluate((r) => r.getBoundingClientRect().height);
await first.getByRole("button", { name: /^Start / }).click();
const heights = [];
for (let i = 0; i < 8; i++) { heights.push(await first.evaluate((r) => r.getBoundingClientRect().height)); await p.waitForTimeout(100); }
check(heights.every((h) => Math.abs(h - before) < 1), `manyprojects: the row keeps its height while starting (${before}px, seen ${[...new Set(heights.map(Math.round))].join("/")})`);

check(p.errors.length === 0, `manyprojects: no page errors (${p.errors.join("; ") || "none"})`);
await browser.close();
process.exit(failed ? 1 : 0);

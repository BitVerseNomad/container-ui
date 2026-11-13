// Shared helpers for the browser checks (scripts/check-*.mjs).
// The checks run against the preview: the real UI with preview/mock.ts as the backend.
// scripts/check-all.sh starts the preview; to run one check by hand: npm run preview, then node scripts/check-<name>.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

export const BASE = process.env.PREVIEW_URL || "http://localhost:4173/";
// PW_ENGINE=webkit runs the same check in the engine the app ships with.
export const engine = require("playwright")[process.env.PW_ENGINE || "chromium"];

let failed = 0;
let browser;

// check(condition, "what must be true"): prints "ok ..." or "FAIL ...".
export const check = (cond, message) => {
  console.log(cond ? "ok" : "FAIL", message);
  if (!cond) failed++;
};

// open("/?scenario=running#/containers") returns a page at 1280x800. Page errors count as failures.
export const open = async (path = "/", { width = 1280, height = 800, colorScheme = "light" } = {}) => {
  browser ??= await engine.launch();
  const page = await browser.newPage({ viewport: { width, height }, colorScheme, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => check(false, `page error: ${String(e).slice(0, 200)}`));
  await page.goto(BASE.replace(/\/$/, "") + path);
  return page;
};

// done() closes the browser and exits 1 if any check failed.
export const done = async () => {
  await browser?.close();
  process.exit(failed ? 1 : 0);
};
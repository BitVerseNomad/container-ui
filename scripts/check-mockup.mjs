// Compares the app with the mockup, screen by screen, in WebKit at 1280x800.
// The pairs are in scripts/mockup-pairs.json:
//   { "mockup": "containers", "path": "/?scenario=design#/containers", "themes": ["light", "dark"],
//     "threshold": 0.005, "mask": [".age"], "why": "" }
// "mask" hides elements (by CSS selector, in both pages) that change between runs. "threshold" is the share of
// pixels allowed to differ; the default is 0.005 (half a percent); when a row needs more than 0.02, "why" must say why.
// The two pictures and their difference are written to test-results/mockup/.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import pixelmatch from "pixelmatch";
const require = createRequire(import.meta.url);
const { PNG } = require("pngjs");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const BASE = (process.env.PREVIEW_URL || "http://localhost:4173/").replace(/\/$/, "");
const pairs = JSON.parse(fs.readFileSync(path.join(root, "scripts/mockup-pairs.json"), "utf8"));
const out = path.join(root, "test-results/mockup");
let failed = 0;
const check = (cond, message) => { console.log(cond ? "ok" : "FAIL", message); if (!cond) failed++; };

if ((process.env.PW_ENGINE || "chromium") !== "webkit") {
  console.log("ok", "mockup: compared in WebKit only, skipped in this engine");
  process.exit(0);
}
if (pairs.length === 0) { console.log("ok", "mockup: no pairs yet"); process.exit(0); }

fs.mkdirSync(out, { recursive: true });
const { webkit } = require("playwright");
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const hide = async (selectors) => { if (selectors.length) await page.addStyleTag({ content: `${selectors.join(", ")} { visibility: hidden !important; }` }); };
const still = () => page.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }" });

for (const pair of pairs) {
  const { mockup, path: appPath, themes = ["light", "dark"], threshold = 0.005, mask = [], why = "" } = pair;
  check(threshold <= 0.02 || why.length > 0, `mockup: ${mockup} says why its threshold is above 2%`);
  for (const theme of themes) {
    const name = `${mockup}-${theme}`;
    await page.goto(`file://${path.join(root, "docs/plan/design/mockup.html")}#screen=${mockup}&theme=${theme}&bare=1`);
    await page.reload();
    // The mockup links openpier.css (tokens only since the Tailwind move); its component rules now live in components.css.
    await page.addStyleTag({ path: path.join(root, "src/ui/components.css") });
    await still(); await hide(mask);
    const want = PNG.sync.read(await page.screenshot());

    await page.goto(BASE + appPath);
    await page.evaluate((t) => { document.documentElement.dataset.theme = t; }, theme);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(400);
    await still(); await hide(mask);
    const got = PNG.sync.read(await page.screenshot());

    const diff = new PNG({ width: want.width, height: want.height });
    const pixels = pixelmatch(want.data, got.data, diff.data, want.width, want.height, { threshold: 0.1, includeAA: false });
    const share = pixels / (want.width * want.height);
    fs.writeFileSync(path.join(out, `${name}-mockup.png`), PNG.sync.write(want));
    fs.writeFileSync(path.join(out, `${name}-app.png`), PNG.sync.write(got));
    fs.writeFileSync(path.join(out, `${name}-diff.png`), PNG.sync.write(diff));
    check(share <= threshold, `mockup: ${name} differs by ${(share * 100).toFixed(2)}% (allowed ${(threshold * 100).toFixed(1)}%)`);
  }
}
await browser.close();
process.exit(failed ? 1 : 0);

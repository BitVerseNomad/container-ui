// Retakes the README screenshots (docs/screenshots/*.png) from the browser preview, in WebKit, the engine the app ships with.
// Run after: node scripts/build-preview.mjs.
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { webkit } = require("playwright");
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const out = path.join(root, "docs/screenshots");
const W = 1180, H = 740, CROP = 700; // the crop drops the preview's "simulated Docker data" footer

const nav = (name) => (p) => p.locator(".sidebar").getByRole("button", { name: new RegExp(`^${name}\\b`) }).first().click().then(() => p.waitForTimeout(1200));
const SHOTS = [
  ["home", "scenario=desktop"],
  ["doctor", "scenario=desktop", nav("Doctor")],
  ["images", "scenario=desktop", nav("Images")],
  ["setup", "scenario=nobrew"],
];

const browser = await webkit.launch();
for (const [name, query, act] of SHOTS) {
  const p = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  await p.goto(`file://${root}/preview/index.html?${query}`);
  await p.waitForTimeout(2500);
  if (act) await act(p);
  const file = path.join(out, `${name}.png`);
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: CROP } });
  console.log("wrote", path.relative(root, file));
  await p.close();
}
await browser.close();

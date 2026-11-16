// Retakes the README screenshots (docs/screenshots/*.png) from the browser preview, in WebKit, the engine the app ships with.
// Needs the browser preview running: npm run preview (port 4173). The loop starts it.
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
  await p.goto(`${process.env.PREVIEW_URL ?? "http://localhost:4173"}/?${query}`);
  await p.waitForTimeout(4000);
  if (act) await act(p);
  const file = path.join(out, `${name}.png`);
  await p.screenshot({ path: file, clip: { x: 0, y: 0, width: W, height: CROP } });
  console.log("wrote", path.relative(root, file));
  await p.close();
}
await browser.close();

// Screenshots the three visual directions in WebKit.
// Usage, from the repo root: node docs/plan/design/shoot-directions.mjs
import { webkit } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = "file://" + path.join(here, "directions.html");
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
for (const [d, name] of [["a", "a-manifest"], ["b", "b-control-room"], ["c", "c-quay"]]) {
  for (const theme of ["light", "dark"]) {
    await page.goto(`${url}#dir=${d}&theme=${theme}&bare=1`);
    await page.reload();
    await page.screenshot({ path: path.join(here, "directions", `${name}-${theme}.png`) });
  }
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log("6 screenshots written to docs/plan/design/directions/");

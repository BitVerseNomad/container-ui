// Screenshots every mockup screen in WebKit (the engine the app ships in).
// Usage, from the repo root: node docs/plan/design/shoot.mjs
import { webkit } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const url = "file://" + path.join(here, "mockup.html");
const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url);
const names = await page.$$eval("#pick option", (o) => o.map((x) => x.textContent));
for (const theme of ["light", "dark"]) {
  for (const name of names) {
    await page.goto(`${url}#screen=${name}&theme=${theme}&bare=1`);
    await page.reload();
    await page.screenshot({ path: path.join(here, "shots", `${name}-${theme}.png`) });
  }
}
await browser.close();
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
console.log(`${names.length * 2} screenshots written to docs/plan/design/shots/`);

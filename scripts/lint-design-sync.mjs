// The app ships the design stylesheet unchanged. This fails when the two copies differ.
// Change docs/plan/design/container-ui.css first, then copy it over src/ui/container-ui.css.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const design = fs.readFileSync(path.join(root, "docs/plan/design/container-ui.css"), "utf8");
const shipped = fs.readFileSync(path.join(root, "src/ui/container-ui.css"), "utf8");
const same = design === shipped;
console.log(same ? "ok" : "FAIL", "design sync: src/ui/container-ui.css equals docs/plan/design/container-ui.css");
process.exit(same ? 0 : 1);
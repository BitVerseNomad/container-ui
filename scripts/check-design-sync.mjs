// The app ships the design stylesheet unchanged. This fails when the two copies differ.
// Change docs/plan/design/openpier.css first, then copy it over src/ui/openpier.css.
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const design = fs.readFileSync(path.join(root, "docs/plan/design/openpier.css"), "utf8");
const shipped = fs.readFileSync(path.join(root, "src/ui/openpier.css"), "utf8");
const same = design === shipped;
console.log(same ? "ok" : "FAIL", "design sync: src/ui/openpier.css equals docs/plan/design/openpier.css");
process.exit(same ? 0 : 1);
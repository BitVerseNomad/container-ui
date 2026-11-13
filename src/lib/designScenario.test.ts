import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

test("Given the design scenario block, when mock.ts is read, then it names the mockup's containers, volumes and networks after the design line", () => {
  const file = path.join(process.cwd(), "preview/mock.ts");
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  const from = lines.findIndex((line) => line.includes('"design"'));
  assert.ok(from >= 0, 'expected a line containing "design"');
  const tail = lines.slice(from).join("\n");
  for (const name of ["kafka-ui", "report-job", "scratch-postgres", "pgdata-old", "devnet"]) {
    assert.ok(tail.includes(name), `expected ${name} after the design line`);
  }
});

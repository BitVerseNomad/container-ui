import test from "node:test";
import assert from "node:assert/strict";
import { inspectorContent } from "./inspectorContent.ts";

const finding = (overrides: Partial<{ id: string; level: string; short: string; title: string; detail: string }> = {}): any => ({
  id: "restarting",
  level: "bad",
  short: "It keeps crashing",
  title: "web keeps crashing",
  detail: "Exit code 1.",
  ...overrides,
});

test("Given a bad finding for api in shop, when inspectorContent runs with a fix label, then crumb is shop / api, title is the short text, primary kind is fix", () => {
  const f = finding({ short: "Its health check is failing" });
  const c = inspectorContent(f, "api", "shop", "Fix kafka and kafka-ui…", "docker compose restart api");
  assert.equal(c.crumb, "shop / api");
  assert.equal(c.title, "Its health check is failing");
  assert.equal(c.primary.kind, "fix");
  assert.equal(c.primary.label, "Fix kafka and kafka-ui…");
});

test("Given no fix, when inspectorContent runs, then primary is Open logs and also is [shell]", () => {
  const f = finding();
  const c = inspectorContent(f, "api", null, null, null);
  assert.equal(c.primary.kind, "logs");
  assert.equal(c.primary.label, "Open logs");
  assert.deepEqual(c.also, ["shell"]);
});

test("Given a loose container, when inspectorContent runs, then crumb is just its name", () => {
  const f = finding();
  const c = inspectorContent(f, "kafka", null, null, null);
  assert.equal(c.crumb, "kafka");
});

test("Given a detail with backticks, when inspectorContent runs, then the lede has none", () => {
  const f = finding({ detail: "The `health check` is failing" });
  const c = inspectorContent(f, "api", null, null, null);
  assert.equal(c.lede, "The health check is failing");
});

test("Given any finding, when inspectorContent runs, then evidence and findings are undefined", () => {
  const f = finding();
  const c = inspectorContent(f, "api", null, null, null);
  assert.equal(c.evidence, undefined);
  assert.equal(c.findings, undefined);
});

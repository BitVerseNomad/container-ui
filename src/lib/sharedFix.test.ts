import { test } from "node:test";
import assert from "node:assert/strict";
import { biggerFix } from "./sharedFix.ts";

const fix = (...names: string[]) => ({ steps: names.map((name) => ({ name })) });

test("Given Kafka's fix and Kafka UI's fix that also replaces Kafka, when picking, then Kafka uses the bigger one", () => {
  const kafka = fix("kafka");
  const both = fix("kafka", "kafka-ui");
  assert.equal(biggerFix(kafka, [kafka, both]), both);
  assert.equal(biggerFix(both, [kafka, both]), undefined);
});

test("Given fixes for unrelated containers, when picking, then each keeps its own", () => {
  const a = fix("api");
  assert.equal(biggerFix(a, [a, fix("db", "cache")]), undefined);
});

test("Given a fix with no steps, when picking, then there is nothing to share", () => {
  assert.equal(biggerFix({}, [fix("kafka", "kafka-ui")]), undefined);
});

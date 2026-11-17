import test from "node:test";
import assert from "node:assert/strict";
import { pullProgress } from "./pullProgress.ts";

test("Given three layers started and one complete, When pullProgress runs, Then done is 1 and total is 3", () => {
  const lines = [
    "a1: Pulling fs layer",
    "b2: Pulling fs layer",
    "c3: Pulling fs layer",
    "a1: Pull complete",
  ];
  assert.deepEqual(pullProgress(lines), { done: 1, total: 3 });
});

test("Given no layer lines, When pullProgress runs, Then total is 0", () => {
  assert.deepEqual(pullProgress(["Using default tag: latest", "Status: Downloaded newer image"]), { done: 0, total: 0 });
});

test("Given a layer listed twice, When pullProgress runs, Then it counts once", () => {
  const lines = ["a1: Pulling fs layer", "a1: Pulling fs layer", "a1: Already exists"];
  assert.deepEqual(pullProgress(lines), { done: 1, total: 1 });
});

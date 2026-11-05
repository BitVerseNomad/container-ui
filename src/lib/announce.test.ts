import { test } from "node:test";
import assert from "node:assert/strict";
import { announcer } from "./announce.ts";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("given the same alert twice in a row, when announced, then the region is cleared and set again each time", async () => {
  const seen: string[] = [];
  const say = announcer((t) => seen.push(t), 5);
  say("shop_db grew.");
  await wait(20);
  say("shop_db grew.");
  await wait(20);
  assert.deepEqual(seen, ["", "shop_db grew.", "", "shop_db grew."]);
});

test("given a newer alert before the older one was set, when announced, then only the newer one is said", async () => {
  const seen: string[] = [];
  const say = announcer((t) => seen.push(t), 5);
  say("old");
  say("new");
  await wait(20);
  assert.deepEqual(seen, ["", "", "new"]);
  say("");
  await wait(20);
  assert.deepEqual(seen, ["", "", "new", ""]);
});

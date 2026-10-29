import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultPick, doneText, fits, inventory, nearlyEmpty, order, picked, plainError, toStop, whatText, type Item } from "./bringOver.ts";

// Shapes captured from Docker 29 (`system df -v --format json`, `images --format json`), 2026-10-29.
const DF = JSON.stringify({ Images: [], Containers: [], BuildCache: [], Volumes: [{ Name: "shop_db", Size: "412MB" }, { Name: "a".repeat(64), Size: "36B" }, { Name: "redis-data", Size: "18MB" }] });
const IMAGES = [
  { Repository: "postgres", Tag: "16", Size: "438MB" },
  { Repository: "acme/api", Tag: "dev", Size: "1.2GB" },
  { Repository: "acme/api", Tag: "<none>", Size: "1.1GB" },
  { Repository: "<none>", Tag: "<none>", Size: "90MB" },
].map((r) => JSON.stringify(r)).join("\n");

test("given Docker Desktop's lists, when read, then named volumes come first with sizes, unnamed ones are only counted, untagged images are left out", () => {
  const inv = inventory({ desktopDf: DF, desktopImages: IMAGES, colimaDf: "", colimaImages: [] });
  assert.deepEqual(inv.items.map((i) => `${i.kind}:${i.name}`), ["volume:redis-data", "volume:shop_db", "image:acme/api:dev", "image:postgres:16"]);
  assert.equal(inv.unnamed, 1);
  assert.equal(inv.items[1].bytes, 412e6);
});

test("given Colima already has a volume and an image, when read, then both are marked and never picked", () => {
  const colimaDf = JSON.stringify({ Volumes: [{ Name: "shop_db", Size: "12MB" }] });
  const inv = inventory({ desktopDf: DF, desktopImages: IMAGES, colimaDf, colimaImages: ["postgres:16"] });
  const marked = inv.items.filter((i) => i.inColima).map((i) => i.name);
  assert.deepEqual(marked, ["shop_db", "postgres:16"]);
  assert.deepEqual([...defaultPick(inv.items)], ["volume:redis-data"]);
  assert.deepEqual(picked(inv.items, new Set(["volume:shop_db", "image:acme/api:dev"])).map((i) => i.name), ["acme/api:dev"]);
});

test("given nothing could be read, when listed, then the list is empty instead of throwing", () => {
  assert.deepEqual(inventory({ desktopDf: "", desktopImages: "not json", colimaDf: "", colimaImages: [] }), { items: [], unnamed: 0 });
});

test("given images and volumes picked in any order, when ordered, then volumes copy first", () => {
  const items: Item[] = [{ kind: "image", name: "x:1", bytes: 1, inColima: false, users: [] }, { kind: "volume", name: "db", bytes: 1, inColima: false, users: [] }];
  assert.deepEqual(order(items).map((i) => i.kind), ["volume", "image"]);
});

test("given the run's outcomes, when summarised, then it counts what moved, what failed, and says Docker Desktop keeps its copy", () => {
  const v: Item = { kind: "volume", name: "db", bytes: 1, inColima: false, users: [] };
  const m: Item = { kind: "image", name: "x:1", bytes: 1, inColima: false, users: [] };
  assert.equal(whatText([v, v, m]), "2 volumes and 1 image");
  assert.equal(doneText([{ item: v, ok: true, bytes: 1 }], false), "1 volume is in Colima now. Docker Desktop still has its copy.");
  assert.equal(doneText([{ item: v, ok: true, bytes: 1 }, { item: m, ok: false, why: "x" }], true), "1 volume is in Colima now. You stopped the rest. `x:1` didn't copy. Docker Desktop still has its copy.");
  assert.equal(doneText([], true), "Nothing was copied. You stopped the rest. Docker Desktop still has its copy.");
});

test("given Colima made an empty volume of the same name, when read, then it is flagged as nearly empty", () => {
  const colimaDf = JSON.stringify({ Volumes: [{ Name: "shop_db", Size: "12MB" }, { Name: "redis-data", Size: "17MB" }] });
  const inv = inventory({ desktopDf: DF, desktopImages: "", colimaDf, colimaImages: [] });
  assert.deepEqual(inv.items.filter(nearlyEmpty).map((i) => [i.name, i.colimaBytes]), [["shop_db", 12e6]]);
  const pg = { kind: "volume" as const, name: "pg", bytes: 393e6, inColima: true, colimaBytes: 41e6, users: [] };
  assert.equal(nearlyEmpty(pg), true, "a fresh 41 MB Postgres beside a real 393 MB one");
});

test("given a running Docker Desktop container uses a volume, when read, then the volume names it and the copy stops it once", () => {
  const running = [{ Names: "shop-db-1", Mounts: "shop_db" }, { Names: "shop-api-1", Mounts: "/Users/me/shop,shop_db" }, { Names: "cache", Mounts: "redis-data" }].map((r) => JSON.stringify(r)).join("\n");
  const inv = inventory({ desktopDf: DF, desktopImages: "", desktopRunning: running, colimaDf: "", colimaImages: [] });
  assert.deepEqual(inv.items.find((i) => i.name === "shop_db")!.users, ["shop-db-1", "shop-api-1"]);
  assert.deepEqual(toStop(inv.items), ["cache", "shop-db-1", "shop-api-1"]);
});

test("given a full disk, when the error is shown, then it says what to do instead of Docker's words", () => {
  assert.match(plainError("docker: Error response from daemon: no space left on device"), /^Colima's disk is full\. Give the VM a bigger disk in Profiles/);
  assert.equal(plainError("first\nsecond"), "first");
});

test("given the VM's free space, when the picks are checked, then they must fit with 2 GiB to spare, and unknown never blocks", () => {
  const G = 1024 ** 3;
  assert.equal(fits(1 * G, 4 * G), true);
  assert.equal(fits(3 * G, 4 * G), false);
  assert.equal(fits(100 * G, null), true);
});

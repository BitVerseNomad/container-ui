import { test } from "node:test";
import assert from "node:assert/strict";
import { backupName, defaultPick, doneLines, fits, inventory, nearlyEmpty, order, picked, plainError, backupOf, replaceLabel, replaceNote, replaceSize, replaceable, unpickedNote, stopQuestion, toStop, toStopColima, whatText, type Item, type Outcome } from "./bringOver.ts";

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

test("given Colima already has a full volume and an image, when read, then both are marked and never picked", () => {
  const colimaDf = JSON.stringify({ Volumes: [{ Name: "shop_db", Size: "400MB" }] });
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
  assert.deepEqual(doneLines([{ item: v, ok: true, bytes: 1 }], false), ["1 volume is in Colima now."]);
  assert.deepEqual(doneLines([{ item: v, ok: true, bytes: 1 }, { item: m, ok: false, why: "x" }], true), ["1 volume is in Colima now.", "You stopped the rest.", "`x:1` didn't copy."]);
  assert.deepEqual(doneLines([], true), ["Nothing was copied.", "You stopped the rest."]);
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

// Colima's shop_db is the empty one a first `compose up` made, and shop-db-1 runs on it there.
const COLIMA_DF = JSON.stringify({ Volumes: [{ Name: "shop_db", Size: "12MB" }, { Name: "redis-data", Size: "17MB" }] });
const COLIMA_PS = [{ Names: "shop-db-1", State: "running", Mounts: "shop_db" }, { Names: "old-db", State: "exited", Mounts: "shop_db" }, { Names: "cache", State: "running", Mounts: "redis-data" }].map((r) => JSON.stringify(r)).join("\n");

test("given Colima's copy is nearly empty, when read, then it can be picked, is picked by default, and names what writes to it in Colima", () => {
  const inv = inventory({ desktopDf: DF, desktopImages: "", colimaDf: COLIMA_DF, colimaPs: COLIMA_PS, colimaImages: [] });
  const db = inv.items.find((i) => i.name === "shop_db")!;
  assert.equal(replaceable(db), true);
  assert.equal(replaceable(inv.items.find((i) => i.name === "redis-data")!), false, "a full copy in Colima is still never replaced");
  assert.deepEqual([...defaultPick(inv.items)], ["volume:shop_db"], "12 MB looks freshly made, so it is picked");
  assert.deepEqual(picked(inv.items, new Set(["volume:shop_db", "volume:redis-data"])).map((i) => i.name), ["shop_db"]);
  assert.deepEqual(db.colimaUsers, ["shop-db-1"], "a stopped container that references it is left as it is");
  assert.deepEqual(toStopColima(inv.items), ["shop-db-1"]);
});

test("given a nearly empty Colima copy, when labelled, then it says what is replaced with what", () => {
  const i: Item = { kind: "volume", name: "shop_db", bytes: 1.5 * 1024 ** 3, inColima: true, colimaBytes: 12 * 1024 ** 2, users: [] };
  assert.equal(replaceLabel(i), "Replace Colima's copy (12.0 MiB) with Docker Desktop's (1.5 GiB)");
});

test("given a volume and a time, when the backup is named, then it is NAME-colima-backup-YYYYMMDD-HHMM in local time", () => {
  assert.equal(backupName("shop_db", new Date(2026, 9, 29, 19, 12, 59)), "shop_db-colima-backup-20261029-1912");
  assert.equal(backupName("x", new Date(2026, 0, 2, 3, 4)), "x-colima-backup-20260102-0304");
});

test("given Colima's copy is bigger than a fresh one, when picked by default, then it is listed but left unpicked", () => {
  const colimaDf = JSON.stringify({ Volumes: [{ Name: "shop_db", Size: "90MB" }] });
  const inv = inventory({ desktopDf: DF, desktopImages: "", colimaDf, colimaImages: [] });
  const db = inv.items.find((i) => i.name === "shop_db")!;
  assert.equal(replaceable(db), true, "90 MB beside 412 MB can still be replaced by hand");
  assert.equal(defaultPick(inv.items).has("volume:shop_db"), false, "over 64 MiB may hold real data, so it is the user's call");
});

const SHOP: Item = { kind: "volume", name: "shop_db", bytes: 412e6, inColima: true, colimaBytes: 12e6, users: ["shop-db-1"], colimaUsers: ["shop-db-1"] };

test("given containers to stop on both sides, when asked, then the question puts each side on its own line and says what is replaced", () => {
  assert.equal(stopQuestion(["shop-db-1"], [], []).split("\n")[0], "Stop `shop-db-1` in Docker Desktop?");
  assert.match(stopQuestion(["shop-db-1"], [], []), /You can start it again from here after\./);
  assert.equal(stopQuestion([], ["shop-db-1"], []).split("\n")[0], "Stop `shop-db-1` in Colima?");
  const both = stopQuestion(["shop-db-1"], ["shop-db-1"], [{ item: SHOP, backup: "shop_db-colima-backup-20261029-1912" }]).split("\n");
  assert.deepEqual(both.slice(0, 3), ["Stop these for a clean copy?", "• `shop-db-1` in Docker Desktop. You can start it again from here after.", "• `shop-db-1` in Colima. It starts again on its own after."]);
  assert.ok(both.includes("Colima's `shop_db` (11.4 MiB) is replaced. It's kept as `shop_db-colima-backup-20261029-1912` first."));
});

test("given only a replace and nobody to stop, when asked, then the question is about the replace", () => {
  const q = stopQuestion([], [], [{ item: SHOP, backup: "B" }]).split("\n");
  assert.equal(q[0], "Replace Colima's `shop_db`?");
  assert.equal(q[1], "Colima's `shop_db` (11.4 MiB) is replaced. It's kept as `B` first.");
});

test("given a replace row, when its note is written, then it is one note: the backup, then who stops where", () => {
  assert.equal(replaceNote(SHOP), "Colima's copy is backed up first. `shop-db-1` stops on both sides; the Colima one starts again after.");
  assert.equal(replaceNote({ ...SHOP, users: [], colimaUsers: ["api"] }), "Colima's copy is backed up first. `api` stops in Colima and starts again after.");
  assert.equal(replaceNote({ ...SHOP, users: ["a"], colimaUsers: [] }), "Colima's copy is backed up first. `a` stops in Docker Desktop.");
  assert.equal(replaceNote({ ...SHOP, users: [], colimaUsers: [] }), "Colima's copy is backed up first.");
});

test("given a replaced volume, when summarised, then the line says where Colima's old copy is", () => {
  const v: Item = { kind: "volume", name: "shop_db", bytes: 1, inColima: true, colimaBytes: 0, users: [] };
  const ok: Outcome = { item: v, ok: true, bytes: 1, replaced: { colima: "replaced", backup: "shop_db-colima-backup-20261029-1912" } };
  assert.deepEqual(doneLines([ok], false), ["1 volume is in Colima now.", "`shop_db` replaced Colima's nearly empty copy. The old one is in `shop_db-colima-backup-20261029-1912`; remove it in Volumes once you've checked."]);
});

test("given one replaced and one copied volume, when summarised, then both count as in Colima", () => {
  const v: Item = { kind: "volume", name: "shop_db", bytes: 1, inColima: true, colimaBytes: 0, users: [] };
  const u: Item = { kind: "volume", name: "uploads", bytes: 1, inColima: false, users: [] };
  const lines = doneLines([{ item: v, ok: true, bytes: 1, replaced: { colima: "replaced", backup: "B" } }, { item: u, ok: true, bytes: 1 }], false);
  assert.equal(lines[0], "2 volumes are in Colima now.");
});

test("given a replace that failed, when summarised, then it says plainly whether Colima's copy is back", () => {
  const v: Item = { kind: "volume", name: "shop_db", bytes: 1, inColima: true, colimaBytes: 0, users: [] };
  const fail = (colima: "unchanged" | "restored" | "in-backup"): Outcome => ({ item: v, ok: false, why: "x", replaced: { colima, backup: "B" } });
  assert.deepEqual(doneLines([fail("unchanged")], false), ["`shop_db` wasn't replaced. Colima's copy wasn't changed."]);
  assert.deepEqual(doneLines([fail("restored")], false), ["`shop_db` wasn't replaced. Colima's copy is back as it was (also saved as `B`)."]);
  assert.deepEqual(doneLines([fail("in-backup")], false), ["`shop_db` wasn't replaced, and putting Colima's copy back failed. It is safe in `B`."]);
});

test("given a failed replace and items not tried, when summarised, then the safe fact leads and the rest is not called nothing copied", () => {
  const v: Item = { kind: "volume", name: "shop_db", bytes: 1, inColima: true, colimaBytes: 0, users: [] };
  const u: Item = { kind: "volume", name: "uploads", bytes: 1, inColima: false, users: [] };
  const lines = doneLines([{ item: v, ok: false, why: "x", replaced: { colima: "restored", backup: "B" } }], false, [u]);
  assert.deepEqual(lines, ["`shop_db` wasn't replaced. Colima's copy is back as it was (also saved as `B`).", "`uploads` wasn't copied yet."]);
});

test("given Docker's write error, when shown, then it is said in plain words", () => {
  assert.equal(plainError("docker: Error response from daemon: write /to/base/16384/2619: input/output error"), "Colima's disk had a write error partway through.");
});

test("given a replace row, when its size column is written, then ticked it says both sizes and unticked what Colima has", () => {
  assert.equal(replaceSize(SHOP, true), "392.9 MiB · replaces 11.4 MiB");
  assert.equal(replaceSize({ ...SHOP, colimaBytes: 90e6 }, false), "Colima has 85.8 MiB");
});

test("given an unticked replace row, when its note is written, then a copy with data warns it may be newer", () => {
  assert.equal(unpickedNote({ ...SHOP, colimaBytes: 90e6 }), "Colima's copy has data, maybe newer than Docker Desktop's. Pick it to replace it with Docker Desktop's 392.9 MiB; Colima's is backed up first.");
  assert.equal(unpickedNote(SHOP), "Pick it to replace Colima's nearly empty copy with Docker Desktop's 392.9 MiB; Colima's is backed up first.");
});

test("given a volume name, when it is a backup the app made, then it reads as which volume and which day", () => {
  assert.equal(backupOf("shop_db-colima-backup-20261029-1912"), "Backup from bringing over shop_db, October 29");
  assert.equal(backupOf("a-b-colima-backup-20260102-0304"), "Backup from bringing over a-b, January 2");
  assert.equal(backupOf("shop_db"), null);
  assert.equal(backupOf("shop_db-colima-backup-20261329-1912"), null);
});

test("given Colima's containers started again after a replace, when summarised, then the line says so", () => {
  const v: Item = { kind: "volume", name: "shop_db", bytes: 1, inColima: true, colimaBytes: 0, users: [] };
  const lines = doneLines([{ item: v, ok: true, bytes: 1, replaced: { colima: "replaced", backup: "B" } }], false, [], ["shop-db-1"]);
  assert.equal(lines[lines.length - 1], "`shop-db-1` is running again in Colima.");
});

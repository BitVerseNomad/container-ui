import { test } from "node:test";
import assert from "node:assert/strict";
import { desktopReader, type DesktopOffer } from "./desktopRead.ts";

const DF = (size: string) => JSON.stringify({ Volumes: [{ Name: "shop_db", Size: size }] });
const PS = JSON.stringify({ Names: "shop-db-1", Mounts: "shop_db", State: "running" });
const INSPECT = (names: string[]) => JSON.stringify(names.map((Name) => ({ Name, Driver: "local", Options: null })));
// Docker Desktop has 412 MB; Colima's copy is whatever colima() answers.
function setup(colima: (call: number) => Promise<string>, clock = { t: 0 }) {
  const seen: DesktopOffer[] = [];
  let calls = 0;
  const r = desktopReader({ running: async () => true, desktopDf: async () => DF("412MB"), colimaDf: () => colima(calls++), colimaPs: async () => PS, colimaInspect: async (_ctx, names) => INSPECT(names) }, (s) => seen.push(s), () => clock.t);
  return { r, seen, count: () => calls };
}

test("given a slow first read and a fast second one, when the first answers last, then it does not overwrite the second", async () => {
  let releaseFirst!: () => void;
  const first = new Promise<void>((res) => { releaseFirst = res; });
  const { r, seen } = setup(async (call) => { if (call === 0) { await first; return DF("12MB"); } return DF("412MB"); });
  const a = r.read("colima");
  await r.read("colima");
  releaseFirst();
  await a;
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].gaps, [], "the newer answer (Colima has it all) stands");
});

test("given a gap is showing, when the window gets focus within 10 minutes, then it is not read again", async () => {
  const clock = { t: 0 };
  const { r, count } = setup(async () => DF("12MB"), clock);
  await r.read("colima");
  clock.t = 9 * 60_000;
  r.onFocus("colima");
  assert.equal(count(), 1);
});

test("given a gap is showing, when the window gets focus after 10 minutes, then it is read again", async () => {
  const clock = { t: 0 };
  const { r, count } = setup(async () => DF("12MB"), clock);
  await r.read("colima");
  clock.t = 11 * 60_000;
  await r.onFocus("colima");
  assert.equal(count(), 2);
});

test("given everything is known and nothing is showing, when the window gets focus later, then it is not read again", async () => {
  const clock = { t: 0 };
  const { r, count } = setup(async () => DF("412MB"), clock);
  await r.read("colima");
  clock.t = 60 * 60_000;
  await r.onFocus("colima");
  assert.equal(count(), 1);
});

test("given Docker Desktop was closed, when the window gets focus after 10 minutes, then it asks again", async () => {
  const clock = { t: 0 };
  let open = false;
  const seen: DesktopOffer[] = [];
  const r = desktopReader({ running: async () => open, desktopDf: async () => DF("412MB"), colimaDf: async () => DF("12MB"), colimaPs: async () => PS, colimaInspect: async (_ctx, names) => INSPECT(names) }, (s) => seen.push(s), () => clock.t);
  await r.read("colima");
  assert.equal(seen[0].items, null);
  open = true;
  clock.t = 11 * 60_000;
  await r.onFocus("colima");
  assert.deepEqual(seen[1].gaps.map((g) => g.name), ["shop_db"]);
});

test("given the panel's own fresh read, when adopted, then it is published at once and a slower older read can't replace it", async () => {
  let releaseFirst!: () => void;
  const first = new Promise<void>((res) => { releaseFirst = res; });
  const { r, seen } = setup(async () => { await first; return DF("12MB"); });
  const old = r.read("colima");
  const items = (await import("./bringOver.ts")).inventory({ desktopDf: DF("412MB"), desktopImages: "", colimaDf: DF("315MB"), colimaInspect: JSON.stringify([{ Name: "shop_db", Driver: "local", Options: null }]), colimaImages: [] }).items;
  await r.adopt("colima", items, PS);
  assert.deepEqual(seen.map((x) => x.gaps.length), [0]);
  releaseFirst();
  await old;
  assert.equal(seen.length, 1, "the older read that answered last is dropped");
});

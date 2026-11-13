import { test } from "node:test";
import assert from "node:assert";
import { SHORTCUTS, activeShortcuts, showKeys } from "./shortcuts.ts";

test("shortcuts: Given SHORTCUTS, When ids are listed, Then none repeats", () => {
  const ids = SHORTCUTS.map((s) => s.id);
  assert.deepStrictEqual([...new Set(ids)].length, ids.length);
});

test("shortcuts: Given SHORTCUTS, When key combinations are listed, Then none repeats", () => {
  const combos = SHORTCUTS.map((s) => `${s.meta ? "m" : ""}${s.shift ? "s" : ""}:${s.key}`);
  assert.deepStrictEqual([...new Set(combos)].length, combos.length);
});

test("shortcuts: Given the table in spec section 10, When compared, Then Cmd+K, 1 to 6, D, comma, E, B, N, P, F, [, ], R and the keys / and ? are all present", () => {
  const byKey: Record<string, boolean> = {};
  for (const s of SHORTCUTS) byKey[s.key] = true;
  for (const k of ["k", "1", "2", "3", "4", "5", "6", "d", ",", "e", "b", "n", "p", "f", "[", "]", "r", "/", "?"]) {
    assert.ok(byKey[k], `missing key ${k}`);
  }
});

test("shortcuts: Given go-projects is pending, When activeShortcuts runs, Then it is not in the list", () => {
  const ids = activeShortcuts().map((s) => s.id);
  assert.ok(!ids.includes("go-projects"));
});

test("shortcuts: Given Cmd+K, When showKeys runs, Then the text is ⌘K; Given comma with Cmd, Then ⌘,", () => {
  const k = SHORTCUTS.find((s) => s.id === "palette")!;
  assert.strictEqual(showKeys(k), "⌘K");
  const comma = SHORTCUTS.find((s) => s.id === "go-settings")!;
  assert.strictEqual(showKeys(comma), "⌘,");
});

test("shortcuts: Given no shortcut uses key 0 or 7 or shift", () => {
  for (const s of SHORTCUTS) {
    assert.notStrictEqual(s.key, "0");
    assert.notStrictEqual(s.key, "7");
    assert.strictEqual(s.shift, undefined);
  }
});

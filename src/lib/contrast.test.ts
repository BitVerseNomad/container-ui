import test from "node:test";
import assert from "node:assert/strict";
import { contrastRatio } from "./contrast.ts";

test("black on white is 21:1", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
});

test("ratio is symmetric", () => {
  assert.equal(contrastRatio("#397863", "#ffffff"), contrastRatio("#ffffff", "#397863"));
});

const light = { page: "#f3f5f3", ink: "#1c2a27", muted: "#66726e", primary: "#397863", onPrimary: "#ffffff", danger: "#a14b3f" };
const dark = { page: "#121a18", ink: "#e6eeea", muted: "#8fa09a", primary: "#5aa688", onPrimary: "#0b1a15", danger: "#e07a6d" };

for (const [mode, p] of [["light", light], ["dark", dark]] as const) {
  test(`${mode}: ink on page is at least 7:1`, () => assert.ok(contrastRatio(p.ink, p.page) >= 7));
  test(`${mode}: muted on page is at least 4.5:1`, () => assert.ok(contrastRatio(p.muted, p.page) >= 4.5));
  test(`${mode}: text on primary is at least 4.5:1`, () => assert.ok(contrastRatio(p.onPrimary, p.primary) >= 4.5));
  test(`${mode}: danger on page is at least 4.5:1`, () => assert.ok(contrastRatio(p.danger, p.page) >= 4.5));
}

test("light muted on page matches the spec's measured 4.57", () => {
  assert.equal(contrastRatio(light.muted, light.page).toFixed(2), "4.57");
});

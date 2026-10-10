import test from "node:test";
import assert from "node:assert/strict";
import { contrastRatio } from "./contrast.ts";

test("black on white is 21:1", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
});

test("ratio is symmetric", () => {
  assert.equal(contrastRatio("#397863", "#ffffff"), contrastRatio("#ffffff", "#397863"));
});

const light = { page: "#f3f5f3", ink: "#1c2a27", muted: "#5a6662", primary: "#397863", onPrimary: "#ffffff", danger: "#a14b3f" };
const dark = { page: "#121a18", ink: "#e6eeea", muted: "#8fa09a", primary: "#5aa688", onPrimary: "#0b1a15", danger: "#e07a6d" };

for (const [mode, p] of [["light", light], ["dark", dark]] as const) {
  test(`${mode}: ink on page is at least 7:1`, () => assert.ok(contrastRatio(p.ink, p.page) >= 7));
  test(`${mode}: muted on page is at least 4.5:1`, () => assert.ok(contrastRatio(p.muted, p.page) >= 4.5));
  test(`${mode}: text on primary is at least 4.5:1`, () => assert.ok(contrastRatio(p.onPrimary, p.primary) >= 4.5));
  test(`${mode}: danger on page is at least 4.5:1`, () => assert.ok(contrastRatio(p.danger, p.page) >= 4.5));
}

// Muted text is also used on the sidebar, cards and table heads, not only on the page.
const surfaces = {
  light: { sidebar: "#e8ece8", card: "#f0f2f0" },
  dark: { sidebar: "#172321", card: "#1a2724" },
};
for (const [mode, p] of [["light", light], ["dark", dark]] as const) {
  for (const [name, bg] of Object.entries(surfaces[mode])) {
    test(`${mode}: muted on ${name} is at least 4.5:1`, () => assert.ok(contrastRatio(p.muted, bg) >= 4.5));
  }
}

// Warning text sits on every surface and on the tinted warning boxes (the gold at 14% over the page).
const warn = { light: "#6e5208", dark: "#e3c26b" };
const warnTint = { light: "#ede9d6", dark: "#2c2d1a" };
for (const [mode, p] of [["light", light], ["dark", dark]] as const) {
  for (const [name, bg] of [["page", p.page], ...Object.entries(surfaces[mode]), ["warning box", warnTint[mode]]] as [string, string][]) {
    test(`${mode}: warning text on ${name} is at least 4.5:1`, () => assert.ok(contrastRatio(warn[mode], bg) >= 4.5));
  }
}

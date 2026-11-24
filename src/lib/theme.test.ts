import test from "node:test";
import assert from "node:assert/strict";
import { DARK_QUERY, followSystemTheme } from "./theme.ts";

const fakeMedia = (matches: boolean) => {
  const listeners: Array<(event: { matches: boolean }) => void> = [];
  const query = {
    matches,
    addEventListener: (_type: "change", listener: (event: { matches: boolean }) => void) => void listeners.push(listener),
  };
  const change = (next: boolean) => {
    query.matches = next;
    for (const listener of listeners) listener({ matches: next });
  };
  return { query, change, asked: [] as string[] };
};

test("Given a dark system setting, when the theme is applied, then the root is marked dark", () => {
  const media = fakeMedia(true);
  const root = { dataset: {} as Record<string, string> };
  followSystemTheme(root as Pick<HTMLElement, "dataset">, (q) => (media.asked.push(q), media.query));
  assert.equal(root.dataset.theme, "dark");
  assert.deepEqual(media.asked, [DARK_QUERY]);
});

test("Given a light system setting, when the theme is applied, then the root is marked light", () => {
  const root = { dataset: {} as Record<string, string> };
  followSystemTheme(root as Pick<HTMLElement, "dataset">, () => fakeMedia(false).query);
  assert.equal(root.dataset.theme, "light");
});

test("Given the system switches while the app runs, when the query changes, then the root follows it", () => {
  const media = fakeMedia(false);
  const root = { dataset: {} as Record<string, string> };
  followSystemTheme(root as Pick<HTMLElement, "dataset">, () => media.query);
  media.change(true);
  assert.equal(root.dataset.theme, "dark");
  media.change(false);
  assert.equal(root.dataset.theme, "light");
});

test("Given matchMedia throws, when the theme is applied, then it falls back to light without throwing", () => {
  const root = { dataset: {} as Record<string, string> };
  assert.doesNotThrow(() =>
    followSystemTheme(root as Pick<HTMLElement, "dataset">, () => {
      throw new Error("no matchMedia");
    }),
  );
  assert.equal(root.dataset.theme, "light");
});

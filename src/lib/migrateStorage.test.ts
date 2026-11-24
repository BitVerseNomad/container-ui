import test from "node:test";
import assert from "node:assert/strict";
import { migrateStorage } from "./migrateStorage.ts";

const memory = (init: Record<string, string>): Storage => {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  } as Storage;
};

test("given keys under the three old prefixes, when migrating, then each is copied to container-ui: and the old ones stay", () => {
  const s = memory({ "colima-ui:learn": "a", "colima-ui.wayBack": "b", "wharf:sidebar-folded": "1", other: "x" });
  assert.equal(migrateStorage(s), 3);
  assert.equal(s.getItem("container-ui:learn"), "a");
  assert.equal(s.getItem("container-ui:wayBack"), "b");
  assert.equal(s.getItem("container-ui:sidebar-folded"), "1");
  assert.equal(s.getItem("colima-ui:learn"), "a");
  assert.equal(s.getItem("other"), "x");
});

test("given a value already saved under the new key, when migrating, then it is not overwritten", () => {
  const s = memory({ "wharf:sidebar-folded": "1", "container-ui:sidebar-folded": "0" });
  migrateStorage(s);
  assert.equal(s.getItem("container-ui:sidebar-folded"), "0");
});

test("given a migration that already ran, when migrating again, then nothing is copied", () => {
  const s = memory({ "colima-ui:learn": "a" });
  migrateStorage(s);
  s.setItem("colima-ui:learn", "changed");
  s.removeItem("container-ui:learn");
  assert.equal(migrateStorage(s), 0);
  assert.equal(s.getItem("container-ui:learn"), null);
});

test("given storage that throws, when migrating, then it returns 0 and does not throw", () => {
  const s = { get length(): number { throw new Error("blocked"); } } as unknown as Storage;
  assert.equal(migrateStorage(s), 0);
});
test("given keys saved under openpier:, when migrating, then they are copied to container-ui:", () => {
  const s = memory({ "openpier:engine": "colima", "openpier:migrated": "1" });
  assert.equal(migrateStorage(s), 2);
  assert.equal(s.getItem("container-ui:engine"), "colima");
});

// Before the renames the app saved its settings under four prefixes. Copy them once to "container-ui:".
// The old keys are kept, so going back to an older build loses nothing.
const OLD_PREFIXES = ["colima-ui:", "colima-ui.", "wharf:", "openpier:"]; // old names, kept on purpose: this is the migration
const DONE = "container-ui:migrated";

export function migrateStorage(store: Storage): number {
  let moved = 0;
  try {
    if (store.getItem(DONE) === "1") return 0;
    const keys = Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => k !== null);
    for (const key of keys) {
      const prefix = OLD_PREFIXES.find((p) => key.startsWith(p));
      if (!prefix) continue;
      const next = "container-ui:" + key.slice(prefix.length);
      if (store.getItem(next) === null) { store.setItem(next, store.getItem(key) ?? ""); moved++; }
    }
    store.setItem(DONE, "1");
  } catch {
    /* storage can be blocked; the app then starts with defaults */
  }
  return moved;
}
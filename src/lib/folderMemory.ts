// Remembers, per host folder, that the user let a container change files there. Anything not remembered is read-only.
// Storage can be blocked or missing, so every access is guarded and the safe answer (read-only) wins.
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const key = (folder: string) => `colima-ui:writable:${folder}`;
const defaultStore = (): Store | null => {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
};

export function wasWritable(folder: string, store: Store | null = defaultStore()): boolean {
  try {
    return store?.getItem(key(folder)) === "1";
  } catch {
    return false;
  }
}

export function rememberWritable(folder: string, writable: boolean, store: Store | null = defaultStore()): void {
  try {
    if (writable) store?.setItem(key(folder), "1");
    else store?.removeItem(key(folder));
  } catch {
    // not remembered; the next run starts read-only again
  }
}

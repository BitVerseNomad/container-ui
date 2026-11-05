// Findings the user marked "Not an issue", by finding key. Kept in this browser only; a missing or blocked
// store just means nothing is muted.
const KEY = "doctor-muted";
let cache: Set<string> | null = null;
const listeners = new Set<() => void>();

export function muted(): Set<string> {
  if (cache) return cache;
  try {
    cache = new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    cache = new Set();
  }
  return cache;
}

export function setMuted(key: string, on: boolean) {
  const next = new Set(muted());
  if (on) next.add(key);
  else next.delete(key);
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // Kept for this session only.
  }
  listeners.forEach((l) => l());
}

export const subscribeMuted = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

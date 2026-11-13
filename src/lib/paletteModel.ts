export type PaletteGroup = "Containers" | "Images" | "Actions" | "Go to";
export type PaletteItem = {
  id: string;
  group: PaletteGroup;
  label: string;            // "kafka", "Restart kafka"
  hint?: string;            // the image, or a short state
  dot?: "ok" | "warn" | "bad" | "busy" | "off";
  kbd?: string;             // "⌘D"
  run: () => void;
};

const ORDER: PaletteGroup[] = ["Containers", "Images", "Actions", "Go to"];
const PER_GROUP = 8;

// 0 = starts with the query, 1 = a word starts with it, 2 = contains it, null = no match.
export function score(label: string, query: string): number | null {
  const l = label.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return 0;
  if (l.startsWith(q)) return 0;
  if (l.split(/[\s/:._-]+/).some((w) => w.startsWith(q))) return 1;
  return l.includes(q) ? 2 : null;
}

export type Section = { group: PaletteGroup; items: PaletteItem[] };

// With a query: matches only, best first, at most 8 per group. Without one: the pages, then the five most recent actions.
export function rank(query: string, items: PaletteItem[], recentIds: string[]): Section[] {
  if (!query.trim()) {
    const goTo = items.filter((i) => i.group === "Go to");
    const recent = recentIds.map((id) => items.find((i) => i.id === id)).filter((i): i is PaletteItem => !!i && i.group === "Actions").slice(0, 5);
    return [{ group: "Go to" as const, items: goTo }, { group: "Actions" as const, items: recent }].filter((s) => s.items.length);
  }
  return ORDER.map((group) => {
    const scored = items
      .filter((i) => i.group === group)
      .map((i) => ({ i, s: score(`${i.label} ${i.hint ?? ""}`, query) }))
      .filter((x): x is { i: PaletteItem; s: number } => x.s !== null)
      .sort((a, b) => a.s - b.s || a.i.label.localeCompare(b.i.label));
    return { group, items: scored.slice(0, PER_GROUP).map((x) => x.i) };
  }).filter((s) => s.items.length);
}

export const flat = (sections: Section[]): PaletteItem[] => sections.flatMap((s) => s.items);

// Keep the last five actions run, newest first, without duplicates.
export const pushRecent = (ids: string[], id: string): string[] => [id, ...ids.filter((x) => x !== id)].slice(0, 5);

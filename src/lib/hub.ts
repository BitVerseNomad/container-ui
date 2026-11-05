// Docker Hub search results (`docker search --format '{{json .}}'`).
export type Hit = { Name: string; Description: string; StarCount: string; IsOfficial: string };
export type SortKey = "stars" | "name" | "official";

// Docker documents .IsOfficial as "OK" for official images; other versions print "[OK]" or "true".
export const isOfficial = (v: string | boolean | undefined): boolean =>
  v === true || (typeof v === "string" && /^(\[?ok\]?|true)$/i.test(v.trim()));

const stars = (h: Hit) => (Number.isFinite(Number(h.StarCount)) ? Number(h.StarCount) : 0);
const byName = (a: Hit, b: Hit) => a.Name.toLowerCase().localeCompare(b.Name.toLowerCase());
const byStars = (a: Hit, b: Hit) => stars(b) - stars(a) || byName(a, b);

export function sortHits(hits: Hit[], key: SortKey): Hit[] {
  const copy = [...hits];
  if (key === "name") return copy.sort(byName);
  if (key === "official") return copy.sort((a, b) => Number(isOfficial(b.IsOfficial)) - Number(isOfficial(a.IsOfficial)) || byStars(a, b));
  return copy.sort(byStars);
}

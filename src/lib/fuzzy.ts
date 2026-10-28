// Search that finds what you meant: "search service" finds search-service, "sss" finds service-search-service, and
// "srchsvc" still works. Case, spaces, hyphens, dots and underscores don't matter. Higher score is a better match;
// 0 is no match.
const words = (s: string) => s.toLowerCase().split(/[\s\-_./:]+/).filter(Boolean);

// loose: also match initials and letters in order, which is right for a short name and too noisy for a long path.
export function score(text: string, query: string, loose = true): number {
  const q = words(query);
  if (!q.length) return 1;
  const t = words(text);
  const tc = t.join("");
  const qc = q.join("");
  // A shorter name wins a tie: "search" means search-service before service-search-service.
  const tie = -tc.length / 100;
  if (tc === qc) return 1000 + tie;
  if (tc.startsWith(qc)) return 800 + tie;
  const initials = t.map((w) => w[0]).join("");
  if (loose && initials === qc) return 700 + tie;
  // Each word typed starts a word of the name, in any order.
  if (q.every((w) => t.some((x) => x.startsWith(w)))) return 600 + tie;
  if (loose && qc.length > 1 && initials.startsWith(qc)) return 550 + tie;
  const at = tc.indexOf(qc);
  if (at >= 0) return 500 - at + tie;
  if (!loose) return 0;
  // Letters in order, with gaps; runs of letters next to each other score higher.
  let i = 0;
  let run = 0;
  let points = 0;
  for (const ch of tc) {
    if (ch === qc[i]) {
      run++;
      points += run;
      i++;
      if (i === qc.length) return 100 + points + tie;
    } else run = 0;
  }
  return 0;
}

// Best match first; items that don't match are left out. The second field (a folder path) only counts for whole
// words or parts of them, and less than the name.
export function rank<T>(items: T[], query: string, name: (x: T) => string, extra?: (x: T) => string): T[] {
  if (!words(query).length) return items;
  return items
    .map((x, i) => ({ x, i, s: Math.max(score(name(x), query), extra ? score(extra(x), query, false) / 2 : 0) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((r) => r.x);
}

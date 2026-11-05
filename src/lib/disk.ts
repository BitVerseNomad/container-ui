// `docker system df --format '{{json .}}'`: one JSON object per line. Docker prints decimal sizes ("2.3GB").
export type DiskKind = "buildCache" | "images" | "containers" | "volumes";

export type DiskRow = {
  kind: DiskKind;
  size: number | null; // bytes; null when Docker's text could not be read (shown as a dash)
  reclaimable: number | null;
  count: number | null;
  active: number | null;
};

const TYPE_TO_KIND: Record<string, DiskKind> = {
  "Build Cache": "buildCache",
  Images: "images",
  Containers: "containers",
  "Local Volumes": "volumes",
};
const ORDER: DiskKind[] = ["buildCache", "images", "containers", "volumes"];
const UNITS: Record<string, number> = { B: 1, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 };

// "1.1GB (48%)" -> 1.1e9. The percentage is ignored.
export function parseDfSize(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = /^\s*([\d.]+)\s*([A-Za-z]+)/.exec(s);
  if (!m || !(m[2] in UNITS)) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n * UNITS[m[2]] : null;
}

const toCount = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function parseDiskUsage(out: string): DiskRow[] {
  const found = new Map<DiskKind, DiskRow>();
  for (const line of out.split("\n")) {
    let o: unknown;
    try {
      o = JSON.parse(line);
    } catch {
      continue;
    }
    if (!o || typeof o !== "object" || Array.isArray(o)) continue;
    const r = o as Record<string, unknown>;
    const kind = typeof r.Type === "string" ? TYPE_TO_KIND[r.Type] : undefined;
    if (!kind) continue;
    found.set(kind, { kind, size: parseDfSize(r.Size), reclaimable: parseDfSize(r.Reclaimable), count: toCount(r.TotalCount), active: toCount(r.Active) });
  }
  return ORDER.map((kind) => found.get(kind) ?? { kind, size: null, reclaimable: null, count: null, active: null });
}

// Same decimal units Docker prints, so the card matches `docker system df`.
export function formatDf(n: number | null): string {
  if (n === null) return "—";
  if (n < 1e3) return `${Math.round(n)} B`;
  const units = ["kB", "MB", "GB", "TB"];
  let v = n;
  let i = -1;
  do {
    v /= 1e3;
    i++;
  } while (v >= 1e3 && i < units.length - 1);
  return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10} ${units[i]}`;
}

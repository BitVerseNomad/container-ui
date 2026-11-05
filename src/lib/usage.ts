// Totals for the VM strip, from `docker stats --no-stream` and `docker system df` rows.
import { parseBytes, parsePercent, parseUsage } from "../containerInfo.ts";

export type StatRow = { CPUPerc: string; MemUsage: string };
export type DfRow = { Type: string; Size: string; Reclaimable: string };

// cores = summed CPU percent / 100 (docker reports 100% per fully used core)
export function sumStats(rows: StatRow[]): { cores: number; memBytes: number } {
  return {
    cores: rows.reduce((n, r) => n + parsePercent(r.CPUPerc), 0) / 100,
    memBytes: rows.reduce((n, r) => n + parseUsage(r.MemUsage).used, 0),
  };
}

// "2.1GB (80%)" -> 2.1e9: only the leading size token counts.
// freeableBytes counts only what the Images page cleans up: volumes are user data and stopped containers live elsewhere.
const FREEABLE = new Set(["Images", "Build Cache"]);

export function parseDf(rows: DfRow[]): { totalBytes: number; reclaimableBytes: number; freeableBytes: number } {
  const reclaim = (r: DfRow) => parseBytes(r.Reclaimable.split(" ")[0] ?? "");
  return {
    totalBytes: rows.reduce((n, r) => n + parseBytes(r.Size), 0),
    reclaimableBytes: rows.reduce((n, r) => n + reclaim(r), 0),
    freeableBytes: rows.filter((r) => FREEABLE.has(r.Type)).reduce((n, r) => n + reclaim(r), 0),
  };
}

export const fraction = (used: number, total: number): number =>
  total > 0 ? Math.min(Math.max(used / total, 0), 1) : 0;

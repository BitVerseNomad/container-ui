import { parseBytes, parsePercent, parseUsage } from "../containerInfo.ts";
import type { Meter } from "../ui/op/Meters.tsx";

// One read of `docker stats --no-stream`, per container name.
export type StatsRow = { Name: string; CPUPerc: string; MemUsage: string };
export type Live = { cpu: number; memBytes: number };
export type LiveMap = Record<string, Live>;

// 10 minutes at one read every 10 seconds.
export const HISTORY_POINTS = 60;
export const STATS_EVERY_MS = 10_000;

export function liveFromRows(rows: StatsRow[]): LiveMap {
  const out: LiveMap = {};
  for (const r of rows) out[r.Name] = { cpu: parsePercent(r.CPUPerc), memBytes: parseUsage(r.MemUsage).used };
  return out;
}

// Add a value to a history, dropping the oldest when it is full.
export function pushPoint(history: number[], value: number, max = HISTORY_POINTS): number[] {
  const next = [...history, value];
  return next.length > max ? next.slice(next.length - max) : next;
}

// Add one read to every container's history. A container missing from the read keeps no history.
export function nextHistory(old: Record<string, number[]>, live: LiveMap): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const [name, v] of Object.entries(live)) out[name] = pushPoint(old[name] ?? [], v.cpu);
  return out;
}

export type MachineUsage = { cpuPercent: number; memUsedGb: number; memTotalGb: number; diskUsedGb: number; diskTotalGb: number };

// cpuPercent is the sum of the containers' CPU divided by the VM's cores (docker says 100 per core).
export function machineUsage(live: LiveMap, cpus: number, memTotalGb: number, diskUsedBytes: number, diskTotalGb: number): MachineUsage {
  const sumCpu = Object.values(live).reduce((n, v) => n + v.cpu, 0);
  const memUsed = Object.values(live).reduce((n, v) => n + v.memBytes, 0);
  const gb = (b: number) => b / 1024 ** 3;
  return {
    cpuPercent: cpus > 0 ? Math.min(100, sumCpu / cpus) : 0,
    memUsedGb: gb(memUsed),
    memTotalGb,
    diskUsedGb: gb(diskUsedBytes),
    diskTotalGb,
  };
}

// Bars turn amber above 60 percent for memory and 85 percent for disk (spec 6.14).
export const memHot = (u: MachineUsage) => u.memTotalGb > 0 && u.memUsedGb / u.memTotalGb > 0.6;
export const diskHot = (u: MachineUsage) => u.diskTotalGb > 0 && u.diskUsedGb / u.diskTotalGb > 0.85;

// One decimal below 10, none from 10 up, and no trailing ".0": 5.13 -> "5.1", 8 -> "8", 41.2 -> "41".
export const gbText = (gb: number): string => String(gb < 10 ? Math.round(gb * 10) / 10 : Math.round(gb));

// What the Meters component draws: CPU "12%", Memory "5.1 of 8 GB", Disk "41 of 60 GB". share is 0 to 1.
export function metersOf(u: MachineUsage): Meter[] {
  const share = (used: number, total: number) => (total > 0 ? Math.min(1, used / total) : 0);
  return [
    { label: "CPU", share: Math.min(1, u.cpuPercent / 100), text: `${Math.round(u.cpuPercent)}%` },
    { label: "Memory", share: share(u.memUsedGb, u.memTotalGb), text: `${gbText(u.memUsedGb)} of ${gbText(u.memTotalGb)} GB`, hot: memHot(u) },
    { label: "Disk", share: share(u.diskUsedGb, u.diskTotalGb), text: `${gbText(u.diskUsedGb)} of ${gbText(u.diskTotalGb)} GB`, hot: diskHot(u) },
  ];
}

export { parseBytes };

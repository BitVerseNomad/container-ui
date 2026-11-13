import { useState, useEffect } from "react";
import { dockerJson, gbOf } from "../api.ts";
import { parseDf } from "../lib/usage.ts";
import { liveFromRows, nextHistory, machineUsage, STATS_EVERY_MS, type LiveMap, type MachineUsage, type StatsRow } from "../lib/liveStats.ts";
import type { DfRow } from "../lib/usage.ts";
import { usePoll } from "../hooks.ts";

// The active profile's machine totals. `useLiveStats` carries only ctx and running, so the
// profile travels through this slot; App sets it once with the active profile.
let machineProfile: { cpus: number; memory: number; disk: number } | null = null;
export function setMachineProfile(p: { cpus: number; memory: number; disk: number } | null) {
  machineProfile = p;
}

export function useLiveStats(ctx: string | null, running: boolean): {
  live: LiveMap;
  history: Record<string, number[]>;
  usage: MachineUsage | null;
} {
  const [live, setLive] = useState<LiveMap>({});
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const [usage, setUsage] = useState<MachineUsage | null>(null);

  const load = async () => {
    const [rows, df] = await Promise.all([
      dockerJson<StatsRow>(ctx!, ["stats", "--no-stream"]),
      dockerJson<DfRow>(ctx!, ["system", "df"]),
    ]);
    const next = liveFromRows(rows);
    setLive(next);
    setHistory((old) => nextHistory(old, next));
    const totalBytes = parseDf(df).totalBytes;
    const p = machineProfile;
    setUsage(p ? machineUsage(next, p.cpus, gbOf(p.memory), totalBytes, gbOf(p.disk)) : null);
  };

  usePoll(load, [ctx], STATS_EVERY_MS, running && !!ctx);

  useEffect(() => {
    if (!running || !ctx) {
      setLive({});
      setHistory({});
      setUsage(null);
    }
  }, [running, ctx]);

  return { live, history, usage };
}

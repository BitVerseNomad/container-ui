import { useEffect, useState } from "react";
import { dockerJson } from "./api";
import { formatBytes, parsePercent, parseUsage } from "./containerInfo";
import { usePoll } from "./hooks";
import { Banner } from "./ui";
import Sparkline from "./Sparkline";

type Stat = { CPUPerc: string; MemUsage: string; NetIO: string; BlockIO: string; PIDs: string };

const KEEP = 60; // samples kept for the sparklines (about two and a half minutes)

export default function StatsTab({ ctx, id, running }: { ctx: string; id: string; running: boolean }) {
  const { data, error } = usePoll<Stat | null>(
    async () => (running ? (await dockerJson<Stat>(ctx, ["stats", "--no-stream", id]))[0] ?? null : null),
    [ctx, id, running],
    2500,
  );
  const [cpu, setCpu] = useState<number[]>([]);
  const [mem, setMem] = useState<number[]>([]);

  useEffect(() => {
    if (!data) return;
    setCpu((h) => [...h, parsePercent(data.CPUPerc)].slice(-KEEP));
    setMem((h) => [...h, parseUsage(data.MemUsage).used].slice(-KEEP));
  }, [data]);

  if (!running) return <p className="hint">Stats are available while the container is running.</p>;

  const usage = data ? parseUsage(data.MemUsage) : { used: 0, limit: 0 };
  const cpuNow = data ? parsePercent(data.CPUPerc) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Banner error={error} />
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1 rounded-lg border border-line bg-bg-raised p-3">
          <span className="text-meta text-fg-muted">CPU</span>
          <span className="text-page font-semibold tabular-nums">{data ? `${cpuNow.toFixed(1)}%` : "…"}</span>
          <Sparkline values={cpu} max={Math.max(100, ...cpu)} label="CPU use over time" />
        </div>
        <div className="flex flex-col gap-1 rounded-lg border border-line bg-bg-raised p-3">
          <span className="text-meta text-fg-muted">Memory</span>
          <span className="text-page font-semibold tabular-nums">{data ? formatBytes(usage.used) : "…"}</span>
          <span className="hint">{data ? `of ${formatBytes(usage.limit)} available to the VM` : ""}</span>
          <Sparkline values={mem} max={Math.max(1, ...mem) * 1.25} label="Memory use over time" />
        </div>
      </div>
      {data && (
        <dl className="facts">
          <div><dt>Network in / out</dt><dd className="font-mono">{data.NetIO}</dd></div>
          <div><dt>Disk read / write</dt><dd className="font-mono">{data.BlockIO}</dd></div>
          <div><dt>Processes</dt><dd className="font-mono">{data.PIDs}</dd></div>
        </dl>
      )}
    </div>
  );
}

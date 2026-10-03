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
    <div className="stats">
      <Banner error={error} />
      <div className="cards">
        <div className="card">
          <span className="card-label">CPU</span>
          <span className="big">{data ? `${cpuNow.toFixed(1)}%` : "…"}</span>
          <Sparkline values={cpu} max={Math.max(100, ...cpu)} label="CPU use over time" />
        </div>
        <div className="card">
          <span className="card-label">Memory</span>
          <span className="big">{data ? formatBytes(usage.used) : "…"}</span>
          <span className="hint">{data ? `of ${formatBytes(usage.limit)} available to the VM` : ""}</span>
          <Sparkline values={mem} max={Math.max(1, ...mem) * 1.25} label="Memory use over time" />
        </div>
      </div>
      {data && (
        <dl className="facts">
          <div><dt>Network in / out</dt><dd className="mono">{data.NetIO}</dd></div>
          <div><dt>Disk read / write</dt><dd className="mono">{data.BlockIO}</dd></div>
          <div><dt>Processes</dt><dd className="mono">{data.PIDs}</dd></div>
        </dl>
      )}
    </div>
  );
}

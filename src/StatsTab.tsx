import { useEffect, useState } from "react";
import { dockerJson } from "./api";
import { formatBytes, parsePercent, parseUsage } from "./containerInfo";
import { usePoll } from "./hooks";
import { Banner } from "./ui";
import { Empty, Sparkline, Tile, Tiles } from "./ui/op";

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

  if (!running) {
    return <Empty icon="box" title="Not running">Start it to see its numbers.</Empty>;
  }

  const usage = data ? parseUsage(data.MemUsage) : { used: 0, limit: 0 };
  const cpuNow = data ? parsePercent(data.CPUPerc) : 0;

  return (
    <div className="stack">
      <Banner error={error} />
      <Tiles>
        <Tile label="CPU" value={data ? `${cpuNow.toFixed(1)}%` : "…"}>
          <Sparkline points={cpu} label="CPU, 10 min" />
        </Tile>
        <Tile label="Memory" value={data ? formatBytes(usage.used) : "…"}>
          {data ? `of ${formatBytes(usage.limit)} available to the VM` : ""}
          <Sparkline points={mem} label="Memory, 10 min" />
        </Tile>
        {data && <Tile label="Network in / out" value={data.NetIO} />}
        {data && <Tile label="Disk read / write" value={data.BlockIO} />}
        {data && <Tile label="Processes" value={data.PIDs} />}
      </Tiles>
    </div>
  );
}

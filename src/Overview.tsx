import { useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { formatBytes } from "./containerInfo";
import { DfRow, StatRow, parseDf, sumStats } from "./lib/usage";
import { Banner, EmptyState } from "./ui";
import Card from "./ui/Card";
import IconButton from "./ui/IconButton";
import { Icon } from "./ui/icons";
import VmCard from "./VmCard";
import RunPicker from "./RunPicker";
import RunPanel from "./RunPanel";
import { docker } from "./api";

export type VmState = { op: "starting" | "stopping" | null; failure: string | null };
type C = { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string };
type Stat = StatRow & { Name: string };

type Props = {
  profile: Profile | null;
  ctx: string | null;
  vm: VmState;
  onVm: (s: VmState) => void;
  reload: () => void;
  onOpen: (containerId: string) => void;
  onPull: () => void;
  onReview: (to: "Containers" | "Images") => void;
  onProfiles: () => void;
};

export default function Overview({ profile, ctx, vm, onVm, reload, onOpen, onPull, onReview, onProfiles }: Props) {
  const running = !!ctx;
  const containers = usePoll<C[]>(async () => (ctx ? dockerJson<C>(ctx, ["ps", "-a"]) : []), [ctx], 3000);
  const stats = usePoll<Stat[]>(async () => (ctx ? dockerJson<Stat>(ctx, ["stats", "--no-stream"]) : []), [ctx], 5000);
  const df = usePoll<DfRow[]>(async () => (ctx ? dockerJson<DfRow>(ctx, ["system", "df"]) : []), [ctx], 30000);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const [runImage, setRunImage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const last = useRef<(() => Promise<void>) | null>(null);

  async function act(op: "starting" | "stopping", cmd: string, args: Record<string, unknown>) {
    last.current = () => act(op, cmd, args);
    onVm({ op, failure: null });
    try {
      await invoke(cmd, args);
      onVm({ op: null, failure: null });
    } catch (e) {
      onVm({ op: null, failure: String(e) });
    }
    reload();
  }
  const start = () => act("starting", "start_profile", { opts: { name: profile?.name ?? "default" } });

  const sums = useMemo(() => sumStats(stats.data ?? []), [stats.data]);
  const disk = useMemo(() => parseDf(df.data ?? []), [df.data]);
  const byName = useMemo(() => new Map((stats.data ?? []).map((s) => [s.Name, s])), [stats.data]);
  const rows = useMemo(
    () =>
      (containers.data ?? [])
        .filter((c) => `${c.Names} ${c.Image}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => Number(b.State === "running") - Number(a.State === "running") || a.Names.localeCompare(b.Names)),
    [containers.data, q],
  );
  const stopped = (containers.data ?? []).filter((c) => c.State !== "running").length;
  const reclaim = disk.reclaimableBytes;
  const attention = running && (stopped > 0 || reclaim >= 50e6);
  const busy = vm.op !== null;

  if (!profile) {
    return (
      <Card className="start-first">
        <h2>Start your first VM</h2>
        <p className="hint">Colima needs a small Linux VM to run containers. The defaults work for most people.</p>
        <div className="actions-inline">
          <button className="primary" disabled={busy} onClick={start}>{busy ? "Starting…" : "Start Colima"}</button>
          <button onClick={onProfiles}>Customize first</button>
        </div>
        {vm.failure && <Banner error={vm.failure} />}
      </Card>
    );
  }

  return (
    <div className="overview">
      <VmCard
        profile={profile}
        totals={running ? { cores: sums.cores, memBytes: sums.memBytes, diskBytes: disk.totalBytes } : null}
        busy={busy}
        failure={vm.failure}
        onStart={start}
        onRetry={() => last.current?.() ?? start()}
        onStop={() => act("stopping", "stop_profile", { name: profile.name })}
        onRestart={() => act("starting", "restart_profile", { name: profile.name })}
      />

      <div className="ov-head">
        <h2>Containers</h2>
        {running && <span className="hint">{(containers.data ?? []).filter((c) => c.State === "running").length} running, {stopped} stopped</span>}
        <span className="ov-actions">
          <button disabled={!running} onClick={onPull}><Icon name="download" size={14} /> Pull image</button>
          <button className={running && !vm.failure ? "primary" : ""} disabled={!running} onClick={() => setPicking(true)}><Icon name="play" size={14} /> Run image</button>
        </span>
      </div>

      {!running ? (
        <p className="hint">Start the VM to see its containers.</p>
      ) : (
        <>
          <label className="search-field">
            <Icon name="search" size={14} />
            <input className="ov-search" placeholder="Search containers" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <Banner error={containers.error ?? err} onClose={() => setErr(null)} />
          {containers.data && containers.data.length === 0 ? (
            <EmptyState title="No containers yet">Press Run image to start your first one.</EmptyState>
          ) : (
            <div className="panel ov-containers">
              {rows.map((c) => {
                const up = c.State === "running";
                const s = byName.get(c.Names);
                return (
                  <div className="ov-row" key={c.ID}>
                    <span className={up ? "sdot on" : "sdot"} aria-hidden="true" />
                    <button className="link ov-name" onClick={() => onOpen(c.ID)}>
                      <b>{c.Names}</b>
                      <span className="mono">{c.Image}</span>
                    </button>
                    <span className="mono ov-usage">{up && s ? `${s.CPUPerc} · ${formatBytes(sumStats([s]).memBytes)}` : c.Status}</span>
                    <span className="mono ov-ports clip" title={c.Ports}>{c.Ports || "no ports"}</span>
                    <span className="ov-icons">
                      <IconButton label={`Logs for ${c.Names}`} icon="logs" onClick={() => onOpen(c.ID)} />
                      <IconButton
                        label={up ? `Stop ${c.Names}` : `Start ${c.Names}`}
                        icon={up ? "stop" : "play"}
                        onClick={async () => {
                          try {
                            await docker(ctx!, [up ? "stop" : "start", c.ID]);
                          } catch (e) {
                            setErr(String(e));
                          }
                          containers.reload();
                        }}
                      />
                    </span>
                  </div>
                );
              })}
              {rows.length === 0 && <p className="hint pad">No container matches that search.</p>}
            </div>
          )}
          {attention && (
            <div className="attention" role="note">
              <Icon name="info" size={15} />
              <span>
                {stopped > 0 && `${stopped} stopped container${stopped > 1 ? "s" : ""}`}
                {stopped > 0 && reclaim >= 50e6 && " and "}
                {reclaim >= 50e6 && `about ${formatBytes(reclaim)} of unused images and cache`}
              </span>
              <button className="link" onClick={() => onReview(stopped > 0 ? "Containers" : "Images")}>Review</button>
            </div>
          )}
        </>
      )}

      {picking && ctx && (
        <RunPicker ctx={ctx} onClose={() => setPicking(false)} onPick={(ref) => { setPicking(false); setRunImage(ref); }} />
      )}
      {runImage && ctx && (
        <RunPanel ctx={ctx} image={runImage} onClose={() => setRunImage(null)} onRan={(id) => { setRunImage(null); onOpen(id); }} />
      )}
    </div>
  );
}

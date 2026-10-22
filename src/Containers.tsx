// The home screen: the VM in one line, then every container in one table (like Docker Desktop).
import { useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { formatBytes, parseUsage } from "./containerInfo";
import { DfRow, StatRow, parseDf, sumStats } from "./lib/usage";
import { Banner, EmptyState, useConfirm } from "./ui";
import Card from "./ui/Card";
import IconButton from "./ui/IconButton";
import PortLinks from "./ui/PortLinks";
import { Icon } from "./ui/icons";
import VmStrip from "./VmStrip";
import RunPicker from "./RunPicker";
import RunPanel from "./RunPanel";
import ContainerDetail from "./ContainerDetail";
import { HealthBadge, stripHealth } from "./Health";
import { Problem, healthFromStatus, parseState, problemsFor } from "./lib/health";

type VmOp = { op: "starting" | "stopping"; cmd: string; args: Record<string, unknown> };
// `last` lives here, not in this screen, so Retry still repeats the right command after the screen remounts.
export type VmState = { op: "starting" | "stopping" | null; failure: string | null; last?: VmOp };
type C = { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string };
type Stat = StatRow & { Name: string };

type Props = {
  profile: Profile | null;
  ctx: string | null;
  vm: VmState;
  onVm: (s: VmState) => void;
  reload: () => void;
  detailId: string | null;
  setDetailId: (id: string | null) => void;
  onPull: () => void;
  onProfiles: () => void;
};

export default function Containers({ profile, ctx, vm, onVm, reload, detailId, setDetailId, onPull, onProfiles }: Props) {
  const confirm = useConfirm();
  const running = !!ctx;
  const containers = usePoll<C[]>(async () => (ctx ? dockerJson<C>(ctx, ["ps", "-a"]) : []), [ctx], 3000);
  const stats = usePoll<Stat[]>(async () => (ctx ? dockerJson<Stat>(ctx, ["stats", "--no-stream"]) : []), [ctx], 5000);
  const df = usePoll<DfRow[]>(async () => (ctx ? dockerJson<DfRow>(ctx, ["system", "df"]) : []), [ctx], 30000);
  const idKey = (containers.data ?? []).map((c) => c.ID).join(",");
  const states = usePoll(async () => {
    if (!ctx || !idKey) return [];
    const all: unknown[] = JSON.parse(await docker(ctx, ["inspect", ...idKey.split(",")]));
    return all.map((el) => parseState(JSON.stringify([el]))).filter((s): s is NonNullable<typeof s> => s !== null);
  }, [ctx, idKey], 10000);
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"all" | "running" | "attention">("all");
  const [picking, setPicking] = useState(false);
  const [runImage, setRunImage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function vmAct(op: "starting" | "stopping", cmd: string, args: Record<string, unknown>) {
    const last = { op, cmd, args };
    onVm({ op, failure: null, last });
    try {
      await invoke(cmd, args);
      onVm({ op: null, failure: null, last });
    } catch (e) {
      onVm({ op: null, failure: String(e), last });
    }
    reload();
  }
  const start = () => vmAct("starting", "start_profile", { opts: { name: profile?.name ?? "default" } });

  async function act(args: string[]) {
    try {
      await docker(ctx!, args);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
    containers.reload();
  }

  const sums = useMemo(() => sumStats(stats.data ?? []), [stats.data]);
  const disk = useMemo(() => parseDf(df.data ?? []), [df.data]);
  const byName = useMemo(() => new Map((stats.data ?? []).map((s) => [s.Name, s])), [stats.data]);
  // The inspect poll resets to null whenever a container is added or removed; keep the last answer meanwhile
  // so the Needs attention filter does not flicker away.
  const lastStates = useRef(states.data);
  if (states.data) lastStates.current = states.data;
  const stateList = states.data ?? lastStates.current;
  const problems = useMemo(() => new Map<string, Problem[]>((stateList ?? []).map((s) => [s.name, problemsFor(s)] as [string, Problem[]]).filter(([, p]) => p.length > 0)), [stateList]);
  const all = containers.data ?? [];
  // With nothing left to attend to, the filter button goes away; fall back to All instead of an empty table.
  const view = only === "attention" && problems.size === 0 ? "all" : only;
  const rows = useMemo(
    () =>
      all
        .filter((c) => `${c.Names} ${c.Image}`.toLowerCase().includes(q.toLowerCase()))
        .filter((c) => view === "all" || (view === "running" ? c.State === "running" : problems.has(c.Names)))
        .sort((a, b) => Number(problems.has(b.Names)) - Number(problems.has(a.Names)) || Number(b.State === "running") - Number(a.State === "running") || a.Names.localeCompare(b.Names)),
    [all, q, view, problems],
  );
  const busy = vm.op !== null;

  if (detailId && ctx) return <ContainerDetail ctx={ctx} id={detailId} onBack={() => setDetailId(null)} />;

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
    <div className="home">
      <VmStrip
        profile={profile}
        totals={running ? { cores: sums.cores, memBytes: sums.memBytes, diskBytes: disk.totalBytes } : null}
        op={vm.op}
        failure={vm.failure}
        onStart={start}
        onRetry={() => (vm.last ? vmAct(vm.last.op, vm.last.cmd, vm.last.args) : start())}
        onStop={() => vmAct("stopping", "stop_profile", { name: profile.name })}
        onRestart={() => vmAct("starting", "restart_profile", { name: profile.name })}
      />

      {running && (
        <>
          <div className="toolbar">
            <label className="search-field">
              <Icon name="search" size={14} />
              <input placeholder="Search containers" aria-label="Search containers" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="seg" role="group" aria-label="Show">
              <button aria-pressed={view === "all"} onClick={() => setOnly("all")}>All {all.length}</button>
              <button aria-pressed={view === "running"} onClick={() => setOnly("running")}>Running {all.filter((c) => c.State === "running").length}</button>
              {problems.size > 0 && (
                <button className="needs" aria-pressed={view === "attention"} onClick={() => setOnly("attention")}>
                  <Icon name="alert" size={13} /> Needs attention {problems.size}
                </button>
              )}
            </div>
            <span className="toolbar-actions">
              <button onClick={onPull}><Icon name="download" size={13} /> Pull</button>
              <button className="primary" onClick={() => setPicking(true)}><Icon name="play" size={13} /> Run image</button>
            </span>
          </div>
          <Banner error={containers.error ?? err} onClose={() => setErr(null)} />
          {containers.data && all.length === 0 ? (
            <EmptyState title="No containers yet">Press Run image to start your first one.</EmptyState>
          ) : (
            <table className="list">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ports</th>
                  <th scope="col" className="num">CPU</th>
                  <th scope="col" className="num">Memory</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const up = c.State === "running";
                  const s = up ? byName.get(c.Names) : undefined;
                  const p = problems.get(c.Names)?.[0];
                  return (
                    <tr key={c.ID}>
                      <td>
                        <div className="name-cell">
                          <span className={up ? "sdot on" : "sdot"} aria-hidden="true" />
                          <button className="link-plain" onClick={() => setDetailId(c.ID)}>
                            <b className="clip">{c.Names}</b>
                            <span className="mono clip sub">{c.Image}</span>
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className="clip status-text">{stripHealth(c.Status)} <HealthBadge status={healthFromStatus(c.Status)} /></span>
                        {p && <span className={`plevel ${p.level} clip sub`} title={p.detail}>{p.title}</span>}
                      </td>
                      <td><PortLinks ports={c.Ports} running={up} name={c.Names} /></td>
                      <td className="num mono">{s ? s.CPUPerc : "–"}</td>
                      <td className="num mono">{s ? formatBytes(parseUsage(s.MemUsage).used) : "–"}</td>
                      <td className="row-actions">
                        {up ? (
                          <>
                            <IconButton label={`Restart ${c.Names}`} icon="restart" onClick={() => act(["restart", c.ID])} />
                            <IconButton label={`Stop ${c.Names}`} icon="stop" onClick={() => act(["stop", c.ID])} />
                          </>
                        ) : (
                          <IconButton label={`Start ${c.Names}`} icon="play" onClick={() => act(["start", c.ID])} />
                        )}
                        <IconButton label={`Remove ${c.Names}`} icon="trash" danger onClick={async () => (await confirm(`Remove container "${c.Names}"?`)) && act(["rm", "-f", c.ID])} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {all.length > 0 && rows.length === 0 && <p className="hint pad">No container matches.</p>}
        </>
      )}

      {picking && ctx && (
        <RunPicker ctx={ctx} onClose={() => setPicking(false)} onPick={(ref) => { setPicking(false); setRunImage(ref); }} />
      )}
      {runImage && ctx && (
        <RunPanel ctx={ctx} arch={profile.arch} image={runImage} onClose={() => setRunImage(null)} onRan={(id) => { setRunImage(null); setDetailId(id); }} />
      )}
    </div>
  );
}

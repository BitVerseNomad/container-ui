// The home screen: the VM in one line, then every container in one table (like Docker Desktop).
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { formatBytes, parseUsage } from "./containerInfo";
import { DfRow, StatRow, parseDf, sumStats } from "./lib/usage";
import { Banner, EmptyState, useConfirm } from "./ui";
import Card from "./ui/Card";
import IconButton from "./ui/IconButton";
import PortLinks from "./ui/PortLinks";
import { Group, groupByProject, isKubeOwned, kubeName } from "./lib/compose";
import { Icon } from "./ui/icons";
import Menu from "./ui/Menu";
import VmStrip from "./VmStrip";
import { useHostSize } from "./useHostSize";
import RunPicker from "./RunPicker";
import RunPanel from "./RunPanel";
import ComposeProjects from "./ComposeProjects";
import { ComposeScan } from "./useComposeScan";
import ContainerDetail from "./ContainerDetail";
import { HealthBadge, stripHealth } from "./Health";
import { Problem, healthFromStatus, parseState, problemsFor } from "./lib/health";

type VmOp = { op: "starting" | "stopping"; cmd: string; args: Record<string, unknown> };
// `last` lives here, not in this screen, so Retry still repeats the right command after the screen remounts.
export type VmState = { op: "starting" | "stopping" | null; failure: string | null; last?: VmOp };
// Below this, freeing space is not worth a line on the home screen.
const FREEABLE_NUDGE = 1024 ** 3;
const KUBE_KEY = "\u0000kubernetes";
type C = { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string; Labels?: string };
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
  compose: ComposeScan;
  onImages: () => void;
  // Set only while the profile shows its Kubernetes tab.
  onKubernetes?: () => void;
};

export default function Containers({ profile, ctx, vm, onVm, reload, detailId, setDetailId, onPull, onProfiles, compose, onImages, onKubernetes }: Props) {
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
  const [composeOpen, setComposeOpen] = useState(false);
  const [runImage, setRunImage] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Kubernetes pods start folded: there are many of them and they are managed from the Kubernetes tab.
  const [closed, setClosed] = useState<Set<string>>(new Set([KUBE_KEY]));
  const toggle = (k: string | null) => k && setClosed((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const allBox = useRef<HTMLInputElement>(null);
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
  const size = useHostSize();
  // An existing profile keeps its saved size; only the very first VM is sized from the Mac.
  const start = () => vmAct("starting", "start_profile", { opts: profile ? { name: profile.name } : { name: "default", ...size } });

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
  const groups = groupByProject(rows);
  const groupKey = (g: Group<C>) => (g.kind === "kubernetes" ? KUBE_KEY : g.project);
  // Only rows on screen count: not filtered out, not gone, and not inside a folded group.
  const selectable = groups.filter((g) => !closed.has(groupKey(g) ?? "")).flatMap((g) => g.rows).filter((c) => !isKubeOwned(c));
  const chosen = selectable.filter((c) => picked.has(c.ID));
  const pick = (ids: string[], on: boolean) => setPicked((s) => { const n = new Set(s); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  async function bulk(args: string[], list: C[]) {
    if (!list.length) return;
    await act([...args, ...list.map((c) => c.ID)]);
    setPicked(new Set());
  }
  // A partly ticked header box says "some, not all"; React has no prop for it.
  useEffect(() => {
    if (allBox.current) allBox.current.indeterminate = chosen.length > 0 && chosen.length < selectable.length;
  });

  if (detailId && ctx) return <ContainerDetail ctx={ctx} id={detailId} onBack={() => setDetailId(null)} />;

  if (!profile) {
    return (
      <Card className="start-first">
        <h2>Start your first VM</h2>
        <p className="hint">Colima needs a small Linux VM to run containers. The defaults work for most people.</p>
        <div className="actions-inline">
          <button className="primary" disabled={busy} onClick={start}>{busy ? "Starting…" : size ? `Start Colima (${size.cpus} CPUs, ${size.memory} GiB)` : "Start Colima"}</button>
          <button onClick={onProfiles}>Customize first</button>
        </div>
        {vm.failure && <Banner error={vm.failure} />}
      </Card>
    );
  }

  const grouped = groups.some((g) => g.kind !== "loose");
  const allPicked = selectable.length > 0 && chosen.length === selectable.length;
  const live = chosen.filter((c) => c.State === "running");
  const stopped = chosen.filter((c) => c.State !== "running");
  // rm -f kills running containers without asking, so the question says so.
  const removeAsk = () => {
    const names = chosen.map((c) => c.Names);
    const list = names.length > 5 ? `${names.slice(0, 5).join(", ")} and ${names.length - 5} more` : names.join(", ");
    const n = names.length === 1 ? "1 container" : `${names.length} containers`;
    const who = live.length === chosen.length ? (live.length === 1 ? "It is" : "They are") : live.length === 1 ? "1 of them is" : `${live.length} of them are`;
    const why = live.length ? ` ${who} running and will be stopped first.` : "";
    return `${live.length ? "Stop and remove" : "Remove"} ${n}? ${list}.${why} This can't be undone.`;
  };
  const groupLabel = (g: Group<C>) => (g.kind === "kubernetes" ? "Kubernetes pods" : g.project ?? "Other containers");
  const composeCount = compose.paths ? new Set(compose.paths.map((x) => x.slice(0, x.lastIndexOf("/")))).size : null;
  const renderRow = (c: C) => {
                  const up = c.State === "running";
                  const s = up ? byName.get(c.Names) : undefined;
                  const p = problems.get(c.Names)?.[0];
                  const kube = isKubeOwned(c);
                  return (
                    <tr key={c.ID} className={picked.has(c.ID) && !kube ? "picked" : undefined}>
                      <td className="pick">
                        {!kube && <input type="checkbox" aria-label={`Select ${c.Names}`} checked={picked.has(c.ID)} onChange={(e) => pick([c.ID], e.target.checked)} />}
                      </td>
                      <td>
                        <div className="name-cell">
                          <span className={p ? `sdot ${p.level}` : up ? "sdot on" : "sdot"} aria-hidden="true" />
                          <button className="link-plain one-line" aria-label={`${c.Names}, image ${c.Image}`} title={kube ? c.Names : `${c.Names} · ${c.Image}`} onClick={() => setDetailId(c.ID)}>
                            <b>{kube ? kubeName(c) : c.Names}</b>
                            <span className="mono sub">{c.Image}</span>
                          </button>
                        </div>
                      </td>
                      <td>
                        {p ? (
                          <span className={`plevel ${p.level} clip status-text`} title={`${stripHealth(c.Status)}. ${p.detail}`}>{p.title}</span>
                        ) : (
                          <span className="clip status-text">{stripHealth(c.Status)} <HealthBadge status={healthFromStatus(c.Status)} /></span>
                        )}
                      </td>
                      <td><PortLinks ports={c.Ports} running={up} name={c.Names} /></td>
                      <td className="num mono">{s ? s.CPUPerc : "–"}</td>
                      <td className="num mono">{s ? formatBytes(parseUsage(s.MemUsage).used) : "–"}</td>
                      <td className="row-actions">
                        <span className="row-tools">
                        <IconButton label={`Logs for ${c.Names}`} icon="logs" onClick={() => setDetailId(c.ID)} />
                        {up && !kube && <IconButton label={`Open a shell in ${c.Names}`} icon="terminal" onClick={() => invoke("open_terminal", { kind: "shell", context: ctx, target: c.Names }).catch((e) => setErr(String(e)))} />}
                        {kube ? null : up ? (
                          <>
                            <IconButton label={`Restart ${c.Names}`} icon="restart" onClick={() => act(["restart", c.ID])} />
                            <IconButton label={`Stop ${c.Names}`} icon="stop" onClick={() => act(["stop", c.ID])} />
                          </>
                        ) : (
                          <IconButton label={`Start ${c.Names}`} icon="play" onClick={() => act(["start", c.ID])} />
                        )}
                        {!kube && <IconButton label={`Remove ${c.Names}`} icon="trash" danger onClick={async () => (await confirm(`Remove container "${c.Names}"?`)) && act(["rm", "-f", c.ID])} />}
                        </span>
                      </td>
                    </tr>
                  );
  };
  return (
    <div className="home">
      <VmStrip
        profile={profile}
        startInCard={!running && !vm.op && !vm.failure}
        totals={running ? { cores: sums.cores, memBytes: sums.memBytes, diskBytes: disk.totalBytes } : null}
        op={vm.op}
        failure={vm.failure}
        failedOp={vm.last?.op}
        onStart={start}
        onRetry={() => (vm.last ? vmAct(vm.last.op, vm.last.cmd, vm.last.args) : start())}
        onStop={() => vmAct("stopping", "stop_profile", { name: profile.name })}
        onRestart={() => vmAct("starting", "restart_profile", { name: profile.name })}
        onForce={() => vmAct("starting", "force_restart_profile", { name: profile.name })}
        onForceStop={() => vmAct("stopping", "force_stop_profile", { name: profile.name })}
      />

      {!running && !vm.op && !vm.failure && (
        <Card className="stopped-card">
          <h2>{profile.name} is stopped</h2>
          <p className="hint">Your containers, images and volumes are kept inside it. Start it to see them.</p>
          <div><button className="primary" onClick={start}>{`Start ${profile.name}`}</button></div>
        </Card>
      )}

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
            <span className="toolbar-actions page-action">
              <Menu
                label="New"
                primary
                items={[
                  { label: "Run image", icon: <Icon name="play" size={13} />, onSelect: () => setPicking(true) },
                  { label: "Pull image", icon: <Icon name="download" size={13} />, onSelect: onPull },
                  { label: "Compose projects", icon: <Icon name="folder" size={13} />, hint: composeCount ? `${composeCount} on this Mac` : undefined, onSelect: () => setComposeOpen(true) },
                ]}
              >
                <Icon name="plus" size={13} /> New <Icon name="chevron" size={12} />
              </Menu>
            </span>
          </div>
          <Banner error={containers.error ?? err} onClose={() => setErr(null)} />
          {containers.data && all.length === 0 ? (
            <EmptyState title="No containers yet">Press Run image to start your first one.</EmptyState>
          ) : (
            <table className={chosen.length ? "list ctr picking" : "list ctr"}>
              <thead>
                <tr>
                  <th scope="col" className="pick">
                    <input ref={allBox} type="checkbox" aria-label="Select all shown containers" disabled={!selectable.length} checked={allPicked} onChange={(e) => pick(selectable.map((c) => c.ID), e.target.checked)} />
                  </th>
                  <th scope="col">Name</th>
                  <th scope="col">Status</th>
                  <th scope="col">Ports</th>
                  <th scope="col" className="num">CPU</th>
                  <th scope="col" className="num">Memory</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              {groups.map((g) => {
                const key = groupKey(g);
                const shut = key !== null && closed.has(key);
                const up = g.rows.filter((c) => c.State === "running");
                return (
                  <tbody key={key ?? "-"}>
                    {grouped && (
                      <tr className="group-row">
                        <th colSpan={7} scope="rowgroup">
                          <span className="group-head">
                            <button className="link-plain group-toggle" aria-expanded={!shut} onClick={() => toggle(key)}>
                              <span aria-hidden="true">{shut ? "▸" : "▾"}</span> <b>{groupLabel(g)}</b>
                            </button>
                            {g.kind === "kubernetes" ? (
                              <span className="hint">
                                {g.rows.length} containers. The cluster restarts them, so manage them {onKubernetes ? <>in the <button className="link-plain inline-link" onClick={onKubernetes}>Kubernetes tab</button></> : "with kubectl"}.
                              </span>
                            ) : (
                              <span className="hint">{up.length} of {g.rows.length} running{g.dir ? ` · ${g.dir.replace(/^\/Users\/[^/]+/, "~")}` : ""}</span>
                            )}
                            {g.kind === "compose" && (
                              <span className="row-actions">
                                {up.length < g.rows.length && <IconButton label={`Start all in ${g.project}`} icon="play" onClick={() => act(["start", ...g.rows.filter((c) => c.State !== "running").map((c) => c.ID)])} />}
                                {up.length > 0 && <IconButton label={`Restart all in ${g.project}`} icon="restart" onClick={() => act(["restart", ...up.map((c) => c.ID)])} />}
                                {up.length > 0 && <IconButton label={`Stop all in ${g.project}`} icon="stop" onClick={() => act(["stop", ...up.map((c) => c.ID)])} />}
                              </span>
                            )}
                          </span>
                        </th>
                      </tr>
                    )}
                    {!shut && g.rows.map(renderRow)}
                  </tbody>
                );
              })}
            </table>
          )}
          {all.length > 0 && rows.length === 0 && <p className="hint pad">No container matches.</p>}
          {chosen.length > 0 && (
            <div className="bulk-bar" role="region" aria-label="Selected containers">
              <b>{chosen.length} selected</b>
              <button disabled={!stopped.length} onClick={() => bulk(["start"], stopped)}><Icon name="play" size={13} /> Start</button>
              <button disabled={!live.length} onClick={() => bulk(["restart"], live)}><Icon name="restart" size={13} /> Restart</button>
              <button disabled={!live.length} onClick={() => bulk(["stop"], live)}><Icon name="stop" size={13} /> Stop</button>
              <button className="danger" onClick={async () => (await confirm(removeAsk(), live.length ? "Stop and remove" : "Remove")) && bulk(["rm", "-f"], chosen)}>
                <Icon name="trash" size={13} /> Remove
              </button>
              <button className="link-plain bulk-clear" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
          )}
          {disk.freeableBytes >= FREEABLE_NUDGE && (
            <div className="nudge">
              <Icon name="info" size={14} />
              <span>About {formatBytes(disk.freeableBytes)} inside the VM can be freed from unused images and build cache.</span>
              <button className="link-plain nudge-go" onClick={onImages}>Free up space</button>
            </div>
          )}
        </>
      )}

      {composeOpen && ctx && <ComposeProjects ctx={ctx} scan={compose} containers={all} onClose={() => setComposeOpen(false)} />}
      {picking && ctx && (
        <RunPicker ctx={ctx} onClose={() => setPicking(false)} onPick={(ref) => { setPicking(false); setRunImage(ref); }} />
      )}
      {runImage && ctx && (
        <RunPanel ctx={ctx} arch={profile.arch} image={runImage} onClose={() => setRunImage(null)} onRan={(id) => { setRunImage(null); setDetailId(id); }} />
      )}
    </div>
  );
}

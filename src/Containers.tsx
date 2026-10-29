// The home screen: your apps, one row each (a Compose project, a loose container, or Kubernetes), with one main
// button and a "..." menu for the rest. Problems show once, under their row. Everything deeper lives one click in.
import { openShell } from "./lib/shell";
import { activity, dockerLine, ranVm } from "./lib/activity";
import { score } from "./lib/fuzzy";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, useConfirm } from "./ui";
import Card from "./ui/Card";
import Drawer from "./ui/Drawer";
import { CopyPort, WebPort } from "./ui/PortLinks";
import { portLinksFromPs } from "./containerInfo";
import { isWebPort } from "./lib/webPort";
import { kubeName } from "./lib/compose";
import { App, appState, appsFrom, finished } from "./lib/homeRows";
import { Icon } from "./ui/icons";
import "./home.css";
import Menu from "./ui/Menu";
import type { MenuItem } from "./ui/Menu";
import VmStrip from "./VmStrip";
import { useHostSize } from "./useHostSize";
import RunPicker from "./RunPicker";
import RunPanel from "./RunPanel";
import { ResizeOr, resizeLine, resizeState, resizing, useResize } from "./Resize";
import ComposeProjects, { composeRunState, runCompose, useComposeRun } from "./ComposeProjects";
import type { Action } from "./ComposeProjects";
import ComposeLogs from "./ComposeLogs";
import { ComposeScan } from "./useComposeScan";
import ContainerDetail from "./ContainerDetail";
import type { Finding, Report } from "./lib/doctor";
import { setMuted } from "./lib/muted";
import { fixAction, useFixRuns } from "./FixIt";
import { biggerFix } from "./lib/sharedFix";
import { plain } from "./ui/Ticks";
import { describe } from "./lib/fixRun";
import { busy as fixBusy, dismiss, runFor } from "./lib/fixStore";
import type { Run } from "./lib/fixStore";

// "restarting": the VM size fix (src/Resize.tsx), a stop and a start with new settings.
type VmOp = { op: "starting" | "stopping" | "restarting"; cmd: string; args: Record<string, unknown> };
// `last` lives here, not in this screen, so Retry still repeats the right command after the screen remounts.
export type VmState = { op: VmOp["op"] | null; failure: string | null; last?: VmOp };
type C = { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string; Labels?: string };
// From this many apps a search field earns its place; below it the list is the search.
const SEARCH_AT = 7;
// A Start or Stop that the poll never confirms stops saying "Starting…" after this long.
const PENDING_MS = 30_000;
type Pending = { target: "running" | "stopped"; word: string; since: number };

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
  // The Doctor's checks, shared with the Doctor page and its badge, so a problem is found once and counted once.
  report: Report | null;
  onReport: () => void;
};

// The main button's label each row last showed, kept across tabs, so a VM size change doesn't flip it while it runs.
const seenVerb = new Map<string, "Start" | "Stop">();

export default function Containers({ profile, ctx, vm, onVm, reload, detailId, setDetailId, onPull, onProfiles, compose, onImages, onKubernetes, report, onReport }: Props) {
  const runs = useFixRuns();
  const confirm = useConfirm();
  const composeRun = useComposeRun();
  const running = !!ctx;
  const containers = usePoll<C[]>(async () => (ctx ? dockerJson<C>(ctx, ["ps", "-a"]) : []), [ctx], 3000);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [logsOf, setLogsOf] = useState<App<C> | null>(null);
  const [runImage, setRunImage] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOpen((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const [pending, setPending] = useState<Map<string, Pending>>(new Map());
  const [failed, setFailed] = useState<Map<string, string>>(new Map());
  // Read aloud by VoiceOver: what just finished, or what went wrong. Both regions exist from the first render,
  // because WebKit often skips a live region that appears with its text already in it.
  const [said, setSaidNow] = useState({ status: "", alert: "" });
  // Cleared first, so the same words twice in a row ("shop restarted") are still read the second time.
  const setSaid = (next: { status: string; alert: string }) => { setSaidNow({ status: "", alert: "" }); setTimeout(() => setSaidNow(next), 50); };
  async function vmAct(op: VmOp["op"], cmd: string, args: Record<string, unknown>) {
    const last = { op, cmd, args };
    onVm({ op, failure: null, last });
    try {
      await ranVm(cmd, args, () => invoke(cmd, args));
      onVm({ op: null, failure: null, last });
    } catch (e) {
      onVm({ op: null, failure: String(e), last });
    }
    reload();
  }
  const size = useHostSize();
  // An existing profile keeps its saved size; only the very first VM is sized from the Mac.
  const start = () => vmAct("starting", "start_profile", { opts: profile ? { name: profile.name } : { name: "default", ...size } });

  const all = useMemo(() => containers.data ?? [], [containers.data]);
  const apps = useMemo(() => appsFrom(all, compose.paths ?? []), [all, compose.paths]);
  const allRef = useRef(all);
  const appsRef = useRef(apps);
  allRef.current = all;
  appsRef.current = apps;
  // Only what needs action shows on home; the rest is "worth knowing" on the Doctor page and the container's own page.
  const problems = useMemo(() => {
    const m = new Map<string, Finding[]>();
    for (const [n, l] of report?.byContainer ?? []) {
      const act = l.filter((f) => f.severity === "action");
      if (act.length) m.set(n, act);
    }
    return m;
  }, [report]);
  const fixed = () => { containers.reload(); onReport(); };
  const inDir = (a: App<C>, dir: string | undefined) => !!a.dir && !!dir && a.dir.toLowerCase() === dir.toLowerCase();
  const unpend = (key: string) => setPending((m) => { if (!m.has(key)) return m; const n = new Map(m); n.delete(key); return n; });
  const unfail = (key: string) => setFailed((m) => { if (!m.has(key)) return m; const n = new Map(m); n.delete(key); return n; });

  // A pending Start or Stop clears once the list shows it happened, or after a while either way.
  // No state word changes ahead of Docker: the row says "Starting…" until `docker ps` agrees.
  useEffect(() => {
    if (!pending.size) return;
    const now = Date.now();
    const next = new Map([...pending].filter(([key, p]) => {
      const a = apps.find((x) => x.key === key);
      if (!a || now - p.since > PENDING_MS) return false;
      const s = appState(a.rows).state;
      return p.target === "running" ? s !== "running" : s !== "stopped";
    }));
    if (next.size !== pending.size) setPending(next);
  }, [apps, pending]);

  // A good fix result shows for half a minute (long enough for a broker to come up), then the row is back to normal.
  // Each good run is scheduled once: the polls make new objects every few seconds and must not restart the clock.
  const scheduled = useRef(new WeakSet<Run>());
  useEffect(() => {
    for (const r of runs) {
      if (r.result?.ok && !scheduled.current.has(r)) {
        scheduled.current.add(r);
        setTimeout(() => dismiss(r.names[0]), 30_000);
      }
    }
  }, [runs]);

  // A Compose run that failed shows under its project's row and is read out; the drawer shares the same store.
  // Kept by object, not by text: a retry that fails the same way is a new failure.
  const lastFailed = useRef<object | null>(null);
  useEffect(() => {
    const f = composeRun.failed;
    if (!f || lastFailed.current === f) return;
    lastFailed.current = f;
    const a = apps.find((x) => inDir(x, f.dir) && (x.files.length > 0));
    if (a) {
      unpend(a.key);
      setSaid({ status: "", alert: `${a.name} didn't ${DID[f.action]}. ${f.why ?? firstLine(f.text)}` });
    }
  }, [composeRun.failed, apps]);

  // One rule for every button on a row: nothing else is changing it right now.
  // While the VM restarts for a new size and its containers start again, nothing here may touch them.
  const rs = useResize();
  // When a resize has started everything again, read the list at once: the next poll would show "Stopped" for a moment.
  // Until that read is back the rows keep saying Restarting…, so none shows "Stopped" for a moment.
  const wasResizing = useRef(false);
  const [settling, setSettling] = useState(false);
  useEffect(() => {
    if (wasResizing.current && !resizing(rs)) { setSettling(true); void containers.reload().finally(() => setSettling(false)); }
    wasResizing.current = resizing(rs);
  }, [rs]); // eslint-disable-line react-hooks/exhaustive-deps
  // The render right after the run ends comes before that effect, so it counts too.
  const holding = resizing(rs) || settling || wasResizing.current;
  const canAct = (a: App<C>) => !composeRunState().busy && vm.op === null && resizeState().progress === null && !pending.has(a.key) && !a.rows.some((c) => fixBusy(runs, c.Names));

  async function act(a: App<C>, args: string[], p: Pending | null, done: string) {
    if (!canAct(a) || !ctx) return;
    if (p) { setPending((m) => new Map(m).set(a.key, p)); setSaid({ status: `${p.word.replace("…", "")} ${a.name}…`, alert: "" }); }
    unfail(a.key);
    // Logged with names, as you'd type it; the call itself uses IDs, which can't be mistaken.
    const shown = args.map((x) => all.find((c) => c.ID === x)?.Names ?? x);
    try {
      await activity.ran(args[0], dockerLine(ctx, shown), () => docker(ctx, args), a.name);
      setSaid({ status: done, alert: "" });
    } catch (e) {
      fail(a, String(e));
    }
    containers.reload();
  }
  function fail(a: App<C>, text: string) {
    unpend(a.key);
    setFailed((m) => new Map(m).set(a.key, text));
    setSaid({ status: "", alert: `${a.name} failed. ${firstLine(text)}` });
  }
  // A project whose Compose file is known runs `docker compose`, as typing it in its folder would. Without the file
  // (the folder moved, or it was started some other way) the same verb goes to its containers directly.
  async function project(a: App<C>, action: Action, p: Pending | null, done: string) {
    if (!canAct(a) || !ctx) return;
    if (!a.dir || !a.files.length) {
      const ids = a.rows.map((c) => c.ID);
      return act(a, action === "down" ? ["rm", "-f", ...ids] : [action === "up" ? "start" : action, ...ids], p, done);
    }
    if (p) { setPending((m) => new Map(m).set(a.key, p)); setSaid({ status: `${p.word.replace("…", "")} ${a.name}…`, alert: "" }); }
    unfail(a.key);
    const ran = await runCompose(ctx, { dir: a.dir, files: a.files, name: a.name }, action, all);
    const f = composeRunState().failed;
    if (!ran || (f && inDir(a, f.dir))) unpend(a.key);
    else setSaid({ status: done, alert: "" });
    containers.reload();
  }

  // After a Remove the row's "…" button is gone; focus moves to the row now in its place (or the one above it),
  // never to the page body.
  const removing = useRef<{ gone: () => boolean; at: number } | null>(null);
  useEffect(() => {
    const r = removing.current;
    if (!r || !r.gone()) return;
    removing.current = null;
    requestAnimationFrame(() => {
      const names = [...document.querySelectorAll<HTMLElement>(".app-name")];
      (names[Math.min(r.at, names.length - 1)] ?? document.querySelector<HTMLElement>(".home-new"))?.focus();
    });
  }, [all]);
  const willRemove = (gone: () => boolean, key: string) => { removing.current = { gone, at: Math.max(0, apps.findIndex((x) => x.key === key)) }; };

  // Coming back from a container's page puts focus on the row it was opened from, not on the page body.
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (detailId) { opened.current = detailId; return; }
    const id = opened.current;
    opened.current = null;
    if (id) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-open="${CSS.escape(id)}"]`)?.focus());
  }, [detailId]);

  if (detailId && ctx) {
    const named = all.find((c) => c.ID === detailId || c.ID.startsWith(detailId) || c.Names === detailId)?.Names;
    return <ContainerDetail ctx={ctx} id={detailId} appProblems={named ? report?.extra.get(named) : undefined} onBack={() => setDetailId(null)} onReplaced={(n) => { setDetailId(n); fixed(); }} />;
  }

  if (!profile) {
    const busy = vm.op !== null;
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

  // Counted in containers: typing a port ("5432") to find who holds it is worth it long before there are 7 apps.
  const searching = all.length >= SEARCH_AT;
  const term = searching ? q.trim() : "";
  // A number finds whatever publishes that port ("8080" finds web on 0.0.0.0:8080->80).
  const hit = (c: C) => score(c.Names, term) > 0 || score(c.Image, term, false) > 0 || (/^\d{2,5}$/.test(term) && new RegExp(`(^|[ ,:])${term}->`).test(c.Ports ?? ""));
  const shown = term ? apps.filter((a) => score(a.name, term) > 0 || a.rows.some(hit)) : apps;
  const composeDirs = compose.paths ? [...new Set(compose.paths.map((x) => x.slice(0, x.lastIndexOf("/"))))] : [];
  // A search that finds nothing may be for a project that was never started, which only the Compose panel lists.
  const projectHits = term ? composeDirs.filter((d) => score(d.slice(d.lastIndexOf("/") + 1), term) > 0).length : 0;

  const problemsOf = (rows: C[]) => rows.flatMap((c) => {
    const p = problems.get(c.Names)?.[0];
    const run = runFor(runs, c.Names);
    return p || run ? [{ c, p, run }] : [];
  });

  // One line under a row: what is wrong, in plain words, and the one thing to do about it.
  const problemLine = ({ c, p, run }: { c: C; p?: Finding; run?: Run }, prefix: boolean) => {
    const who = prefix ? `${c.Names} · ` : "";
    const see = <button className="small" onClick={() => setDetailId(c.ID)} aria-label={`See why: ${c.Names}`}>See why</button>;
    if (run?.step) return <Line key={c.ID} level="busy" text={`${who}${run.step}`} action={<button className="small" aria-disabled="true">Fixing…</button>} />;
    const r = run?.result;
    if (r?.ok) {
      // A broker needs a little while after a restart, and an app that looks for it shows nothing until then.
      const slow = /kafka/i.test(c.Image) ? " Kafka needs about 30 s to start." : "";
      return <Line key={c.ID} level="ok" text={`${who}Fixed.${slow}`} title={describe(r)} action={<button className="small" onClick={() => dismiss(c.Names)}>Done</button>} />;
    }
    if (!p) return r ? <Line key={c.ID} level="bad" text={`${who}The fix didn't finish.`} title={describe(r)} action={see} /> : null;
    // When this row's own fix replaces containers, a bigger fix that also replaces this one (Kafka UI's "fix both"
    // includes its broker) wins, so both rows offer the one fix that makes them work together.
    const shared = biggerFix(p.fix, [...problems.values()].flat().map((f) => f.fix));
    const fix = shared ?? p.fix;
    // That bigger fix gets one button, on the row that owns it; this row says where it is.
    const owner = shared ? [...problems].find(([, l]) => l.some((f) => f.fix === shared))?.[0] : undefined;
    if (shared && owner && owner !== c.Names) return <Line key={c.ID} level={p.level === "bad" ? "bad" : "warn"} text={`${who}${p.short ?? p.title}. Fixed together with ${owner}.`} title={plain(p.detail)} />;
    const one = fix ? fixAction(fix, ctx ?? undefined, confirm, runs, fixed) : null;
    const names = fix?.steps?.map((x) => x.name) ?? [];
    const said = p.short ?? p.title;
    // The line sits under the container's name, so "Its health check is failing" is "Health check is failing",
    // and after "api · " it is "health check is failing".
    const phrase = prefix ? said.replace(/^(It|Its) /, "").replace(/^./, (ch) => ch.toLowerCase()) : said.replace(/^Its (.)/, (_, ch: string) => ch.toUpperCase());
    const text = `${who}${r ? "The fix didn't finish. " : ""}${phrase}`;
    // "Fix" only where the app really repairs it; otherwise the button says what it does.
    // A container that ran out of memory: the one-click bigger VM, which starts it again after.
    const action = fix?.resize ? (
      <ResizeOr from={`home:${c.Names}:${p.id}`} title={`${p.short ?? p.title}, ${c.Names}`} need="memory" alsoStart={[c.Names]} fallback={see} noProfiles vmWords />
    ) : one ? (
      // A Fix replaces containers; while the VM stops or restarts there is no Docker to replace them in.
      <button className="small primary" aria-label={`${r ? "Try the fix again" : one.label}: ${p.short ?? p.title}, ${c.Names}`} aria-disabled={vm.op !== null || resizing(rs) || undefined} title={vm.op || resizing(rs) ? "Waits for the VM" : undefined} onClick={() => vm.op === null && !resizing(rs) && one.go()}>{r ? "Try again" : names.length > 1 ? `Fix ${names.join(" and ")}…` : `${one.label}…`}</button>
    ) : fix?.go === "Images" ? (
      <button className="small" onClick={onImages}>Open Images</button>
    ) : see;
    return <Line key={c.ID} level={p.level === "bad" ? "bad" : "warn"} text={text} title={plain(p.detail)} action={action} />;
  };

  const containerMenu = (c: C, a: App<C>): MenuItem[] => {
    const up = c.State === "running";
    const lock = !canAct(a);
    const p = problems.get(c.Names)?.[0];
    const inProject = a.kind === "compose";
    return [
      { label: "Logs", icon: <Icon name="logs" size={13} />, onSelect: () => setDetailId(c.ID) },
      ...(up ? [{ label: "Open a shell", icon: <Icon name="terminal" size={13} />, hint: "docker exec -it", disabled: lock, onSelect: () => void openShell(ctx!, c.Names).catch((e: unknown) => fail(a, e instanceof Error ? e.message : String(e))) }] : []),
      ...(up ? [{ label: "Restart", icon: <Icon name="restart" size={13} />, disabled: lock, onSelect: () => void act(a, ["restart", c.ID], null, `${c.Names} restarted`) }] : []),
      // Inside a project the row's main button acts on the whole project, so one service's Start and Stop live here.
      ...(inProject && up ? [{ label: "Stop", icon: <Icon name="stop" size={13} />, disabled: lock, onSelect: () => void act(a, ["stop", c.ID], null, `${c.Names} stopped`) }] : []),
      ...(inProject && !up ? [{ label: "Start", icon: <Icon name="play" size={13} />, disabled: lock, onSelect: () => void act(a, ["start", c.ID], null, `${c.Names} started`) }] : []),
      ...(p ? [{ label: "Not an issue", icon: <Icon name="check" size={13} />, onSelect: () => setMuted(p.key, true) }] : []),
      {
        label: "Remove…", icon: <Icon name="trash" size={13} />, danger: true, divider: true, disabled: lock,
        // rm -f kills a running container without asking, so the question says so.
        onSelect: async () => { if (await confirm(`Remove ${c.Names}?${up ? " It is running and will be stopped first." : ""} Its image and volumes stay.`, "Remove")) { willRemove(() => !allRef.current.some((x) => x.ID === c.ID), a.key); await act(a, ["rm", "-f", c.ID], null, `${c.Names} removed`); } },
      },
    ];
  };

  const projectMenu = (a: App<C>): MenuItem[] => {
    const lock = !canAct(a);
    const known = !!a.dir && a.files.length > 0;
    const anyUp = a.rows.some((c) => c.State === "running");
    const n = a.rows.length === 1 ? "container" : `${a.rows.length} containers`;
    // Exactly the stopped ones, by ID: `compose up -d` would also re-run jobs that already finished.
    const stopped = a.rows.filter((c) => c.State !== "running" && !finished(c));
    const what = stopped.length === 1 ? serviceName(stopped[0], a.name) : `the ${stopped.length} stopped`;
    return [
      ...(stopped.length && anyUp ? [{ label: `Start ${what}`, icon: <Icon name="play" size={13} />, hint: "docker start", disabled: lock, onSelect: () => void act(a, ["start", ...stopped.map((c) => c.ID)], { target: "running", word: "Starting…", since: Date.now() }, `${a.name} started`) }] : []),
      ...(known ? [{ label: "Rebuild", icon: <Icon name="hammer" size={13} />, hint: "compose up -d --build", disabled: lock, onSelect: () => void project(a, "build", { target: "running", word: "Rebuilding…", since: Date.now() }, `${a.name} rebuilt`) }] : []),
      ...(known ? [{ label: "Logs", icon: <Icon name="logs" size={13} />, hint: "compose logs -f", onSelect: () => setLogsOf(a) }] : []),
      ...(anyUp ? [{ label: "Restart", icon: <Icon name="restart" size={13} />, hint: known ? "compose restart" : undefined, disabled: lock, onSelect: () => void project(a, "restart", null, `${a.name} restarted`) }] : []),
      ...(known ? [{ label: "Show in Finder", icon: <Icon name="finder" size={13} />, onSelect: () => void invoke("reveal_compose", { path: `${a.dir}/${a.files[0]}` }).catch((e) => fail(a, String(e))) }] : []),
      {
        label: "Remove…", icon: <Icon name="trash" size={13} />, danger: true, divider: true, disabled: lock, ariaLabel: `Remove ${a.name}`,
        onSelect: async () => {
          const ask = `Remove ${a.name}'s ${n}${known ? " and its network" : ""}? Volumes, images${a.dir ? ` and ${tilde(a.dir)}` : ""} stay.${known ? " Start it again from New." : ""}`;
          if (await confirm(ask, "Remove")) { willRemove(() => !appsRef.current.some((x) => x.key === a.key), a.key); await project(a, "down", null, `${a.name} removed`); }
        },
      },
    ];
  };

  const row = (a: App<C>) => {
    const kube = a.kind === "kubernetes";
    const isProject = a.kind === "compose";
    const single = a.kind === "container" ? a.rows[0] : null;
    const { state, up, of } = appState(a.rows);
    const pend = pending.get(a.key);
    const mine = !!composeRun.busy && inDir(a, composeRun.busy.dir) && a.files.length > 0;
    // A VM size change restarts everything at once: the state column says so, and the button keeps the label the
    // user last saw, locked, until the list shows the real state again.
    const withVm = holding && !kube;
    const changing = withVm ? "Restarting…" : pend?.word ?? (mine ? ING[composeRun.busy!.action] : null);
    const expanded = open.has(a.key) || (!!term && isProject && a.rows.some(hit));
    const issues = problemsOf(a.rows);
    const word = kube ? `${a.rows.length} container${a.rows.length === 1 ? "" : "s"}` : changing ?? (state === "partly" ? `${up} of ${of} running` : state === "running" ? "Running" : "Stopped");
    // The mark column alone answers "is anything broken?": a problem wins over running or stopped.
    const mark = changing ? "busy" : !kube && issues.some((i) => i.p) ? markOf(issues) : kube || state === "running" ? "on" : state === "partly" ? "part" : "off";
    const ports = (isProject ? a.rows : single ? [single] : []).filter((c) => c.State === "running").flatMap((c) => portLinksFromPs(c.Ports).filter((l) => isWebPort(l.containerPort, l.port)));
    const web = ports[0];
    const lock = !canAct(a) || withVm;
    const startIt = () => (isProject
      ? project(a, "up", { target: "running", word: "Starting…", since: Date.now() }, `${a.name} started`)
      : act(a, ["start", single!.ID], { target: "running", word: "Starting…", since: Date.now() }, `${a.name} started`));
    const stopIt = () => (isProject
      ? project(a, "stop", { target: "stopped", word: "Stopping…", since: Date.now() }, `${a.name} stopped`)
      : act(a, ["stop", single!.ID], { target: "stopped", word: "Stopping…", since: Date.now() }, `${a.name} stopped`));
    // Anything running means the main button stops it; starting the rest of a partly running project is in its menu.
    const live = up > 0 ? "Stop" : "Start";
    if (!withVm) seenVerb.set(a.key, live);
    const verb = withVm ? seenVerb.get(a.key) ?? live : live;
    // One button element whose label changes, so keyboard focus stays put through Start, Starting… and Stop.
    const main = kube ? (
      onKubernetes ? <button className="main" onClick={onKubernetes} aria-label="Open the Kubernetes tab">Open</button> : <span />
    ) : (
      <button
        className="main"
        aria-disabled={lock || undefined}
        title={isProject && a.files.length ? `docker compose ${verb === "Stop" ? "stop" : "up -d"}` : undefined}
        aria-label={changing ? `${a.name}, ${changing}` : `${verb} ${a.name}`}
        aria-describedby={lock && !changing ? `why-${a.key}` : undefined}
        onClick={() => { if (!lock) void (verb === "Stop" ? stopIt() : startIt()); }}
      >
        {withVm ? verb : changing ?? verb}
      </button>
    );
    const failure = failed.get(a.key);
    const cf = composeRun.failed && inDir(a, composeRun.failed.dir) && a.files.length > 0 && !mine ? composeRun.failed : null;
    const holderApp = cf?.holder ? apps.find((x) => x.rows.some((c) => c.Names === cf.holder)) : undefined;
    return (
      <li key={a.key} className="app">
        <div className={`app-row${state === "stopped" && !changing && !kube ? " is-off" : ""}`}>
          <span className="app-chev">
            {isProject && (
              <button className={expanded ? "chev open" : "chev"} tabIndex={-1} aria-hidden="true" onClick={() => toggle(a.key)}>
                <Icon name="chevron" size={12} />
              </button>
            )}
          </span>
          <Mark kind={mark} />
          <button
            className="app-name"
            title={a.dir ? `${a.name} · ${tilde(a.dir)}` : single ? `${single.Names} · ${single.Image}` : a.name}
            aria-expanded={isProject ? expanded : undefined}
            aria-label={`${isProject ? `${a.name}, project` : kube ? "Kubernetes" : a.name}, ${word}${issues.length ? `, ${issues.length} problem${issues.length === 1 ? "" : "s"}` : ""}`}
            aria-controls={isProject ? `svc-${a.key}` : undefined}
            data-open={single?.ID}
            onClick={() => (isProject ? toggle(a.key) : kube ? onKubernetes?.() : setDetailId(single!.ID))}
          >
            {a.name}
          </button>
          <span className="app-port">
            {web && <WebPort port={web.port} label={`:${web.port}`} name={a.name} />}
            {ports.length > 1 && <span className="hint more-ports">+{ports.length - 1}</span>}
          </span>
          <span className="app-state" aria-hidden="true">{word}</span>
          {main}
          {kube ? <span /> : (
            <Menu label={`More actions for ${a.name}`} className="more" items={isProject ? projectMenu(a) : containerMenu(single!, a)}>
              <Icon name="more" size={16} />
            </Menu>
          )}
        </div>
        {cf && (
          <Line
            level="bad"
            text={`${a.name} didn't ${DID[cf.action]}. ${cf.why ?? firstLine(cf.text)}`}
            title={cf.text}
            action={cf.holder ? <button className="small primary" aria-disabled={lock || !holderApp || !canAct(holderApp) || undefined} onClick={async () => { if (lock || !holderApp || !canAct(holderApp)) return; await act(holderApp, ["stop", cf.holder!], null, `${cf.holder} stopped`); await startIt(); }}>Stop {cf.holder} and start</button> : undefined}
          />
        )}
        {failure && !cf && <Line level="bad" text={`${a.name}: ${firstLine(failure)}`} title={failure} action={<button className="small" onClick={() => unfail(a.key)}>Dismiss</button>} />}
        {lock && !changing && <span className="sr-only" id={`why-${a.key}`}>{a.rows.some((c) => fixBusy(runs, c.Names)) ? "A fix is running on it." : vm.op ? "The VM is changing." : "Another action is running."}</span>}
        {!expanded && !kube && issues.map((i) => problemLine(i, isProject))}
        {isProject && expanded && (
          <ul className="svc" id={`svc-${a.key}`} aria-label={`Services of ${a.name}`}>
            {a.rows.filter((c) => !term || hit(c) || score(a.name, term) > 0).map((c) => {
              const cUp = c.State === "running";
              const i = issues.find((x) => x.c.ID === c.ID);
              const cWord = cUp ? "Running" : /^Exited \(0\)/.test(c.Status) ? "Finished" : "Stopped";
              return (
                <li key={c.ID}>
                  <div className="svc-row">
                    <Mark kind={i?.p ? markOf([i]) : cUp ? "on" : "off"} small />
                    <button className="svc-name" data-open={c.ID} title={`${c.Names} · ${c.Image}`} aria-label={`${c.Names}, ${cWord}${i?.p ? ", 1 problem" : ""}`} onClick={() => setDetailId(c.ID)}>
                      {serviceName(c, a.name)} <span className="svc-image">{c.Image}</span>
                    </button>
                    <span className="svc-ports">
                      {cUp && portLinksFromPs(c.Ports).slice(0, 3).map((l) => (isWebPort(l.containerPort, l.port) ? <WebPort key={l.label} port={l.port} label={`:${l.port}`} name={c.Names} /> : <CopyPort key={l.label} label={l.label} />))}
                    </span>
                    <span className="app-state" aria-hidden="true">{cWord}</span>
                    <Menu label={`More actions for ${c.Names}`} className="more" items={containerMenu(c, a)}>
                      <Icon name="more" size={16} />
                    </Menu>
                  </div>
                  {i && problemLine(i, false)}
                </li>
              );
            })}
          </ul>
        )}
      </li>
    );
  };

  const showStrip = !!vm.op || !!vm.failure;
  return (
    <div className="home">
      <div className="sr-only" role="status" aria-live="polite">{said.status}</div>
      <div className="sr-only" role="alert">{said.alert}</div>
      {/* The VM only takes space here while it changes or fails; its Start, Stop and Restart live in the profile menu. */}
      {showStrip && (
        <VmStrip
          profile={profile}
          totals={null}
          op={vm.op}
          failure={vm.failure}
          failedOp={vm.last?.op}
          onStart={start}
          onRetry={() => (vm.last ? vmAct(vm.last.op, vm.last.cmd, vm.last.args) : start())}
          fixing={runs.some((r) => r.step != null)}
          line={vm.op === "restarting" ? resizeLine(rs) || undefined : undefined}
          onStop={() => vmAct("stopping", "stop_profile", { name: profile.name })}
          onRestart={() => vmAct("starting", "restart_profile", { name: profile.name })}
          onForce={() => vmAct("starting", "force_restart_profile", { name: profile.name })}
          onForceStop={() => vmAct("stopping", "force_stop_profile", { name: profile.name })}
        />
      )}

      {!running && !vm.op && !vm.failure && (
        <Blank title={<>The VM &ldquo;{profile.name}&rdquo; is stopped</>} body="Your containers, images and volumes are kept inside it.">
          <button className="primary" onClick={start}>Start VM</button>
        </Blank>
      )}

      {running && (
        <>
          <span className="toolbar-actions page-action">
            <Menu
              label="New"
              primary
              className="home-new"
              items={[
                { label: "Run an image…", icon: <Icon name="play" size={13} />, onSelect: () => setPicking(true) },
                { label: "Pull an image…", icon: <Icon name="download" size={13} />, onSelect: onPull },
                { label: "Start a Compose project…", icon: <Icon name="folder" size={13} />, onSelect: () => setComposeOpen(true) },
              ]}
            >
              <Icon name="plus" size={13} /> New <Icon name="chevron" size={12} />
            </Menu>
          </span>
          <Banner error={containers.error} />
          {searching && (
            <label className="search-field home-search">
              <Icon name="search" size={14} />
              <input placeholder="Search by name, image or port" aria-label="Search containers" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          )}
          {containers.data && all.length === 0 ? (
            <Blank title="No containers yet" body="Run an image, or start a Compose project from a folder on your Mac.">
              <button className="primary" onClick={() => setPicking(true)}>Run an image</button>
              <button onClick={() => setComposeOpen(true)}>Start a Compose project</button>
            </Blank>
          ) : (
            <ul className="apps" aria-label="Containers">{shown.map(row)}</ul>
          )}
          {term && shown.length === 0 && (
            <p className="hint pad">
              Nothing matches &ldquo;{term}&rdquo;.
              {projectHits > 0 && <> {projectHits === 1 ? "1 Compose project that isn't running matches" : `${projectHits} Compose projects that aren't running match`}. <button className="link" onClick={() => setComposeOpen(true)}>Show {projectHits === 1 ? "it" : "them"}</button></>}
            </p>
          )}
        </>
      )}

      {composeOpen && ctx && <ComposeProjects ctx={ctx} scan={compose} containers={all} attention={problems} query={term && shown.length === 0 ? term : ""} onClose={() => setComposeOpen(false)} onChanged={fixed} />}
      {logsOf && ctx && logsOf.dir && (
        <Drawer label={`Logs of ${logsOf.name}`} title={<>Logs of {logsOf.name}</>} onClose={() => setLogsOf(null)}>
          <ComposeLogs ctx={ctx} file={`${logsOf.dir}/${logsOf.files[0]}`} project={logsOf.name} />
        </Drawer>
      )}
      {picking && ctx && <RunPicker ctx={ctx} onClose={() => setPicking(false)} onPick={(ref) => { setPicking(false); setRunImage(ref); }} />}
      {runImage && ctx && <RunPanel ctx={ctx} arch={profile.arch} image={runImage} onClose={() => setRunImage(null)} onRan={(id) => { setRunImage(null); setDetailId(id); }} />}
    </div>
  );
}

const ING: Record<Action, string> = { up: "Starting…", stop: "Stopping…", restart: "Restarting…", down: "Removing…", build: "Rebuilding…", pull: "Updating…" };
const DID: Record<Action, string> = { up: "start", stop: "stop", restart: "restart", down: "go away", build: "rebuild", pull: "update" };
const tilde = (dir: string) => dir.replace(/^\/Users\/[^/]+/, "~");
const firstLine = (t: string) => t.split("\n").map((l) => l.trim()).find(Boolean) ?? t;
// "shop-web-1" reads as "web" inside the shop project; a container named some other way keeps its name.
const serviceName = (c: C, project: string) => {
  const svc = /(?:^|,)com\.docker\.compose\.service=([^,]+)/.exec(c.Labels ?? "")?.[1];
  return svc ?? (c.Names.startsWith(`${project}-`) ? c.Names.slice(project.length + 1).replace(/-\d+$/, "") : kubeName(c));
};

// The state as a shape as well as a color, so it reads the same to someone who can't tell red from green.
// A bad problem (crashed, out of memory) shows ✕; anything else that needs action shows the warning sign.
const markOf = (issues: { p?: Finding }[]) => (issues.some((i) => i.p?.level === "bad") ? "bad" : "warn");

function Mark({ kind, small }: { kind: "on" | "off" | "part" | "bad" | "warn" | "busy"; small?: boolean }) {
  if (kind === "bad") return <span className="mark bad" aria-hidden="true"><Icon name="close" size={small ? 11 : 13} /></span>;
  if (kind === "warn") return <span className="mark warn" aria-hidden="true"><Icon name="alert" size={small ? 11 : 13} /></span>;
  if (kind === "busy") return <span className="mark" aria-hidden="true"><span className="spin" /></span>;
  return <span className="mark" aria-hidden="true"><span className={`dot ${kind}${small ? " small" : ""}`} /></span>;
}

function Line({ level, text, title, action }: { level: "bad" | "warn" | "ok" | "busy"; text: string; title?: string; action?: ReactNode }) {
  return (
    <div className={`problem ${level}`} title={title}>
      <Icon name={level === "ok" ? "check" : level === "bad" ? "close" : level === "busy" ? "restart" : "alert"} size={14} />
      <span className="problem-text">{text}</span>
      {action}
    </div>
  );
}

function Blank({ title, body, children }: { title: ReactNode; body: string; children: ReactNode }) {
  return (
    <div className="blank">
      <span className="blank-icon"><Icon name="box" size={32} /></span>
      <h2>{title}</h2>
      <p className="hint">{body}</p>
      <div className="actions-inline">{children}</div>
    </div>
  );
}

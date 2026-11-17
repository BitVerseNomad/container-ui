// The home screen: your apps, one row each (a Compose project, a loose container, or Kubernetes), with one main
// button and a "..." menu for the rest. Problems show once, under their row. Everything deeper lives one click in.
import { openShell } from "./lib/shell";
import { activity, dockerLine, ranVm } from "./lib/activity";
import { score } from "./lib/fuzzy";
import { ReactNode, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import VmStrip from "./VmStrip";
import { kubeName } from "./lib/compose";
import { appStoppedVersion, subscribeAppStopped } from "./lib/appStopped";
import { App, appState, appsFrom, downLine, finished, lastRunOver, listed, runInfo, startWhat, withAppStop } from "./lib/homeRows";
import { useHostSize } from "./useHostSize";
import RunPicker from "./RunPicker";
import RunPanel from "./RunPanel";
import { isListed, useLimitFlip, useOpenCompose, useServiceLimit } from "./Health";
import { flipSaid, raisedLine } from "./lib/composeLimit";
import type { ProblemFix } from "./lib/health";
import { undoLabel, wayBackNote } from "./lib/vmChange";
import type { VmChange } from "./lib/vmChange";
import { ResizeOr, ResizeStatus, VmChangeOr, addChangeRefresh, clearWayBack, resizeLine, resizing, startWayBack, useResize, useResizeEnv, wayBackApplies } from "./Resize";
import { useBringBusy } from "./bringBusy";
import { dockerLocked } from "./dockerLock";
import ComposeProjects, { composeRunState, runCompose, useComposeRun } from "./ComposeProjects";
import type { Action } from "./ComposeProjects";
import ComposeLogs from "./ComposeLogs";
import type { ComposeScan } from "./useComposeScan";
import type { Finding, Report } from "./lib/doctor";
import { setMuted } from "./lib/muted";
import { fixAction, useFixRuns } from "./FixIt";
import { biggerFix } from "./lib/sharedFix";
import { useDesktopOffer } from "./desktopOffer";
import { gapLine } from "./lib/bringOver";
import { describe } from "./lib/fixRun";
import { busy as fixBusy, dismiss, runFor, type Run } from "./lib/fixStore";
import { Banner, Button, Empty, Field, List, MenuItem, MenuSeparator, Problem, Sheet, SkeletonRows, useConfirm, useToast } from "./ui/op";
import type { DotState } from "./ui/op";
import { EntryRow, ChildRow, RowMenu, TableHeadRow } from "./containers/ContainerRows";
import { NewMenu } from "./containers/NewMenu";
import { SelectionBar } from "./containers/SelectionBar";
import { ProblemInspector } from "./containers/ProblemInspector";
import { inspectorContent } from "./lib/inspectorContent";
import { Header } from "./Header";
import { blockOf, flatten, hostPorts, isOpen, sortEntries, stateView, statsText, summary } from "./lib/containerRows";
import type { StateView } from "./lib/containerRows";
import type { LiveMap } from "./lib/liveStats";
import Ticks, { plain } from "./ui/Ticks";

type VmOp = { op: "starting" | "stopping" | "restarting"; cmd: string; args: Record<string, unknown> };
// `last` lives here, not in this screen, so Retry still repeats the right command after the screen remounts.
export type VmState = { op: VmOp["op"] | null; failure: string | null; last?: VmOp };
type C = { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string; Labels?: string };
// A Start or Stop that the poll never confirms stops saying "Starting…" after this long.
const PENDING_MS = 30_000;
// The projects the user folded or unfolded, kept across visits.
const OPEN_KEY = "openpier:containers-open";
// ids: when only some of a project's containers are started (its stopped ones), the wait ends once those run; the
// project as a whole may stay partly running (a crashed job), which is not the target.
type Pending = { target: "running" | "stopped"; word: string; since: number; ids?: string[] };

type Props = {
  profile: Profile | null;
  ctx: string | null;
  vm: VmState;
  onVm: (s: VmState) => void;
  reload: () => void;
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
  // One read of `docker stats` and the CPU points kept for the sparkline.
  live: LiveMap;
  history: Record<string, number[]>;
  // Set while Docker Desktop's data is still on the Mac and some of it isn't in Colima (the same rule as Doctor's row).
  // only: the volume to pick alone, from the problem line of the row that uses it. returnTo: where focus goes if that
  // line is gone when the panel closes (the row's name button).
  onBring?: (only?: string[], returnTo?: string) => void;
  onRun?: () => void;
  // The Doctor's `docker inspect` of every container (restart policy, ports, health check), read every 30 s. It
  // decides whether a container that exited 0 is a finished job or a stopped service.
  inspected?: unknown[];
};

// The main button's label each row last showed, kept across tabs, so a VM size change doesn't flip it while it runs.
const seenVerb = new Map<string, "Start" | "Stop">();

function readOpen(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(OPEN_KEY);
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export default function Containers({ profile, ctx, vm, onVm, reload, setDetailId, onPull, onProfiles, compose, onImages, onKubernetes, report, onReport, onBring, onRun, inspected, live, history }: Props) {
  const runs = useFixRuns();
  const confirm = useConfirm();
  // `fixAction` is still on the old three-argument confirm until WO-3.8 rebuilds FixIt.
  const oldConfirm = ((message: string, label = "Remove", opts?: { safe?: boolean }) =>
    confirm({ title: `${label}?`, body: message, confirm: label, danger: !opts?.safe })) as Parameters<typeof fixAction>[2];
  const toast = useToast();
  const composeRun = useComposeRun();
  const running = !!ctx;
  const containers = usePoll<C[]>(async () => (ctx ? dockerJson<C>(ctx, ["ps", "-a"]) : []), [ctx], 3000);
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [logsOf, setLogsOf] = useState<App<C> | null>(null);
  const [runImage, setRunImage] = useState<string | null>(null);
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>(readOpen);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [inspect, setInspect] = useState<{ c: C; f: Finding } | null>(null);
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
      if (op === "starting") clearWayBack();
      onVm({ op: null, failure: null, last });
    } catch (e) {
      onVm({ op: null, failure: String(e), last });
    }
    reload();
  }
  const size = useHostSize();
  // An existing profile keeps its saved size; only the very first VM is sized from the Mac.
  // Start VM is always a plain start of what is saved. While the saved list is the one that just failed, the stopped
  // card offers the way back next to it, as its own button (see `back`).
  const start = () => { vmAct("starting", "start_profile", { opts: profile ? { name: profile.name } : { name: "default", ...size } }); };

  const all = useMemo(() => containers.data ?? [], [containers.data]);
  const runInfoByName = useMemo(() => runInfo(inspected ?? []), [inspected]);
  // A container this app stopped reads Stopped, whatever its run time says (until it starts again).
  useSyncExternalStore(subscribeAppStopped, appStoppedVersion);
  const infoOf = (c: C) => withAppStop(ctx, c, runInfoByName.get(c.Names));
  const apps = useMemo(() => appsFrom(all, compose.paths ?? []), [all, compose.paths]);
  const allRef = useRef(all);
  const appsRef = useRef(apps);
  allRef.current = all;
  appsRef.current = apps;
  // Only what needs action shows on home; the rest is "worth knowing" on the Doctor page and the container's own page.
  // A line about how a container last ended (out of memory, an error) is over once the list shows it running again
  // (in a crash loop, once the new run has lasted a minute): it comes back only if a new run ends the same way.
  const problems = useMemo(() => {
    const up = new Set(all.filter((c) => lastRunOver(c, runInfoByName.get(c.Names))).map((c) => c.Names));
    const m = new Map<string, Finding[]>();
    for (const [n, l] of report?.byContainer ?? []) {
      const act = l.filter((f) => f.severity === "action" && !(up.has(n) && ENDED.has(f.id)));
      if (act.length) m.set(n, act);
    }
    return m;
  }, [report, all, runInfoByName]);
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
      if (p.ids) return p.ids.some((id) => a.rows.find((c) => c.ID === id)?.State !== "running");
      const s = appState(a.rows, infoOf).state;
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
      setSaid({ status: "", alert: `${f.service ?? a.name} didn't ${DID[f.action]}. ${f.why ?? firstLine(f.text)}` });
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
    // A VM change reads the list itself before its result shows (see addChangeRefresh), so there is nothing to settle.
    if (wasResizing.current && !resizing(rs) && !rs.change) { setSettling(true); void containers.reload().finally(() => setSettling(false)); }
    wasResizing.current = resizing(rs);
  }, [rs]); // eslint-disable-line react-hooks/exhaustive-deps
  // The render right after the run ends comes before that effect, so it counts too. A VM change's result shows only
  // after a read made once everything ran again, so no row says Restarting… next to a done result.
  const holding = resizing(rs) || (!rs.change && (settling || wasResizing.current));
  const containersRef = useRef(containers.reload);
  containersRef.current = containers.reload;
  useEffect(() => addChangeRefresh(async () => { await containersRef.current(); }), []);
  const env = useResizeEnv();
  // The change whose list is still saved after a failed start, read again from colima.yaml each time the card shows.
  const [back, setBack] = useState<VmChange | null>(null);
  const stoppedName = !running && profile ? profile.name : null;
  useEffect(() => {
    if (!stoppedName || vm.op) { setBack(null); return; }
    let live = true;
    void wayBackApplies(stoppedName).then((c) => { if (live) setBack(c); });
    return () => { live = false; };
  }, [stoppedName, vm.op, rs.card, rs.outcome]);
  // Once the VM runs and no change result is waiting (a failed one briefly sees the old status), nothing is left to go back to.
  useEffect(() => { if (running && !resizing(rs) && !rs.outcome) clearWayBack(); }, [running, rs]);
  // Volumes a first `compose up` made empty here while Docker Desktop holds the data, read once (desktopOffer).
  const offer = useDesktopOffer();
  const gaps = onBring && offer.ctx === ctx ? offer.gaps : [];
  // A copy stops and starts containers (a replace restarts Colima's own); read the list as soon as it ends, so a row
  // never shows the stopped moment ("5 of 6 running") until the next poll.
  // A line that goes away under focus (its volume came over after the panel closed) hands focus to its row's name.
  const prevGaps = useRef(gaps);
  useEffect(() => {
    const gone = prevGaps.current.filter((g) => !gaps.some((x) => x.name === g.name));
    prevGaps.current = gaps;
    if (!gone.length || (document.activeElement && document.activeElement !== document.body)) return;
    const a = appsRef.current.find((x) => x.rows.some((c) => gone[0].users.includes(c.Names)));
    if (a) focusName(a.name);
  }, [gaps]);
  // The same for the "is stopped" line: its Start worked, the line went, and focus goes to the row's name.
  const downShown = useRef(new Set<string>());
  const downNow = new Set<string>();
  // And for a problem line that goes while focus is on the body (Apply and start worked, a fix ran).
  const linesShown = useRef(new Map<string, string>());
  const linesNow = new Map<string, string>();
  useEffect(() => {
    const gone = [...linesShown.current].filter(([k]) => !linesNow.has(k));
    linesShown.current = linesNow;
    if (holding || !gone.length || (document.activeElement && document.activeElement !== document.body)) return;
    focusEntry(gone[0][1]);
  });
  useEffect(() => {
    const gone = [...downShown.current].filter((k) => !downNow.has(k));
    downShown.current = downNow;
    // Lines hidden by a VM resize didn't go because they were started: focus stays where it is.
    if (holding || !gone.length || (document.activeElement && document.activeElement !== document.body)) return;
    focusEntry(gone[0]);
  });
  const copying = useBringBusy();
  const wasCopying = useRef(false);
  useEffect(() => {
    if (wasCopying.current && !copying) void containers.reload();
    wasCopying.current = copying;
  }, [copying]); // eslint-disable-line react-hooks/exhaustive-deps
  const canAct = (a: App<C>) => !dockerLocked(a.rows.map((c) => c.Names)) && !pending.has(a.key);

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
  // service: that one service, recreated on its own (`up -d --no-deps`), said by its name.
  async function project(a: App<C>, action: Action, p: Pending | null, done: string, service?: string) {
    if (!canAct(a) || !ctx) return;
    if (!a.dir || !a.files.length) {
      const ids = a.rows.map((c) => c.ID);
      return act(a, action === "down" ? ["rm", "-f", ...ids] : [action === "up" ? "start" : action, ...ids], p, done);
    }
    if (p) { setPending((m) => new Map(m).set(a.key, p)); setSaid({ status: `${p.word.replace("…", "")} ${a.name}…`, alert: "" }); }
    else if (service) setSaid({ status: `Starting ${service}…`, alert: "" });
    unfail(a.key);
    const ran = await runCompose(ctx, { dir: a.dir, files: a.files, name: a.name }, action, all, service);
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
      const rows = [...document.querySelectorAll<HTMLElement>(".list > .row:not(.th):not(.child)")];
      (rows[Math.min(r.at, rows.length - 1)] ?? document.querySelector<HTMLElement>(".header .btn.primary"))?.focus();
    });
  }, [all]);
  const willRemove = (gone: () => boolean, key: string) => { removing.current = { gone, at: Math.max(0, apps.findIndex((x) => x.key === key)) }; };

  // Coming back from a container's page puts focus on the row it was opened from, not on the page body.
  const opened = useRef<string | null>(null);

  // Esc clears the selection first; a second press clears the search.
  useEffect(() => {
    const onEscape = () => {
      if (checked.size) { setChecked(new Set()); return; }
      if (q) setQ("");
    };
    window.addEventListener("openpier:escape", onEscape);
    return () => window.removeEventListener("openpier:escape", onEscape);
  }, [checked, q]);

  if (!profile) {
    const busy = vm.op !== null;
    return (
      <>
        <Header title="Containers" />
        <Empty
          icon="box"
          title="Start your first VM"
          actions={
            <>
              <Button variant="primary" size="md" disabled={busy} onClick={start}>
                {busy ? "Starting…" : size ? `Start Colima (${size.cpus} CPUs, ${size.memory} GiB)` : "Start Colima"}
              </Button>
              <Button variant="ghost" size="md" onClick={onProfiles}>Customize first</Button>
            </>
          }
        >
          Colima needs a small Linux VM to run containers. The defaults work for most people.
        </Empty>
        {vm.failure && <Banner tone="bad">{vm.failure}</Banner>}
      </>
    );
  }

  const term = q.trim();
  // A number finds whatever publishes that port ("8080" finds web on 0.0.0.0:8080->80).
  const hit = (c: C) => score(c.Names, term) > 0 || score(c.Image, term, false) > 0 || (/^\d{2,5}$/.test(term) && new RegExp(`(^|[ ,:])${term}->`).test(c.Ports ?? ""));
  const shown = term ? apps.filter((a) => score(a.name, term) > 0 || a.rows.some(hit)) : apps;
  const composeDirs = compose.paths ? [...new Set(compose.paths.map((x) => x.slice(0, x.lastIndexOf("/"))))] : [];
  // A search that finds nothing may be for a project that was never started, which only the Compose panel lists.
  const projectHits = term ? composeDirs.filter((d) => score(d.slice(d.lastIndexOf("/") + 1), term) > 0).length : 0;

  // The failure card stays mounted through the way back, so the good result lands where focus already is.
  const failedChange = rs.card && !!rs.outcome && rs.from?.startsWith("home:") === true;
  const problemsOf = (rows: C[]) => rows.flatMap((c) => {
    const p = problems.get(c.Names)?.[0];
    const run = runFor(runs, c.Names);
    return p || run ? [{ c, p, run }] : [];
  });
  const hasProblem = (c: C) => problemsOf([c]).length > 0;

  // What a row says: the shape and the word of one container (spec 6.4's table), with Finished kept for a job.
  const viewOf = (c: C): StateView => {
    if (finished(c, infoOf(c))) return { dot: "off", word: "Finished", action: "Start", busy: false };
    const f = problems.get(c.Names)?.[0];
    const exit = /^Exited \((\d+)\)/.exec(c.Status ?? "");
    return stateView({
      state: c.State,
      exitCode: exit ? Number(exit[1]) : undefined,
      oomKilled: f?.id === "oom",
      unhealthy: f?.id === "unhealthy",
      finding: f ? (f.level === "bad" ? "bad" : "warn") : null,
      busy: null,
    });
  };
  const statsFor = (c: C) => {
    const lv = live[c.Names];
    return statsText(lv?.cpu ?? 0, lv?.memBytes ?? 0, c.State === "running");
  };
  const historyOf = (c: C) => history[c.Names] ?? [];
  const cpuNowOf = (c: C) => {
    const lv = live[c.Names];
    return lv ? Math.round(lv.cpu) : null;
  };
  const projectOf = (c: C) => apps.find((a) => a.kind === "compose" && a.rows.some((r) => r.ID === c.ID))?.name ?? null;

  const focusEntry = (key: string) => {
    const a = appsRef.current.find((x) => x.key === key);
    if (a) focusName(a.name);
  };

  const openNow = (a: App<C>) => (!!term && a.kind === "compose" && a.rows.some(hit)) || isOpen(a.rows.some(hasProblem), openKeys[a.key]);
  const setOpenAt = (key: string, open: boolean) => {
    setOpenKeys((prev) => {
      const next = { ...prev, [key]: open };
      try { localStorage.setItem(OPEN_KEY, JSON.stringify(next)); } catch { /* not remembered */ }
      return next;
    });
  };
  const sorted = sortEntries(shown.map((a) => ({ ...a, hasProblem: a.rows.some(hasProblem), running: appState(a.rows, infoOf).up > 0 })));
  const lines = flatten<C>(sorted, (e) => openNow(e as App<C>), hasProblem);

  const toggleCheck = (id: string, on: boolean) => setChecked((prev) => {
    const next = new Set(prev);
    if (on) next.add(id); else next.delete(id);
    return next;
  });
  const setGroupChecked = (a: App<C>, on: boolean) => setChecked((prev) => {
    const next = new Set(prev);
    for (const c of a.rows) { if (on) next.add(c.ID); else next.delete(c.ID); }
    return next;
  });
  const checkedRows = all.filter((c) => checked.has(c.ID));
  const canStart = checkedRows.some((c) => c.State !== "running");
  const canStop = checkedRows.some((c) => c.State === "running");
  const checkedGroups = () => apps.map((a) => ({ a, rows: a.rows.filter((c) => checked.has(c.ID)) })).filter((g) => g.rows.length > 0);
  async function actChecked(verb: "start" | "stop") {
    const groups = checkedGroups();
    await Promise.all(groups.map(async ({ a, rows }) => {
      for (const c of rows) await act(a, [verb, c.ID], null, verb === "start" ? `${c.Names} started` : `${c.Names} stopped`);
    }));
    setChecked(new Set());
  }
  async function removeChecked() {
    for (const { a, rows } of checkedGroups()) {
      await act(a, ["rm", "-f", ...rows.map((c) => c.ID)], null, `${rows.length === 1 ? rows[0].Names : `${rows.length} containers`} removed`);
    }
    setChecked(new Set());
  }

  // "Run it yourself": the exact command, in a dialog that can copy it (spec 6.8).
  const runYourself = async (title: string, command: string) => {
    const yes = await confirm({ title, body: "This is what OpenPier runs. You can paste it in Terminal.", command, confirm: "Copy command" });
    if (yes) await navigator.clipboard.writeText(command);
  };

  const containerMenuItems = (c: C, a: App<C>): ReactNode[] => {
    const up = c.State === "running";
    const lock = !canAct(a);
    const p = problems.get(c.Names)?.[0];
    const verb = up ? "stop" : "start";
    return [
      <MenuItem key="logs" label="Logs" why="To see what it printed" onSelect={() => setDetailId(c.ID)} />,
      ...(up ? [<MenuItem key="shell" label="Open a shell" why="To run commands inside it" disabled={lock} onSelect={() => void openShell(ctx!, c.Names).catch((e: unknown) => fail(a, e instanceof Error ? e.message : String(e)))} />] : []),
      ...(up ? [<MenuItem key="restart" label="Restart" why="After you change a setting or it got stuck" disabled={lock} onSelect={() => void act(a, ["restart", c.ID], null, `${c.Names} restarted`)} />] : []),
      ...(p ? [<MenuItem key="not-issue" label="Not an issue" why="Stops showing this problem" onSelect={() => setMuted(p.key, true)} />] : []),
      <MenuSeparator key="sep-1" />,
      <MenuItem key="copy" label="Copy name" onSelect={() => { void navigator.clipboard.writeText(c.Names); toast({ text: `Copied ${c.Names}` }); }} />,
      <MenuItem key="yourself" label="Run it yourself" why="Shows the command, if you'd rather use Terminal" onSelect={() => void runYourself(`Run ${c.Names} yourself`, `docker --context ${ctx} ${verb} ${c.Names}`)} />,
      <MenuSeparator key="sep-2" />,
      <MenuItem key="remove" label="Remove…" why="Deletes the container. Volumes are kept" danger disabled={lock} onSelect={() => void (async () => {
        const yes = await confirm({
          title: `Remove ${c.Names}?`,
          body: `This deletes the container. Its image and volumes are kept, so you can run it again.${up ? " It is running and will be stopped first." : ""}`,
          command: `docker --context ${ctx} rm -f ${c.Names}`,
          confirm: "Remove",
          danger: true,
        });
        if (!yes) return;
        willRemove(() => !allRef.current.some((x) => x.ID === c.ID), a.key);
        await act(a, ["rm", "-f", c.ID], null, `${c.Names} removed`);
      })()} />,
    ];
  };

  const projectMenuItems = (a: App<C>): ReactNode[] => {
    const lock = !canAct(a);
    const known = !!a.dir && a.files.length > 0;
    const anyUp = a.rows.some((c) => c.State === "running");
    const stopped = a.rows.filter((c) => c.State !== "running" && !finished(c, infoOf(c)));
    const what = startWhat(stopped.map((c) => serviceName(c, a.name)));
    const verb = anyUp ? "stop" : "up -d";
    const command = known ? `cd '${a.dir}' && docker --context ${ctx} compose ${verb}` : `docker --context ${ctx} ${anyUp ? "stop" : "start"} ${a.rows.map((c) => c.ID).join(" ")}`;
    return [
      ...(stopped.length && anyUp ? [<MenuItem key="start" label={`Start ${what}`} disabled={lock} onSelect={() => void act(a, ["start", ...stopped.map((c) => c.ID)], { target: "running", word: "Starting…", since: Date.now(), ids: stopped.map((c) => c.ID) }, `${listed(stopped.map((c) => serviceName(c, a.name)))} started`)} />] : []),
      ...(known ? [<MenuItem key="rebuild" label="Rebuild and start" why="After you change a Dockerfile or the code it copies in" disabled={lock} onSelect={() => void project(a, "build", { target: "running", word: "Rebuilding…", since: Date.now() }, `${a.name} rebuilt`)} />] : []),
      ...(known ? [<MenuItem key="pull" label="Update images and start" why="When a newer version of an image is out" disabled={lock} onSelect={() => void project(a, "pull", { target: "running", word: "Updating…", since: Date.now() }, `${a.name} updated`)} />] : []),
      ...(anyUp ? [<MenuItem key="restart" label="Restart" why="After you change a setting in compose.yaml" disabled={lock} onSelect={() => void project(a, "restart", null, `${a.name} restarted`)} />] : []),
      ...(known ? [<MenuItem key="logs" label="Show logs" onSelect={() => setLogsOf(a)} />] : []),
      ...(known ? [<MenuItem key="finder" label="Show in Finder" disabled={lock} onSelect={() => void invoke("reveal_compose", { path: `${a.dir}/${a.files[0]}` }).catch((e) => fail(a, String(e)))} />] : []),
      <MenuSeparator key="sep-1" />,
      <MenuItem key="yourself" label="Run it yourself" why="Shows the command, if you'd rather use Terminal" onSelect={() => void runYourself(`Run ${a.name} yourself`, command)} />,
      <MenuSeparator key="sep-2" />,
      <MenuItem key="remove" label="Remove containers…" why="To start clean. Volumes and data are kept" danger disabled={lock} onSelect={() => void (async () => {
        const yes = await confirm({
          title: `Remove the containers of ${a.name}?`,
          body: "This deletes the containers of the project. Images, volumes and data are kept.",
          command,
          confirm: "Remove containers",
          danger: true,
        });
        if (!yes) return;
        willRemove(() => !appsRef.current.some((x) => x.key === a.key), a.key);
        await project(a, "down", null, `${a.name} removed`);
      })()} />,
    ];
  };

  const rowMenu = (id: string, name: string, items: ReactNode) => (
    <RowMenu name={name} items={items} open={menuFor === id} onOpenChange={(open) => setMenuFor(open ? id : null)} />
  );

  // Everything one entry row needs, worked out once for the row and once for the lines under it.
  const entryView = (a: App<C>) => {
    const kube = a.kind === "kubernetes";
    const isProject = a.kind === "compose";
    const single = a.kind === "container" ? a.rows[0] : null;
    const { state, up, of } = appState(a.rows, infoOf);
    const pend = pending.get(a.key);
    const mine = !!composeRun.busy && inDir(a, composeRun.busy.dir) && a.files.length > 0;
    const withVm = holding && !kube;
    const changing = withVm ? "Restarting…" : pend?.word ?? (mine ? ING[composeRun.busy!.action] : null);
    const issues = problemsOf(a.rows);
    const rowGaps = kube ? [] : gaps.filter((g) => a.rows.some((c) => g.users.includes(c.Names)));
    // Down, counted, and with no problem line of its own: they share one plain line, so the lines and the count
    // agree (every container "N of M running" is short of is on a line). Finished jobs aren't counted, so no line.
    // Only once the Doctor has answered: before that a crashed service would read "is stopped", then change.
    // Not while the VM is resized: it is about to start what ran, and until the list is read again afterwards a
    // container that is coming back would read stopped.
    const down = !withVm && isProject && state === "partly" && report ? a.rows.filter((c) => c.State !== "running" && !finished(c, infoOf(c)) && !issues.some((i) => i.c.ID === c.ID)) : [];
    const downWords = down.length ? downLine(down.map((c) => serviceName(c, a.name))) : null;
    const marks = a.rows.map((c) => viewOf(c).dot);
    const groupDot: DotState = changing ? "busy" : marks.includes("bad") ? "bad" : marks.includes("warn") ? "warn" : state === "running" ? "ok" : state === "partly" ? "warn" : "off";
    const singleView = single ? viewOf(single) : null;
    const word = kube ? "" : isProject ? changing ?? (state === "partly" ? `${up} of ${of} running` : state === "running" ? "Running" : "Stopped") : changing ?? singleView!.word;
    const dot: DotState = kube ? "ok" : isProject ? groupDot : changing ? "busy" : singleView!.dot;
    // Anything running means the main button stops it; starting the rest of a partly running project is in its menu.
    const liveVerb = up > 0 ? "Stop" : "Start";
    if (!withVm) seenVerb.set(a.key, liveVerb);
    const verb = withVm ? seenVerb.get(a.key) ?? liveVerb : liveVerb;
    const lock = !canAct(a) || withVm;
    const ports = kube ? [] : isProject
      ? [...new Set(a.rows.filter((c) => c.State === "running").flatMap((c) => hostPorts(c.Ports)))]
      : hostPorts(single!.Ports);
    // A bigger VM asked for from an out-of-memory line: once that container runs, its line is gone, and the result
    // stays on its own row under the project until Dismiss. A failure keeps the line, and the result stays in it.
    const resizedName = rs.from?.startsWith("home:") ? rs.from.split(":")[1] : null;
    const resizedHere = !!resizedName && (!!rs.outcome || !!rs.progress) && a.rows.some((c) => c.Names === resizedName) && !issues.some((i) => i.c.Names === resizedName && (i.p?.fix?.resize || i.p?.fix?.vm));
    const startIt = () => (isProject
      ? project(a, "up", { target: "running", word: "Starting…", since: Date.now() }, `${a.name} started`)
      : act(a, ["start", single!.ID], { target: "running", word: "Starting…", since: Date.now() }, `${a.name} started`));
    const stopIt = () => (isProject
      ? project(a, "stop", { target: "stopped", word: "Stopping…", since: Date.now() }, `${a.name} stopped`)
      : act(a, ["stop", single!.ID], { target: "stopped", word: "Stopping…", since: Date.now() }, `${a.name} stopped`));
    const cf = composeRun.failed && inDir(a, composeRun.failed.dir) && a.files.length > 0 && !mine ? composeRun.failed : null;
    const holderApp = cf?.holder ? apps.find((x) => x.rows.some((c) => c.Names === cf.holder)) : undefined;
    return { kube, isProject, single, state, up, of, pend, mine, withVm, changing, issues, rowGaps, down, downWords, marks, groupDot, singleView, word, dot, liveVerb, verb, lock, ports, resizedHere, startIt, stopIt, cf, holderApp };
  };

  const entryRow = (a: App<C>, expanded: boolean) => {
    const v = entryView(a);
    if (v.kube) {
      return (
        <EntryRow key={a.key} id={a.key} group={false} name="Kubernetes" meta={`${a.rows.length} container${a.rows.length === 1 ? "" : "s"}`}
          dot="ok" stateWord="" ariaLabel={`Kubernetes, ${a.rows.length} container${a.rows.length === 1 ? "" : "s"}`} ports={[]} stats="" history={[]} cpuNow={null} action={null} selected={false} onSelect={null}
          onOpen={() => onKubernetes?.()} onAction={() => {}} menu={null} menuOpen={false} onMenuOpenChange={() => {}} />
      );
    }
    const single = v.single!;
    const common = {
      id: a.key,
      name: a.name,
      meta: v.isProject ? (a.dir ? tilde(a.dir) : "") : single.Image,
      dot: v.dot,
      stateWord: v.word,
      ariaLabel: v.isProject ? `${a.name}, project, ${v.word}` : `${single.Names}, ${v.word}`,
      ports: v.ports,
      stats: v.isProject ? "" : statsFor(single),
      history: v.isProject ? [] : historyOf(single),
      cpuNow: v.isProject ? null : cpuNowOf(single),
      action: { label: v.verb, busy: !!v.changing, locked: v.lock },
      selected: v.isProject ? a.rows.every((c) => checked.has(c.ID)) : checked.has(single.ID),
      onSelect: (on: boolean) => { if (v.isProject) setGroupChecked(a, on); else toggleCheck(single.ID, on); },
      onOpen: () => { if (v.isProject) setOpenAt(a.key, !expanded); else setDetailId(single.ID); },
      onAction: () => { if (!v.lock) void (v.verb === "Stop" ? v.stopIt() : v.startIt()); },
      menu: v.isProject ? rowMenu(a.key, a.name, projectMenuItems(a)) : rowMenu(a.key, single.Names, containerMenuItems(single, a)),
      menuOpen: menuFor === a.key,
      onMenuOpenChange: (open: boolean) => setMenuFor(open ? a.key : null),
    };
    if (!v.isProject) return <EntryRow key={a.key} {...common} group={false} />;
    return (
      <EntryRow key={a.key} {...common} group={true} open={expanded} onToggle={() => setOpenAt(a.key, !expanded)}
        blocks={a.rows.map((c) => { const cv = viewOf(c); return blockOf(serviceName(c, a.name), cv.dot, cv.word); })}
        runningText={v.word} />
    );
  };

  const childRow = (a: App<C>, c: C) => {
    const v = viewOf(c);
    const lock = !canAct(a) || holding;
    const verb = c.State === "running" ? "Stop" : "Start";
    const id = `${a.key}/${c.Names}`;
    return (
      <ChildRow key={id} id={id} name={serviceName(c, a.name)} meta={c.Image} dot={v.dot} stateWord={v.word}
        ariaLabel={`${serviceName(c, a.name)}, ${v.word}`} ports={hostPorts(c.Ports)} stats={statsFor(c)} history={historyOf(c)} cpuNow={cpuNowOf(c)}
        action={{ label: verb, busy: false, locked: lock }} selected={checked.has(c.ID)}
        onSelect={(on) => toggleCheck(c.ID, on)} onOpen={() => setDetailId(c.ID)}
        onAction={() => { if (!lock) void act(a, [verb === "Stop" ? "stop" : "start", c.ID], null, `${c.Names} ${verb === "Stop" ? "stopped" : "started"}`); }}
        menu={rowMenu(id, c.Names, containerMenuItems(c, a))} menuOpen={menuFor === id}
        onMenuOpenChange={(open) => setMenuFor(open ? id : null)} />
    );
  };

  // One line under a row: what is wrong, in plain words, and the one thing to do about it.
  const problemLine = (c: C, a: App<C>, prefix: boolean, indent: boolean) => {
    const p = problems.get(c.Names)?.[0];
    const run = runFor(runs, c.Names);
    const who = prefix ? `${c.Names} · ` : "";
    const openThis = p ? () => setInspect({ c, f: p }) : undefined;
    const see = p
      ? <Button size="xs" aria-label={`See why: ${c.Names}`} onClick={() => setInspect({ c, f: p })}>See why</Button>
      : <Button variant="ghost" size="xs" aria-label={`See why: ${c.Names}`} onClick={() => setDetailId(c.ID)}>See why</Button>;
    if (run?.step) return <Problem key={c.ID} level="busy" text={`${who}${run.step}`} action={<Button variant="ghost" size="xs" aria-disabled="true">Fixing…</Button>} child={indent} />;
    const r = run?.result;
    if (r?.ok) {
      // A broker needs a little while after a restart, and an app that looks for it shows nothing until then.
      const slow = /kafka/i.test(c.Image) ? " Kafka needs about 30 s to start." : "";
      return <Problem key={c.ID} level="ok" text={`${who}Fixed.${slow}`} title={describe(r)} action={<Button variant="ghost" size="xs" onClick={() => dismiss(c.Names)}>Done</Button>} child={indent} />;
    }
    if (!p) return r ? <Problem key={c.ID} level="bad" text={`${who}The fix didn't finish.`} title={describe(r)} action={see} child={indent} /> : null;
    // When this row's own fix replaces containers, a bigger fix that also replaces this one (Kafka UI's "fix both"
    // includes its broker) wins, so both rows offer the one fix that makes them work together.
    const shared = biggerFix(p.fix, [...problems.values()].flat().map((f) => f.fix));
    const fix = shared ?? p.fix;
    // That bigger fix gets one button, on the row that owns it; this row says where it is.
    const owner = shared ? [...problems].find(([, l]) => l.some((f) => f.fix === shared))?.[0] : undefined;
    if (shared && owner && owner !== c.Names) return <Problem key={c.ID} level={p.level === "bad" ? "bad" : "warn"} text={`${who}${p.short ?? p.title}. Fixed together with ${owner}.`} title={plain(p.detail)} child={indent} onOpen={openThis} />;
    const one = fix ? fixAction(fix, ctx ?? undefined, oldConfirm, runs, fixed) : null;
    const names = fix?.steps?.map((x) => x.name) ?? [];
    const said = p.short ?? p.title;
    // The line sits under the container's name, so "Its health check is failing" is "Health check is failing",
    // and after "api · " it is "health check is failing".
    // A folder line keeps its "Its": "api · its folder ~/code/api isn't shared with Colima".
    const phrase = p.id.startsWith("mount-") ? (prefix ? said.replace(/^./, (ch) => ch.toLowerCase()) : said) : prefix ? said.replace(/^(It|Its) /, "").replace(/^./, (ch) => ch.toLowerCase()) : said.replace(/^Its (.)/, (_, ch: string) => ch.toUpperCase());
    const text = `${who}${r ? "The fix didn't finish. " : ""}${phrase}`;
    // "Fix" only where the app really repairs it; otherwise the button says what it does.
    // A container that ran out of memory: the one-click bigger VM, which starts it again after.
    // Its own memory limit, from a listed project: one button, chosen by what the file says now.
    if (fix?.reveal && a && isListed(fix.reveal, compose.paths ?? [])) {
      const lockedHere = !canAct(a);
      return <LimitLine key={c.ID} who={who} text={text} detail={plain(p.detail)} fix={{ ...fix, reveal: fix.reveal }} ctx={ctx ?? undefined} project={a.name} locked={lockedHere} lockWhy={composeRun.busy ? "Waits for the Compose run that is going." : "Waits for what is changing Docker now."}
        onApply={(svc) => void project(a, "up", null, `${svc} started with its new limit.`, svc)}
        onStart={() => void project(a, "up", { target: "running", word: "Starting…", since: Date.now() }, `${a.name} started`)}
        onOpenFail={(alert) => setSaid({ status: "", alert })}
        onSay={(status) => setSaid({ status, alert: "" })} child={indent} onOpen={openThis} />;
    }
    const action = fix?.reveal ? see : fix?.vm ? (
      // Share the folder (or make it writable): the VM restarts and what ran starts again; the result stays under the row.
      <VmChangeOr from={`home:${c.Names}:${p.id}`} change={fix.vm} title={`${said}, ${c.Names}`} noStatus={failedChange} />
    ) : fix?.resize ? (
      <ResizeOr from={`home:${c.Names}:${p.id}`} title={`${p.short ?? p.title}, ${c.Names}`} need="memory" alsoStart={[c.Names]} fallback={see} noProfiles vmWords />
    ) : one ? (
      // A Fix replaces containers; while the VM stops or restarts there is no Docker to replace them in.
      <Button variant="primary" size="xs" aria-label={`${r ? "Try again" : one.label}: ${plain(p.short ?? p.title)}, ${c.Names}`} aria-disabled={one.locked || undefined} title={one.locked ? "Waits for what is changing Docker now" : undefined} disabled={one.locked} onClick={() => !one.locked && one.go()}>{r ? "Try again" : names.length > 1 ? `Fix ${names.join(" and ")}…` : `${one.label}…`}</Button>
    ) : fix?.go === "Images" ? (
      <Button variant="ghost" size="xs" onClick={onImages}>Open Images</Button>
    ) : see;
    return <Problem key={c.ID} level={p.level === "bad" ? "bad" : "warn"} text={<Ticks text={text} />} title={plain(p.detail)} action={action} child={indent} onOpen={openThis} />;
  };

  // What sits under an entry row beyond the lines `flatten` makes: a Compose run that failed, a failed action, the
  // volumes that came up empty, what is only stopped, and a VM size change's result.
  const entryExtras = (a: App<C>, expanded: boolean): ReactNode[] => {
    const v = entryView(a);
    if (v.kube) return [];
    const out: ReactNode[] = [];
    if (v.cf) {
      out.push(
        <Problem key={`cf-${a.key}`} level="bad" text={`${a.name} didn't ${DID[v.cf.action]}. ${v.cf.why ?? firstLine(v.cf.text)}`} title={v.cf.text}
          action={v.cf.holder ? <Button variant="primary" size="xs" aria-disabled={v.lock || !v.holderApp || !canAct(v.holderApp) || undefined} onClick={() => void (async () => { if (v.lock || !v.holderApp || !canAct(v.holderApp)) return; await act(v.holderApp, ["stop", v.cf!.holder!], null, `${v.cf!.holder} stopped`); await v.startIt(); })}>Stop {v.cf.holder} and start</Button> : undefined} />,
      );
    }
    const failure = failed.get(a.key);
    if (failure && !v.cf) out.push(<Problem key={`failure-${a.key}`} level="bad" text={`${a.name}: ${firstLine(failure)}`} title={failure} action={<Button variant="ghost" size="xs" onClick={() => unfail(a.key)}>Dismiss</Button>} />);
    if (v.lock && !v.changing) out.push(<span key={`why-${a.key}`} className="sr-only" id={`why-${a.key}`}>{a.rows.some((c) => fixBusy(runs, c.Names)) ? "A fix is running on it." : vm.op ? "The VM is changing." : "Another action is running."}</span>);
    // First: a database that came up empty can explain the problems under it.
    for (const g of v.rowGaps) {
      out.push(<Problem key={`gap-${a.key}-${g.name}`} level="warn" text={<Ticks text={gapLine(g)} />} action={<Button variant="ghost" size="xs" aria-label={`Bring it over: ${g.name} from Docker Desktop`} onClick={() => onBring?.([g.name], a.name)}>Bring it over…</Button>} />);
    }
    if (!expanded) {
      const downWords = v.downWords;
      if (downWords) {
        downNow.add(a.key);
        out.push(<Problem key={`down-${a.key}`} level="info" text={downWords.text} action={<Button variant="ghost" size="xs" aria-label={downWords.label} aria-disabled={v.lock || undefined} onClick={() => { if (!v.lock) void act(a, ["start", ...v.down.map((c) => c.ID)], { target: "running", word: "Starting…", since: Date.now(), ids: v.down.map((c) => c.ID) }, downWords.done); }}>{downWords.button}</Button>} />);
      }
    }
    if (v.resizedHere && !failedChange) out.push(<ResizeStatus key={`resize-${a.key}`} from={rs.from!} />);
    return out;
  };

  const nodes: ReactNode[] = [];
  let extras: ReactNode[] = [];
  for (const line of lines) {
    if (line.kind === "entry") {
      nodes.push(...extras);
      extras = [];
      const a = line.entry as App<C>;
      nodes.push(entryRow(a, line.open));
      extras = entryExtras(a, line.open);
    } else if (line.kind === "child") {
      nodes.push(childRow(line.entry as App<C>, line.c as C));
    } else {
      const c = line.c as C;
      const a = line.entry as App<C>;
      // A line under a folded project (or a single container) is remembered, so if it goes away while focus is on
      // the page body, focus moves to its row. A child's line inside an open project keeps focus where it is.
      if (!line.indent) linesNow.set(`${c.ID}\u0000${problems.get(c.Names)?.[0]?.id ?? "run"}`, a.key);
      nodes.push(problemLine(c, a, line.prefix, line.indent));
    }
  }
  nodes.push(...extras);

  // A project that needs attention starts open (spec 7.1 rule 5); a saved choice wins.
  const kubeIds = new Set(apps.filter((a) => a.kind === "kubernetes").flatMap((a) => a.rows.map((c) => c.ID)));
  const total = all.length - kubeIds.size;
  const needAttention = all.filter((c) => !kubeIds.has(c.ID) && hasProblem(c)).length;

  // The Inspector: the whole finding in plain words, with the same fix the line offers.
  const inspectFix = inspect?.f.fix ? fixAction(inspect.f.fix, ctx ?? undefined, oldConfirm, runs, fixed) : null;
  const inspector = inspect ? inspectorContent(inspect.f, inspect.c.Names, projectOf(inspect.c), inspectFix?.label ?? null, inspect.f.fix?.text ?? null) : null;

  const showStrip = !!vm.op || !!vm.failure;
  return (
    <>
      <div className="sr-only" role="status" aria-live="polite">{plain(said.status)}</div>
      <div className="sr-only" role="alert">{plain(said.alert)}</div>
      <Header title="Containers" summary={running ? summary(total, needAttention) : undefined}>
        {checked.size > 0 ? (
          <SelectionBar count={checked.size} canStart={canStart} canStop={canStop} onStart={() => void actChecked("start")} onStop={() => void actChecked("stop")} onRemove={() => void removeChecked()} onCancel={() => setChecked(new Set())} ctx={ctx ?? ""} />
        ) : running ? (
          <>
            <Field icon="search" width="search" data-page-search aria-label="Search containers" placeholder="Search containers" value={q} onChange={(e) => setQ(e.target.value)} onClear={() => setQ("")} />
            <NewMenu onRun={onRun} onPull={onPull} onCompose={() => setComposeOpen(true)} />
          </>
        ) : null}
      </Header>

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

      {/* A change that stopped the VM and couldn't start it again (a folder, the proxy): what happened comes first. While
          it shows, the card's Start VM is hidden: it would start the same saved list that just failed. The one filled
          button is "Start with the folders you had". */}
      {failedChange && <ResizeStatus from={rs.from!} title={`The VM ${profile.name} is stopped`} after={() => setTimeout(() => document.querySelector<HTMLElement>("[data-stopped-primary]")?.focus(), 0)} />}
      {!running && !vm.op && !vm.failure && !failedChange && (
        <Empty
          icon="box"
          title={`The VM "${profile.name}" is stopped`}
          actions={
            <>
              <Button variant={back ? "ghost" : "primary"} size="md" data-stopped-primary={back ? undefined : ""} onClick={start}>Start VM</Button>
              {back && env && <Button variant="primary" size="md" data-stopped-primary="" onClick={() => void startWayBack(env)}>{undoLabel(back)}</Button>}
            </>
          }
        >
          <p className="hint">Your containers, images and volumes are kept inside it.</p>
          {back && <p className="hint"><Ticks text={wayBackNote(back)} /></p>}
        </Empty>
      )}

      {running ? (
        <>
          {containers.error && (
            <Banner
              tone="bad"
              title="Couldn't list containers"
              actions={
                <>
                  <Button size="md" onClick={() => void containers.reload()}>Try again</Button>
                  <Button variant="primary" size="md" onClick={start}>
                    Restart {profile.name}
                  </Button>
                </>
              }
            >
              {firstLine(containers.error)}
              {/Cannot connect|did not answer/.test(containers.error) && " The machine may be stuck."}
            </Banner>
          )}
          {containers.data === null ? (
            // First load: four skeleton rows, header already visible (search and New shown).
            <SkeletonRows rows={4} />
          ) : all.length === 0 ? (
            // Right after switching, the data comes first: a `compose up` before it makes new empty volumes.
            <Empty
              icon="box"
              title="No containers yet"
              actions={
                <>
                  <Button variant="primary" size="md" onClick={() => setPicking(true)}>Run an image</Button>
                  <Button size="md" onClick={() => setComposeOpen(true)}>Start a Compose project</Button>
                  {onBring && <Button variant="ghost" size="md" onClick={() => onBring()}>Bring over from Docker Desktop</Button>}
                </>
              }
            >
              {onBring ? "Your Docker Desktop volumes are still on this Mac. Bring them over first, so your projects start with their data." : "Run an image, or start a Compose project from a folder on your Mac."}
            </Empty>
          ) : (
            <List aria-label="Containers">
              <TableHeadRow />
              {nodes}
            </List>
          )}
          {term && shown.length === 0 && (
            <Empty icon="search" title={`Nothing matches "${term}".`} actions={<Button size="md">Clear search</Button>} />
          )}
        </>
      ) : (
        // Engine stopped: header shows only the title (no search, no New).
        <Empty
          icon="box"
          title={`${profile.name} is stopped`}
          actions={<Button variant="primary" size="md" onClick={start}>Start {profile.name}</Button>}
        >
          Your containers and data are kept. Start the machine to see them.
        </Empty>
      )}

      <ProblemInspector
        content={inspector}
        onClose={() => setInspect(null)}
        onFix={() => { if (inspectFix && !inspectFix.locked) void inspectFix.go(); }}
        onLogs={() => { const c = inspect?.c; setInspect(null); if (c) setDetailId(c.ID); }}
        onShell={() => {
          const c = inspect?.c;
          const a = c ? apps.find((x) => x.rows.some((r) => r.ID === c.ID)) : undefined;
          setInspect(null);
          if (ctx && c && a) void openShell(ctx, c.Names).catch((e: unknown) => fail(a, e instanceof Error ? e.message : String(e)));
        }}
      />

      {composeOpen && ctx && (
        <ComposeProjects ctx={ctx} scan={compose} containers={all} attention={problems} query={term && shown.length === 0 ? term : ""} onClose={() => setComposeOpen(false)} onChanged={fixed} />
      )}
      {logsOf && ctx && logsOf.dir && (
        <Sheet open={logsOf !== null} onClose={() => setLogsOf(null)} title={`Logs of ${logsOf.name}`}>
          <ComposeLogs ctx={ctx} file={`${logsOf.dir}/${logsOf.files[0]}`} project={logsOf.name} />
        </Sheet>
      )}
      {picking && ctx && <RunPicker ctx={ctx} onClose={() => setPicking(false)} onPick={(ref) => { setPicking(false); setRunImage(ref); }} />}
      {runImage && ctx && <RunPanel ctx={ctx} arch={profile.arch} image={runImage} onClose={() => setRunImage(null)} onRan={(id, name) => { setRunImage(null); setHighlight(id); toast({ text: `Started ${name}` }); }} />}
    </>
  );
}

const ING: Record<Action, string> = { up: "Starting…", stop: "Stopping…", restart: "Restarting…", down: "Removing…", build: "Rebuilding…", pull: "Updating…" };
const DID: Record<Action, string> = { up: "start", stop: "stop", restart: "restart", down: "go away", build: "rebuild", pull: "update" };
// How a container last ended: true of that run only.
const ENDED = new Set(["oom", "crashed"]);
const tilde = (dir: string) => dir.replace(/^\/Users\/[^/]+/, "~");
const firstLine = (t: string) => t.split("\n").map((l) => l.trim()).find(Boolean) ?? t;
// "shop-web-1" reads as "web" inside the shop project; a container named some other way keeps its name.
const serviceName = (c: C, project: string) => {
  const svc = /(?:^|,)com\.docker\.compose\.service=([^,]+)/.exec(c.Labels ?? "")?.[1];
  return svc ?? (c.Names.startsWith(`${project}-`) ? c.Names.slice(project.length + 1).replace(/-\d+$/, "") : kubeName(c));
};

// A row is found again by the text of its name; a removed row hands focus to its neighbour, never to the page body.
function focusName(name: string): void {
  const node = [...document.querySelectorAll<HTMLElement>(".list .row .name")].find((n) => n.textContent === name);
  node?.closest<HTMLElement>(".row")?.focus();
}

// Highlight a row after an action (e.g. after a successful Run): scroll into view and focus.
function setHighlight(id: string): void {
  const node = [...document.querySelectorAll<HTMLElement>(".list .row .name")].find((n) => n.textContent === id);
  node?.closest<HTMLElement>(".row")?.focus();
}

// A container that hit its own memory limit, on home: one button at the right edge. While the file still sets the
// old limit (or can't be read), Open compose.yaml, to raise it; once it is raised, Apply and start (a plain start
// would keep the old limit); when what it depends on isn't running, the project's own Start, since Apply leaves those.
// One button, chosen by what the file says now; each state is its own button (its own key), so a screen reader never
// hears one button change its name under it. When the button changes while it has focus, focus moves to the new one,
// and the change is said in the page's polite region.
function LimitLine({ who, text, detail, fix, ctx, project, locked, lockWhy, onApply, onStart, onOpenFail, onSay, child, onOpen }: { who: string; text: string; detail: string; fix: ProblemFix & { reveal: string }; ctx?: string; project: string; locked: boolean; lockWhy: string; onApply: (service: string) => void; onStart: () => void; onOpenFail: (e: string) => void; onSay: (status: string) => void; child: boolean; onOpen?: () => void }) {
  const a = fix.apply;
  const view = useServiceLimit(ctx, a, true);
  const run = useComposeRun();
  const id = useId();
  const file = fix.reveal.slice(fix.reveal.lastIndexOf("/") + 1);
  const dir = fix.reveal.slice(0, fix.reveal.lastIndexOf("/"));
  const state = a && view.kind === "raised" ? (view.waiting.length ? "start" : "apply") : "open";
  const label = state === "start" ? `Start ${project}` : state === "apply" ? "Apply and start" : `Open ${file}`;
  const opener = useOpenCompose(fix.reveal, true, ({ status, alert }) => (alert ? onOpenFail(alert) : onSay(status)));
  const box = useLimitFlip(state, view.kind, (changed) => a && onSay(flipSaid(a, view.kind === "raised", view.now, state === "open" ? opener.label : label, changed)));
  const why = locked ? <span className="sr-only" id={`${id}-why`}>{lockWhy}</span> : null;
  const lock = { "aria-disabled": locked || undefined, "aria-describedby": why ? `${id}-why` : undefined };
  const mine = !!a && run.busy?.service === a.service && run.busy.dir === dir;
  const openerName = `${opener.failed?.finder ? "Show in Finder" : opener.label}: ${file}, ${a?.service ?? project}`;
  const button = !a || state === "open"
    ? <Button size="xs" aria-disabled={opener.pending || undefined} aria-label={openerName} onClick={() => { if (!opener.pending) void (opener.failed?.finder ? opener.reveal() : opener.open()); }}>{opener.failed?.finder ? "Show in Finder" : opener.label}</Button>
    : state === "start"
      ? <Button key="start" size="xs" {...lock} aria-label={`Start ${project}: ${a.service} needs ${view.waiting.join(" and ")}`} onClick={() => !locked && onStart()}>{label}</Button>
      : <Button key="apply" size="xs" {...lock} aria-label={`${mine ? "Starting" : "Apply and start"} ${a.service}`} title={`docker compose up -d --no-deps ${a.service}`} onClick={() => !locked && onApply(a.service)}>{mine ? "Starting…" : label}</Button>;
  const action = <span ref={box}>{button}</span>;
  if (a && state !== "open") {
    // Nothing is failing now; one step is waiting. So the line is neutral, like a stopped container's.
    const words = raisedLine(a, view.now, view.waiting, project);
    return <Problem level="info" text={<><Ticks text={`${who}${who ? words.replace(/^Its /, "its ") : words}`} />{why}</>} title={detail} action={action} child={child} onOpen={onOpen} />;
  }
  return <Problem level="bad" text={<><Ticks text={text} />{(opener.failed?.text ?? opener.hint) && <span className="hint"><Ticks text={opener.failed?.text ?? opener.hint} /></span>}{why}</>} title={detail} action={action} child={child} onOpen={onOpen} />;
}

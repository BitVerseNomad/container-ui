// The home screen: your apps, one row each (a Compose project, a loose container, or Kubernetes), with one main
// button and a "..." menu for the rest. Problems show once, under their row. Everything deeper lives one click in.
import { openShell } from "./lib/shell";
import { activity, dockerLine, ranVm } from "./lib/activity";
import { score } from "./lib/fuzzy";
import { ReactNode, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
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
import { appStoppedVersion, subscribeAppStopped } from "./lib/appStopped";
import { App, appState, appsFrom, downLine, finished, lastRunOver, listed, runInfo, startWhat, stateWord, withAppStop } from "./lib/homeRows";
import { Icon } from "./ui/icons";
import "./home.css";
import Menu from "./ui/Menu";
import type { MenuItem } from "./ui/Menu";
import VmStrip from "./VmStrip";
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
import { ComposeScan } from "./useComposeScan";
import ContainerDetail from "./ContainerDetail";
import type { Finding, Report } from "./lib/doctor";
import { setMuted } from "./lib/muted";
import { fixAction, useFixRuns } from "./FixIt";
import { biggerFix } from "./lib/sharedFix";
import Ticks, { plain } from "./ui/Ticks";
import { useDesktopOffer } from "./desktopOffer";
import { gapLine } from "./lib/bringOver";
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
// ids: when only some of a project's containers are started (its stopped ones), the wait ends once those run; the
// project as a whole may stay partly running (a crashed job), which is not the target.
type Pending = { target: "running" | "stopped"; word: string; since: number; ids?: string[] };

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
  // Set while Docker Desktop's data is still on the Mac and some of it isn't in Colima (the same rule as Doctor's row).
  // only: the volume to pick alone, from the problem line of the row that uses it. returnTo: where focus goes if that
  // line is gone when the panel closes (the row's name button).
  onBring?: (only?: string[], returnTo?: string) => void;
  // The Doctor's `docker inspect` of every container (restart policy, ports, health check), read every 30 s. It
  // decides whether a container that exited 0 is a finished job or a stopped service.
  inspected?: unknown[];
};

// The main button's label each row last showed, kept across tabs, so a VM size change doesn't flip it while it runs.
const seenVerb = new Map<string, "Start" | "Stop">();

export default function Containers({ profile, ctx, vm, onVm, reload, detailId, setDetailId, onPull, onProfiles, compose, onImages, onKubernetes, report, onReport, onBring, inspected }: Props) {
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
  useEffect(() => { if (running && !resizing(rs) && !rs.outcome) clearWayBack(); }, [running, rs]); // eslint-disable-line react-hooks/exhaustive-deps
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
    if (a) document.querySelector<HTMLElement>(rowSel(a.key))?.focus();
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
    document.querySelector<HTMLElement>(rowSel(gone[0][1]))?.focus();
  });
  useEffect(() => {
    const gone = [...downShown.current].filter((k) => !downNow.has(k));
    downShown.current = downNow;
    // Lines hidden by a VM resize didn't go because they were started: focus stays where it is.
    if (holding || !gone.length || (document.activeElement && document.activeElement !== document.body)) return;
    document.querySelector<HTMLElement>(rowSel(gone[0]))?.focus();
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
    return <ContainerDetail ctx={ctx} id={detailId} listed={compose.paths ?? []} appProblems={named ? report?.extra.get(named) : undefined} onBack={() => setDetailId(null)} onReplaced={(n) => { setDetailId(n); fixed(); }} />;
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

  // The failure card stays mounted through the way back, so the good result lands where focus already is.
  const failedChange = rs.card && !!rs.outcome && rs.from?.startsWith("home:") === true;
  const problemsOf = (rows: C[]) => rows.flatMap((c) => {
    const p = problems.get(c.Names)?.[0];
    const run = runFor(runs, c.Names);
    return p || run ? [{ c, p, run }] : [];
  });

  // One line under a row: what is wrong, in plain words, and the one thing to do about it.
  const problemLine = ({ c, p, run }: { c: C; p?: Finding; run?: Run }, prefix: boolean, a?: App<C>) => {
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
        onSay={(status) => setSaid({ status, alert: "" })} />;
    }
    const action = fix?.reveal ? see : fix?.vm ? (
      // Share the folder (or make it writable): the VM restarts and what ran starts again; the result stays under the row.
      <VmChangeOr from={`home:${c.Names}:${p.id}`} change={fix.vm} title={`${said}, ${c.Names}`} noStatus={failedChange} />
    ) : fix?.resize ? (
      <ResizeOr from={`home:${c.Names}:${p.id}`} title={`${p.short ?? p.title}, ${c.Names}`} need="memory" alsoStart={[c.Names]} fallback={see} noProfiles vmWords />
    ) : one ? (
      // A Fix replaces containers; while the VM stops or restarts there is no Docker to replace them in.
      <button className="small primary" aria-label={`${r ? "Try again" : one.label}: ${plain(p.short ?? p.title)}, ${c.Names}`} aria-disabled={one.locked || undefined} title={one.locked ? "Waits for what is changing Docker now" : undefined} onClick={() => !one.locked && one.go()}>{r ? "Try again" : names.length > 1 ? `Fix ${names.join(" and ")}…` : `${one.label}…`}</button>
    ) : fix?.go === "Images" ? (
      <button className="small" onClick={onImages}>Open Images</button>
    ) : see;
    return <Line key={c.ID} level={p.level === "bad" ? "bad" : "warn"} text={<Ticks text={text} />} title={plain(p.detail)} action={action} />;
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
    const stopped = a.rows.filter((c) => c.State !== "running" && !finished(c, infoOf(c)));
    const what = startWhat(stopped.map((c) => serviceName(c, a.name)));
    return [
      ...(stopped.length && anyUp ? [{ label: `Start ${what}`, icon: <Icon name="play" size={13} />, hint: "docker start", disabled: lock, onSelect: () => void act(a, ["start", ...stopped.map((c) => c.ID)], { target: "running", word: "Starting…", since: Date.now(), ids: stopped.map((c) => c.ID) }, `${listed(stopped.map((c) => serviceName(c, a.name)))} started`) }] : []),
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
    const { state, up, of } = appState(a.rows, infoOf);
    const pend = pending.get(a.key);
    const mine = !!composeRun.busy && inDir(a, composeRun.busy.dir) && a.files.length > 0;
    // A VM size change restarts everything at once: the state column says so, and the button keeps the label the
    // user last saw, locked, until the list shows the real state again.
    const withVm = holding && !kube;
    const changing = withVm ? "Restarting…" : pend?.word ?? (mine ? ING[composeRun.busy!.action] : null);
    const expanded = open.has(a.key) || (!!term && isProject && a.rows.some(hit));
    const issues = problemsOf(a.rows);
    const rowGaps = kube ? [] : gaps.filter((g) => a.rows.some((c) => g.users.includes(c.Names)));
    // Down, counted, and with no problem line of its own: they share one plain line, so the lines and the count
    // agree (every container "N of M running" is short of is on a line). Finished jobs aren't counted, so no line.
    // Only once the Doctor has answered: before that a crashed service would read "is stopped", then change.
    // Not while the VM is resized: it is about to start what ran, and until the list is read again afterwards a
    // container that is coming back would read stopped.
    const down = !withVm && isProject && state === "partly" && report ? a.rows.filter((c) => c.State !== "running" && !finished(c, infoOf(c)) && !issues.some((i) => i.c.ID === c.ID)) : [];
    const downWords = down.length ? downLine(down.map((c) => serviceName(c, a.name))) : null;
    if (downWords && !expanded) downNow.add(a.key);
    if (!expanded) issues.forEach((i) => linesNow.set(`${i.c.ID}\u0000${i.p?.id ?? "run"}`, a.key));
    // Counted apart: a problem needs a fix, a stopped container only needs starting.
    const lines = issues.length + rowGaps.length;
    const said = `${lines ? `, ${lines} problem${lines === 1 ? "" : "s"}` : ""}${down.length ? `, ${down.length} stopped` : ""}`;
    // A bigger VM asked for from an out-of-memory line: once that container runs, its line is gone, and the result
    // stays on its own row under the project until Dismiss. A failure keeps the line, and the result stays in it.
    const resizedName = rs.from?.startsWith("home:") ? rs.from.split(":")[1] : null;
    const resizedHere = !!resizedName && (!!rs.outcome || !!rs.progress) && a.rows.some((c) => c.Names === resizedName) && !issues.some((i) => i.c.Names === resizedName && (i.p?.fix?.resize || i.p?.fix?.vm));
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
            aria-label={`${isProject ? `${a.name}, project` : kube ? "Kubernetes" : a.name}, ${word}${said}`}
            data-row={encodeURIComponent(a.key)}
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
        {/* First: a database that came up empty can explain the problems under it. */}
        {rowGaps.map((g) => (
          <Line key={`gap-${g.name}`} level="warn" text={<Ticks text={gapLine(g)} />} action={<button className="small" aria-label={`Bring it over: ${g.name} from Docker Desktop`} onClick={() => onBring?.([g.name], rowSel(a.key))}>Bring it over…</button>} />
        ))}
        {!expanded && !kube && issues.map((i) => problemLine(i, isProject, a))}
        {/* Last: what is simply stopped, after the lines that say what went wrong. */}
        {!expanded && downWords && (
          <Line
            level="off"
            text={downWords.text}
            action={<button className="small" aria-label={downWords.label} aria-disabled={lock || undefined} onClick={() => { if (!lock) void act(a, ["start", ...down.map((c) => c.ID)], { target: "running", word: "Starting…", since: Date.now(), ids: down.map((c) => c.ID) }, downWords.done); }}>{downWords.button}</button>}
          />
        )}
        {resizedHere && !failedChange && <div className="problem result"><ResizeStatus from={rs.from!} /></div>}
        {isProject && expanded && (
          <ul className="svc" id={`svc-${a.key}`} aria-label={`Services of ${a.name}`}>
            {a.rows.filter((c) => !term || hit(c) || score(a.name, term) > 0).map((c) => {
              const cUp = c.State === "running";
              const i = issues.find((x) => x.c.ID === c.ID);
              const cWord = stateWord(c, infoOf(c));
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
      <div className="sr-only" role="status" aria-live="polite">{plain(said.status)}</div>
      <div className="sr-only" role="alert">{plain(said.alert)}</div>
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
      {failedChange && <div className="problem result stopped"><ResizeStatus from={rs.from!} title={`The VM ${profile.name} is stopped`} after={() => setTimeout(() => document.querySelector<HTMLElement>("[data-stopped-primary]")?.focus(), 0)} /></div>}
      {!running && !vm.op && !vm.failure && !failedChange && (
        <Blank title={<>The VM &ldquo;{profile.name}&rdquo; is stopped</>} body="Your containers, images and volumes are kept inside it." note={back ? wayBackNote(back) : undefined}>
          <button className={back ? undefined : "primary"} data-stopped-primary={back ? undefined : ""} onClick={start}>Start VM</button>
          {back && env && <button className="primary" data-stopped-primary="" onClick={() => void startWayBack(env)}>{undoLabel(back)}</button>}
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
                ...(onBring ? [{ label: "Bring over from Docker Desktop…", icon: <Icon name="database" size={13} />, divider: true, onSelect: () => onBring() }] : []),
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
            // Right after switching, the data comes first: a `compose up` before it makes new empty volumes.
            <Blank title="No containers yet" body={onBring ? "Your Docker Desktop volumes are still on this Mac. Bring them over first, so your projects start with their data." : "Run an image, or start a Compose project from a folder on your Mac."}>
              {onBring && <button className="primary" onClick={() => onBring()}>Bring over from Docker Desktop</button>}
              <button className={onBring ? undefined : "primary"} onClick={() => setPicking(true)}>Run an image</button>
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
// A row's name button, found again by its key (a project key holds a NUL, so it is stored encoded).
// How a container last ended: true of that run only.
const ENDED = new Set(["oom", "crashed"]);
const rowSel = (key: string) => `[data-row="${encodeURIComponent(key)}"]`;
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

// off: a plain line for what is only stopped (nothing went wrong), in the page's own colors.
// A container that hit its own memory limit, on home: one button at the right edge. While the file still sets the
// old limit (or can't be read), Open compose.yaml, to raise it; once it is raised, Apply and start (a plain start
// would keep the old limit); when what it depends on isn't running, the project's own Start, since Apply leaves those.
// Home's line for a container that hit its own limit. One button, chosen by what the file says now; each state is its
// own button (its own key), so a screen reader never hears one button change its name under it. When the button
// changes while it has focus, focus moves to the new one, and the change is said in the page's polite region.
function LimitLine({ who, text, detail, fix, ctx, project, locked, lockWhy, onApply, onStart, onOpenFail, onSay }: { who: string; text: string; detail: string; fix: ProblemFix & { reveal: string }; ctx?: string; project: string; locked: boolean; lockWhy: string; onApply: (service: string) => void; onStart: () => void; onOpenFail: (e: string) => void; onSay: (status: string) => void }) {
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
  const button = !a || state === "open"
    ? opener.button(a?.service ?? project, "small")
    : state === "start"
      ? <button key="start" className="small" {...lock} aria-label={`Start ${project}: ${a.service} needs ${view.waiting.join(" and ")}`} onClick={() => !locked && onStart()}>{label}</button>
      : <button key="apply" className="small" {...lock} aria-label={`${mine ? "Starting" : "Apply and start"} ${a.service}`} title={`docker compose up -d --no-deps ${a.service}`} onClick={() => !locked && onApply(a.service)}>{mine ? "Starting…" : label}</button>;
  const action = <span className="limit-action" ref={box}>{button}</span>;
  if (a && state !== "open") {
    // Nothing is failing now; one step is waiting. So the line is neutral, like a stopped container's.
    const words = raisedLine(a, view.now, view.waiting, project);
    return <Line level="off" text={<><Ticks text={`${who}${who ? words.replace(/^Its /, "its ") : words}`} />{why}</>} title={detail} action={action} />;
  }
  return <Line level="bad" text={<><Ticks text={text} />{(opener.failed?.text ?? opener.hint) && <span className="hint limit-hint"><Ticks text={opener.failed?.text ?? opener.hint} /></span>}{why}</>} title={detail} action={action} />;
}

function Line({ level, text, title, action }: { level: "bad" | "warn" | "ok" | "busy" | "off"; text: ReactNode; title?: string; action?: ReactNode }) {
  return (
    <div className={`problem ${level}`} title={title}>
      {/* Icon and text together: the icon sits on the text's first line, and the pair is centered against the button. */}
      <span className="problem-lead">
        <Icon name={level === "ok" ? "check" : level === "bad" ? "close" : level === "busy" ? "restart" : level === "off" ? "stop" : "alert"} size={14} />
        <span className="problem-text">{text}</span>
      </span>
      {action}
    </div>
  );
}

function Blank({ title, body, note, children }: { title: ReactNode; body: string; note?: string; children: ReactNode }) {
  return (
    <div className="blank">
      <span className="blank-icon"><Icon name="box" size={32} /></span>
      <h2>{title}</h2>
      <p className="hint">{body}</p>
      {note && <p className="hint"><Ticks text={note} /></p>}
      <div className="actions-inline">{children}</div>
    </div>
  );
}

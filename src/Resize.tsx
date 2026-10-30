// Gives a small VM a better size in one click, from any place that notices it is small: the Doctor's size row,
// a container that ran out of memory, the note about Kafka and the like. One run at a time, for the whole app.
// The run outlives the page that started it (switching tabs unmounts it, the VM keeps restarting), so its state
// lives here, like a Compose run. The VM part goes through App's VM runner, so the sidebar, the VM strip and every
// container button lock and follow it. Its commands go to All commands without a toast: the row reports the run.
import { ReactNode, createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor, docker, dockerJson } from "./api";
import { dockerLocked } from "./dockerLock";
import { activity, dockerLine } from "./lib/activity";
import { parseLabels } from "./lib/compose";
import type { Host, RestartPlan, RunningRow } from "./lib/vmSize";
import { KUBE_BACK, confirmText, doneText, failLine, explainResize, nameList, notStarted, planWith, resizeTo, sizeWords, startReason, stepDown, stepUp, withoutKube } from "./lib/vmSize";
import { changeBusy, changeCommand, changeConfirm, changeConfirmLabel, changeDone, changeFail, changeHint, changeLabel, changeProgress, stillFailed, undoLabel, undoOf } from "./lib/vmChange";
import { dnsDone } from "./lib/netFacts";
import { parseColimaConfig } from "./lib/colimaConfig";
import type { VmChange } from "./lib/vmChange";
import { useConfirm } from "./ui";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";
import Ticks, { plain } from "./ui/Ticks";

type Size = { cpus: number; memory: number };
// Returns the error text, or null when it worked.
export type RunVm = (op: "restarting" | "starting", cmd: string, args: Record<string, unknown>) => Promise<string | null>;
// What a resize needs from App: the VM on screen, the Mac, App's VM runner, the latest `docker inspect` of the
// containers (for the confirm's count, and the list to start again when `docker ps` can't answer).
// vmBusy: a VM operation alone (container fixes wait for it); locked adds a Compose run, a container fix or a resize.
export type ResizeEnv = { profile: Profile | null; host: Host | null; pick: Size | null; runVm: RunVm; containers?: unknown[]; locked: boolean; vmBusy: boolean; onProfiles: () => void };
const Env = createContext<ResizeEnv | null>(null);
export const ResizeProvider = ({ value, children }: { value: ResizeEnv; children: ReactNode }) => <Env.Provider value={value}>{children}</Env.Provider>;
export const useResizeEnv = () => useContext(Env);

// outcome: the last step's result, kept on screen (with its buttons) while the next step runs, until Dismiss.
// pressed: the button whose step is running, so it says so instead of going away.
// plan: what was running before the restart, and how to start it again; count: how many containers that is.
// short: the reason on the result line; long: the help behind See why, when there is more to say.
type Failed = { name: string; short: string | null; long: string | null; memory?: boolean };
type Outcome =
  | { kind: "done"; text: string; failed: Failed[]; slow: string[]; bad?: true }
  | { kind: "failed"; text: string; step: Size | null; tried: Size; stopped: boolean }
  | { kind: "refused"; text: string };
// card: a change failed and left the VM stopped; home shows its failure card, and keeps it through the way back, until Dismiss.
// kube: how many running containers Kubernetes owns (left to it, not counted). extra: a container that stopped for
// lack of memory (the line the resize was started from); started once the rest runs again, and said by name.
export type ResizeState = { from: string | null; profile: string; target: Size | null; was: Size | null; plan: RestartPlan; change: VmChange | null; count: number; kube: number; extra: string[]; late: string[]; progress: "restarting" | "starting" | null; outcome: Outcome | null; pressed: string | null; tick: number; card: boolean };
const NONE: RestartPlan = { waves: [], healthy: [] };
const IDLE: ResizeState = { from: null, profile: "default", target: null, was: null, plan: NONE, change: null, count: 0, kube: 0, extra: [], late: [], progress: null, outcome: null, pressed: null, tick: 0, card: false };
let state = IDLE;
const subs = new Set<() => void>();
const set = (next: Partial<ResizeState>) => { state = { ...state, ...next }; subs.forEach((f) => f()); };
export const resizeState = () => state;
export const useResize = () => useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => state);
// From the click until the containers run again: the VM is down or Docker is busy, so nothing else may touch them.
export const resizing = (s: ResizeState) => s.progress !== null;
export const resetResize = () => set(IDLE);

// Which pages show a run's result right now. A run that ends while its page is closed is announced by App instead.
const shownOn = new Map<string, number>();
const onScreen = (from: string | null) => !!from && (shownOn.get(from) ?? 0) > 0;
// The Doctor's way to read the facts again. A change that worked calls it before its result shows, so the finding it
// fixed is gone the moment the success row appears (it is not left to the next 30-second read).
// Each page that shows facts (the Doctor, the container list) adds its own read; the result waits for all of them.
const refreshHooks = new Set<() => Promise<unknown>>();
export const addChangeRefresh = (f: () => Promise<unknown>) => { refreshHooks.add(f); return () => { refreshHooks.delete(f); }; };
const REFRESH_MS = 8000;

// The change that last failed to start the VM, kept after Dismiss and across a relaunch (localStorage, every access
// guarded): the profile still has the list that failed saved. The stopped card offers the way back next to a plain
// Start VM, and only while the saved list still equals the failed one (wayBackApplies).
type WayBack = { profile: string; change: VmChange };
const WAY_KEY = "colima-ui.wayBack";
const store = (): Storage | null => { try { return typeof localStorage === "undefined" ? null : localStorage; } catch { return null; } };
const loadWay = (): WayBack | null => {
  try { const raw = store()?.getItem(WAY_KEY); const w = raw ? (JSON.parse(raw) as WayBack) : null; return w && typeof w.profile === "string" && (w.change?.kind === "mounts" || w.change?.kind === "proxy") ? w : null; } catch { return null; }
};
const saveWay = (w: WayBack | null) => { try { if (w) store()?.setItem(WAY_KEY, JSON.stringify(w)); else store()?.removeItem(WAY_KEY); } catch { /* the way back just won't outlive this run */ } };
let wayBack: WayBack | null = loadWay();
const setWay = (w: WayBack | null) => { wayBack = w; saveWay(w); };
export const clearWayBack = () => setWay(null);
// Read the file again and keep the way back only if the saved setting is still the one that failed. Nothing is said
// when it isn't: the person changed it, and the plain card is right.
export async function wayBackApplies(profile: string): Promise<VmChange | null> {
  wayBack = wayBack ?? loadWay();
  const w = wayBack;
  if (!w || w.profile !== profile) return null;
  const read = await invoke<{ home: string; yaml: string }>("colima_config", { name: profile }).catch(() => null);
  if (!read || !read.yaml) return null;
  const cfg = parseColimaConfig(read.yaml);
  if (!stillFailed(w.change, cfg, read.home)) { if (wayBack === w) setWay(null); return null; }
  return undoOf(w.change) ? w.change : null;
}
// Starts the VM with the folders it had, from the stopped card. false when there is nothing to go back to.
export async function startWayBack(env: ResizeEnv): Promise<boolean> {
  const p = env.profile;
  const failed = p ? await wayBackApplies(p.name) : null;
  const back = failed ? undoOf(failed) : null;
  if (!p || !back || env.locked || state.progress) return false;
  const size = { cpus: p.cpus, memory: Math.round(p.memory / 1024 ** 3) };
  set({ ...IDLE, tick: state.tick, from: `home:wayback:${p.name}`, profile: p.name, target: size, change: back, progress: "restarting", pressed: "main", card: true });
  const { cmd, args } = changeCommand(back, p.name, false);
  const err = await env.runVm("restarting", cmd, args);
  if (err) set({ progress: null, pressed: null, outcome: { kind: "failed", text: changeFail(back, err, p.name), tried: size, step: null, stopped: false }, tick: state.tick + 1 });
  else { setWay(null); finish([], []); }
  return true;
}

// The run whose result a ResizeStatus has already moved focus to (and so said once). A status that mounts later for
// the same result (the line it was in went away when the VM stopped) takes focus if this is not its tick yet, and
// App's announcer stays quiet for a tick that was already shown.
let lastShownTick = -1;

// The size a resize from here would give, or null when the app can't pick a better one (then it is the user's call).
// need "memory": a container ran out of memory, so only the memory changes and the CPUs stay as they are.
export function useResizeTarget(need: "any" | "memory" = "any"): Size | null {
  const env = useResizeEnv();
  const s = useResize();
  if (s.progress && s.target && !s.change) return s.target;
  const p = env?.profile;
  if (!env || !p || p.status !== "Running") return null;
  const to = resizeTo({ cpus: p.cpus, memory: p.memory }, env.pick, env.host?.memory);
  if (!to || need === "any") return to;
  return to.memory > Math.round(p.memory / 1024 ** 3) ? { cpus: p.cpus, memory: to.memory } : null;
}

type Inspected = { Name?: string; State?: { Running?: boolean }; Config?: { Labels?: Record<string, string> | null } };
const fromInspect = (containers?: unknown[]): RunningRow[] | null =>
  containers ? (containers as Inspected[]).filter((c) => c.State?.Running).map((c) => ({ name: (c.Name ?? "").replace(/^\//, ""), labels: c.Config?.Labels ?? {} })) : null;

// The VM part: stop, start with the size, then start what was running. Each step ends with focus on its result.
async function wayBackStillHolds(c: VmChange, profile: string): Promise<boolean> {
  const read = await invoke<{ home: string; yaml: string }>("colima_config", { name: profile }).catch(() => null);
  // A file that can't be read says nothing against the way back; one that was changed does.
  return !read || !read.yaml || stillFailed(c, parseColimaConfig(read.yaml), read.home);
}
// undo: start the VM the way the profile was before the change (the new setting stays saved when a start fails).
async function restart(env: ResizeEnv, size: Size, pressed: string, undo = false) {
  const p = env.profile;
  if (!p) return;
  const back = undo && state.change ? undoOf(state.change) : null;
  // The way back only goes back to what failed: if the saved list was changed since (by hand or in Profiles), it is
  // dropped and the plain stopped card shows.
  if (undo && state.change && !(await wayBackStillHolds(state.change, state.profile))) { setWay(null); return set({ ...IDLE, tick: state.tick + 1 }); }
  set({ progress: "restarting", target: size, pressed, ...(back ? { change: back } : {}) });
  // A folder, proxy or plain restart (state.change) is its own backend command; it doesn't touch the size.
  const { cmd, args } = state.change ? changeCommand(state.change, state.profile, p.status === "Running") : { cmd: "apply_resources", args: { opts: { name: state.profile, cpus: size.cpus, memory: size.memory }, restart: p.status === "Running" } };
  const err = await env.runVm("restarting", cmd, args);
  if (err && state.change) {
    // The backend checks everything before it stops the VM: "Nothing changed" says the VM is as it was.
    const refused = /^\s*Nothing changed/.test(err);
    // The failure is told in the change's own words; its text already says the VM is stopped.
    const text = refused ? err.split("\n")[0].trim() : changeFail(state.change, err, state.profile);
    if (!refused && undoOf(state.change)) setWay({ profile: state.profile, change: state.change });
    return set(refused ? { progress: null, pressed: null, outcome: { kind: "refused", text }, tick: state.tick + 1 } : { progress: null, pressed: null, card: true, outcome: { kind: "failed", text, tried: size, step: null, stopped: false }, tick: state.tick + 1 });
  }
  if (err) {
    const why = explainResize(err, state.profile);
    // A memory failure leaves the VM stopped; a smaller size usually fits.
    const text = why.memory ? `${size.memory} GiB didn't fit in free memory.` : why.text;
    return set({ progress: null, pressed: null, outcome: { kind: "failed", text, tried: size, step: why.memory ? stepDown(size, state.was) : null, stopped: true }, tick: state.tick + 1 });
  }
  await startAgain(state.plan, pressed);
}

// One `docker start` of a wave. Docker starts what it can and names the rest on its last line.
async function startWave(ctx: string, names: string[]): Promise<Failed[]> {
  const args = ["start", ...names];
  return activity.ran("start", dockerLine(ctx, args), () => docker(ctx, args), nameList(names), true).then(
    () => [],
    (e: unknown) => notStarted(String(e), names).map((name) => ({ name, ...startReason(String(e), name, state.change ? undefined : state.target?.memory) })),
  );
}

// Waits until these report healthy, as Compose would before starting what needs them. One without a health
// check counts as ready. Gives up after a minute (or when one turns unhealthy) and returns the ones not healthy.
const HEALTH_WAIT_MS = 60_000;
async function untilHealthy(ctx: string, names: string[]): Promise<string[]> {
  const until = Date.now() + HEALTH_WAIT_MS;
  for (;;) {
    const states = await docker(ctx, ["inspect", ...names]).then((out) => JSON.parse(out) as { Name: string; State?: { Health?: { Status?: string } } }[]).catch(() => null);
    // Docker may still be settling after the restart: a failed read is tried again until the minute is up.
    if (!states) {
      if (Date.now() >= until) return names;
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }
    const status = (n: string) => states.find((c) => c.Name.replace(/^\//, "") === n)?.State?.Health?.Status;
    const waiting = names.filter((n) => status(n) && status(n) !== "healthy");
    if (!waiting.length || waiting.some((n) => status(n) === "unhealthy") || Date.now() >= until) return waiting;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// Plain `docker start` of what ran, in waves (a service after the ones it depends on). No compose file is read,
// so nothing is recreated, rebuilt or started twice.
async function startAgain(plan: RestartPlan, pressed: string) {
  set({ progress: "starting", pressed });
  const ctx = ctxFor(state.profile);
  const failed: Failed[] = [];
  const slow: string[] = [];
  for (const wave of plan.waves) {
    failed.push(...(await startWave(ctx, wave)));
    const needed = wave.filter((n) => plan.healthy.includes(n) && !failed.some((f) => f.name === n));
    if (needed.length) slow.push(...(await untilHealthy(ctx, needed)));
  }
  // Last, after the usual waves: an out-of-memory container whose compose labels couldn't be read.
  if (state.late.length) failed.push(...(await startWave(ctx, state.late)));
  // A restart for the network says whether the names work now, from inside the VM, before it says "done".
  const names = state.change?.kind === "restart" ? await dnsAfter(state.profile) : null;
  if (state.change && refreshHooks.size) await Promise.race([Promise.all([...refreshHooks].map((h) => h().catch(() => {}))), new Promise((r) => setTimeout(r, REFRESH_MS))]);
  finish(failed, slow, names);
}

// Asks the VM to look up a name, once more after a pause when it fails (a start still settling is not an answer).
async function dnsAfter(profile: string): Promise<"resolved" | "failed" | "unknown"> {
  const ask = () => invoke<string>("vm_dns_probe", { name: profile }).catch(() => "unknown");
  let got = await ask();
  if (got === "failed") { await new Promise((r) => setTimeout(r, 3000)); got = await ask(); }
  return got === "resolved" || got === "failed" ? got : "unknown";
}

const slowLine = (slow: string[]) => (slow.length ? ` ${nameList(slow)} ${slow.length === 1 ? "wasn't" : "weren't"} healthy after a minute; what needs ${slow.length === 1 ? "it" : "them"} was started anyway.` : "");
const finish = (failed: Failed[], slow: string[] = [], dns: "resolved" | "failed" | "unknown" | null = null) => {
  const names = failed.map((f) => f.name);
  const main = failed.filter((f) => !state.extra.includes(f.name)).length;
  const extraOk = state.extra.filter((n) => !names.includes(n));
  const text = (state.change ? changeDone(state.change, state.count, main, extraOk, dns ? dnsDone(dns) : undefined) : doneText(state.target!, state.count, main, state.was, extraOk)) + (state.kube ? ` ${KUBE_BACK}` : "") + slowLine(slow);
  set({ progress: null, pressed: null, outcome: { kind: "done", text, failed, slow, ...(dns === "failed" ? { bad: true as const } : {}) }, tick: state.tick + 1 });
};

// One container that didn't start, tried again on its own.
async function startOne(name: string) {
  const o = state.outcome;
  if (state.progress || o?.kind !== "done") return;
  set({ progress: "starting", pressed: `start:${name}` });
  const ctx = ctxFor(state.profile);
  const args = ["start", name];
  const left = o.failed.filter((f) => f.name !== name);
  await activity.ran("start", dockerLine(ctx, args), () => docker(ctx, args), name, true).then(
    () => finish(left),
    (e: unknown) => finish([...left, { name, ...startReason(String(e), name, state.change ? undefined : state.target?.memory) }]),
  );
}

// Asks once, then runs. alsoStart: a container that stopped for lack of memory, started again with the rest.
export async function askResize(env: ResizeEnv, confirm: ReturnType<typeof useConfirm>, size: Size, from: string, alsoStart: string[] = [], change: VmChange | null = null) {
  const p = env.profile;
  if (!p || env.locked || state.progress) return;
  const was = { cpus: p.cpus, memory: Math.round(p.memory / 1024 ** 3) };
  const known = fromInspect(env.containers);
  const shown = known ? withoutKube(known) : null;
  if (!(await confirm(change ? changeConfirm(change, shown?.rows.length ?? null, shown?.kube ? KUBE_BACK : "") : confirmText(size, shown?.rows.length ?? null, was, shown?.kube), change ? changeConfirmLabel(change) : "Restart the VM", { safe: true }))) return;
  // The confirm waited for a click; something else may have started meanwhile. Checked again, then claimed at once.
  if (dockerLocked()) return;
  set({ ...IDLE, tick: state.tick, from, profile: p.name, was, target: size, change, progress: "restarting", pressed: "main" });
  // Read now, not from the last check: the list the app starts again must be exactly what is running.
  const ctx = ctxFor(p.name);
  const ps = await dockerJson<{ Names: string; State: string; Labels?: string }>(ctx, ["ps"])
    .then((l) => l.filter((c) => c.State === "running").map((c) => ({ name: c.Names, labels: Object.fromEntries(parseLabels(c.Labels ?? "")) })))
    .catch(() => null);
  const read = ps ?? fromInspect(env.containers);
  if (!read) return set({ progress: null, pressed: null, outcome: { kind: "refused", text: "Couldn't read which containers are running, so the VM wasn't restarted." }, tick: state.tick + 1 });
  const { rows, kube } = withoutKube(read);
  const extra = alsoStart.filter((n) => !rows.some((r) => r.name === n));
  // The out-of-memory container still exists, exited: its labels put it in its depends_on place.
  const inspected = !extra.length ? [] : await docker(ctx, ["inspect", ...extra])
    .then((out) => (JSON.parse(out) as { Name: string; Config?: { Labels?: Record<string, string> | null } }[]).map((c) => ({ name: c.Name.replace(/^\//, ""), labels: c.Config?.Labels ?? {} })))
    .catch(() => null);
  set({ ...planWith(rows, extra, inspected), kube, extra });
  await restart(env, size, "main");
}

export const dismissResize = () => set({ ...IDLE, tick: state.tick });

// The main button. Doctor's VM row says "Give it 6 CPUs and 8 GiB…"; a container line names the VM, since the
// container isn't what grows ("Give the VM 8 GiB…"). The "…" says a confirm comes first. It stays while the VM
// restarts, saying so, so focus stays on it.
export function ResizeButton({ from, size, title, primary, alsoStart, vmWords }: { from: string; size: Size; title: string; primary?: boolean; alsoStart?: string[]; vmWords?: boolean }) {
  const env = useResizeEnv();
  const s = useResize();
  const confirm = useConfirm();
  const mine = s.from === from && s.pressed === "main";
  const off = !env || env.locked || s.progress !== null;
  const label = mine ? (s.progress === "starting" ? "Starting…" : "Restarting…") : vmWords ? `Give the VM ${size.memory} GiB…` : `Give it ${sizeWords(size)}…`;
  const why = !env ? undefined : s.progress && !mine ? "Another VM size change is running" : env.locked && !mine ? "Waits for the VM, Compose run or container fix that is running" : undefined;
  const reason = useId();
  return (
    <>
      <button className={primary ? "small primary" : "small"} title={why ?? `Restarts the VM with ${sizeWords(size)}`} aria-label={`${label}: ${plain(title)}`} aria-disabled={off || undefined} aria-describedby={why ? reason : undefined} onClick={() => !off && env && askResize(env, confirm, size, from, alsoStart)}>
        {label}
      </button>
      {why && <span id={reason} className="sr-only">{why}</span>}
    </>
  );
}

// The button for a change that restarts the VM without a new size (share a folder, restart for the network, the Mac's
// proxy). Its label says what it does; "…" says a confirm comes first. It stays while the VM restarts, saying so.
export function VmChangeButton({ from, change, title, primary, alsoStart }: { from: string; change: VmChange; title: string; primary?: boolean; alsoStart?: string[] }) {
  const env = useResizeEnv();
  const s = useResize();
  const confirm = useConfirm();
  const mine = s.from === from && s.pressed === "main";
  const off = !env || env.locked || s.progress !== null;
  const label = mine ? changeBusy : changeLabel(change);
  const why = !env ? undefined : s.progress && !mine ? "Another VM change is running" : env.locked && !mine ? "Waits for the VM, Compose run or container fix that is running" : undefined;
  const p = env?.profile;
  // The reason a disabled button waits is spoken with it: a tooltip is not read for a button that can't be pressed.
  const reason = useId();
  return (
    <>
      <button className={primary ? "small primary" : "small"} title={why ?? changeHint(change)} aria-label={`${label}: ${plain(title)}`} aria-disabled={off || !p || undefined} aria-describedby={why ? reason : undefined}
        onClick={() => !off && env && p && askResize(env, confirm, { cpus: p.cpus, memory: Math.round(p.memory / 1024 ** 3) }, from, alsoStart, change)}>
        {label}
      </button>
      {why && <span id={reason} className="sr-only">{why}</span>}
    </>
  );
}

// The button and the run's progress and result under it, for a place with a VM change (home's line, a Doctor row).
export function VmChangeOr({ from, change, title, primary, alsoStart, noStatus, plainRetry }: { from: string; change: VmChange; title: string; primary?: boolean; alsoStart?: string[]; noStatus?: boolean; plainRetry?: boolean }) {
  const s = useResize();
  return (
    <span className="resize-or">
      <span className="actions-inline">{!(s.from === from && s.outcome) && <VmChangeButton from={from} change={change} title={title} primary={primary} alsoStart={alsoStart} />}</span>
      {!noStatus && <ResizeStatus from={from} title={title} plainRetry={plainRetry} />}
    </span>
  );
}

// One line: what happened, and each container that didn't start with its reason.
export const resultText = (o: Outcome) => `${o.text}${o.kind === "failed" && o.stopped ? " The VM is stopped." : ""}${o.kind === "done" ? o.failed.map((f) => ` ${failLine(f)}`).join("") : ""}`;
const isBad = (o: Outcome) => o.kind !== "done" || o.failed.length > 0 || !!o.bad;
const progressText = (s: ResizeState) => (!s.progress || !s.target ? "" : s.change ? changeProgress(s.change, s.progress) : s.progress === "restarting" ? `Restarting the VM with ${sizeWords(s.target)}… about a minute` : "Starting everything that was running…");
export const resizeLine = (s: ResizeState) => progressText(s);

// Where focus goes after Dismiss: the next row's first button a keyboard can reach (not the hidden chevron), else this
// row's name, else the Doctor's first button, else the page heading. Never the page top.
export const REACHABLE = 'button:not([aria-hidden="true"]):not([tabindex="-1"]):not([hidden])';
export function afterDismiss(box: HTMLElement): HTMLElement | null {
  const row = box.closest("li");
  const next = row?.nextElementSibling?.querySelector<HTMLElement>(REACHABLE) ?? row?.querySelector<HTMLElement>(".app-name") ?? document.querySelector<HTMLElement>(".doctor-head button");
  if (next) return next;
  const h1 = document.querySelector<HTMLElement>("main h1");
  if (h1 && !h1.hasAttribute("tabindex")) h1.tabIndex = -1;
  return h1;
}

// Moves focus to a result that has not been shown yet, once, and counts the place as showing it (App's announcer
// stays quiet while one does). A failed result always takes focus, since it is what the person must act on; a good
// one only when focus is lost (the button that started it went away).
function useResultFocus(from: string, mine: boolean, o: Outcome | null, tick: number, line: React.RefObject<HTMLElement>, box: React.RefObject<HTMLElement>) {
  useEffect(() => {
    shownOn.set(from, (shownOn.get(from) ?? 0) + 1);
    return () => { shownOn.set(from, (shownOn.get(from) ?? 1) - 1); };
  }, [from]);
  useEffect(() => {
    if (!mine || !o || lastShownTick === tick) return;
    const lost = !document.activeElement || document.activeElement === document.body;
    if (!isBad(o) && !lost) return;
    lastShownTick = tick;
    line.current?.focus({ preventScroll: true });
    box.current?.scrollIntoView?.({ block: "nearest" });
  }, [tick, mine, o]); // eslint-disable-line react-hooks/exhaustive-deps
}

// Progress and result, under the title of whatever started the run. Progress goes to one polite status line;
// each result is said once, by moving focus to it. Kept in view above the command toast.
// title: the row's own name, so each button's name says which row it belongs to. okElsewhere: a good result is shown
// by <ResultRow> as its own row, so this one leaves it out. plainRetry: Try again is a plain button (the place has
// its own filled one).
export function ResizeStatus({ from, after, title, okElsewhere, plainRetry }: { from: string; after?: () => void; title?: string; okElsewhere?: boolean; plainRetry?: boolean }) {
  const env = useResizeEnv();
  const s = useResize();
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const mine = s.from === from;
  const progress = mine ? progressText(s) : "";
  const off = !env || env.locked || s.progress !== null;
  const named = (what: string) => (title ? `${what}: ${plain(title)}` : what);
  const btn = (key: string, label: string, busyLabel: string, go: () => void, primary = false, aria?: string) => (
    <button key={key} className={primary ? "small primary" : "small"} aria-label={aria && s.pressed === key ? named(busyLabel) : aria} aria-disabled={off || undefined} onClick={() => !off && go()}>{s.pressed === key ? busyLabel : label}</button>
  );
  const o = mine ? s.outcome : null;
  const hidden = !!o && okElsewhere && !isBad(o);
  useResultFocus(from, mine, hidden ? null : o, s.tick, line, box);
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const [logError, setLogError] = useState<string | null>(null);
  // After a memory failure the next size up from the one just tried, if one fits.
  const next = s.target ? stepUp(s.target, env?.host?.memory) : null;
  const back = s.change ? undoOf(s.change) : null;
  // An explicit `after` says where focus goes (home's stopped card); without one, the next row's first button.
  const dismiss = () => {
    const to = !after && box.current ? afterDismiss(box.current) : null;
    dismissResize();
    after?.();
    to?.focus();
  };
  return (
    <div className="resize-status" ref={box}>
      <p className="sr-only" role="status" aria-live="polite">{plain(progress)}</p>
      {progress && <p className="hint resize-progress" aria-hidden="true"><Ticks text={progress} /></p>}
      {o && !hidden && (
        <p ref={line} tabIndex={-1} className={`resize-result ${isBad(o) ? "bad" : "ok"}`}>
          <Icon name={isBad(o) ? "close" : "check"} size={14} />
          <span><Ticks text={resultText(o)} /></span>
        </p>
      )}
      {o && !hidden && env && (
        <span className="actions-inline resize-actions">
          {o.kind === "done" && o.failed.map((f) => [
            // Out of memory again: Start would fail the same way, so the way to more memory comes first.
            f.memory ? (next ? <ResizeButton key={`more:${f.name}`} from={from} size={next} title={`${f.name} didn't start`} alsoStart={[f.name]} vmWords /> : <button key={`prof:${f.name}`} className="small" aria-label={`Change in Profiles: ${f.name} didn't start`} onClick={env.onProfiles}>Change in Profiles</button>)
              : btn(`start:${f.name}`, `Start ${f.name}`, "Starting…", () => void startOne(f.name)),
            f.long && <button key={`why:${f.name}`} className="small" aria-expanded={whyOpen === f.name} aria-controls={`resize-why-${f.name}`} aria-label={`See why ${f.name} didn't start`} onClick={() => setWhyOpen((x) => (x === f.name ? null : f.name))}>See why</button>,
          ])}
          {o.kind === "failed" && o.step && btn("step", `Try ${sizeWords(o.step)}`, "Restarting…", () => void restart(env, o.step!, "step"), true)}
          {o.kind === "failed" && s.was && !s.change && btn("was", `Start it as it was (${sizeWords(s.was)})`, "Starting…", () => void restart(env, s.was!, "was"))}
          {/* A failed change reads left to right as quiet to loud: Dismiss, the log, Try again, and the one filled button on the right edge. */}
          {o.kind === "failed" && s.change && <button className="small fix-dismiss" aria-disabled={s.progress !== null || undefined} onClick={() => s.progress === null && dismiss()}>Dismiss</button>}
          {o.kind === "failed" && s.change && <button className="small" aria-label={named("Show the log")} onClick={() => void invoke("reveal_vm_log", { name: s.profile }).then(() => setLogError(null), () => { setLogError(null); setTimeout(() => setLogError("Couldn't open the VM log in Finder."), 50); })}>Show the log</button>}
          {o.kind === "failed" && s.change && s.target && btn("again", "Try again", "Restarting…", () => void restart(env, s.target!, "again"), !(back || s.pressed === "undo"), named("Try again"))}
          {o.kind === "failed" && s.change && s.target && (back || s.pressed === "undo") && btn("undo", undoLabel(s.change), "Starting…", () => void restart(env, s.target!, "undo", true), true, named(undoLabel(s.change)))}
          {!(o.kind === "failed" && s.change) && <button className="small fix-dismiss" aria-disabled={s.progress !== null || undefined} onClick={() => s.progress === null && dismiss()}>Dismiss</button>}
        </span>
      )}
      <p className="sr-only" role="status">{logError ?? ""}</p>
      {logError && <p className="hint" aria-hidden="true">{logError}</p>}
      {o?.kind === "done" && !hidden && o.failed.filter((f) => f.long).map((f) => (
        <p key={f.name} id={`resize-why-${f.name}`} className="hint resize-why" hidden={whyOpen !== f.name}>{f.long}</p>
      ))}
      {mine && (s.progress || (o && !hidden && o.kind !== "refused")) && (
        <details className="out-more">
          <summary><Icon name="chevron" size={12} />Show output</summary>
          <OutputLog event="colima-progress" active={s.progress === "restarting"} />
        </details>
      )}
    </div>
  );
}

// A good result of a VM change in the Doctor: its own row, with a green check and Dismiss on the right, so it never
// sits inside a row that still says "Needs action". Left out for a result that needs a decision (those stay in
// their row, or in <ResizeStatus> when the row is gone).
export function ResultRow({ from }: { from: string }) {
  const s = useResize();
  const box = useRef<HTMLLIElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const mine = s.from === from;
  const o = mine ? s.outcome : null;
  const good = !!o && !isBad(o) && o.kind === "done";
  useResultFocus(from, mine, good ? o : null, s.tick, line, box);
  if (!good) return null;
  const dismiss = () => {
    const to = box.current ? afterDismiss(box.current) : null;
    dismissResize();
    to?.focus();
  };
  return (
    <ul className="findings result-row">
      <li className="finding ok" data-key={`result:${from}`} ref={box}>
        <Icon name="check" />
        <div><p ref={line} tabIndex={-1} className="resize-result ok"><span><Ticks text={resultText(o)} /></span></p></div>
        <span className="finding-actions"><button className="small fix-dismiss" aria-disabled={s.progress !== null || undefined} onClick={() => s.progress === null && dismiss()}>Dismiss</button></span>
      </li>
    </ul>
  );
}

// For a problem whose fix is a bigger VM: the one-click size when the app can pick one, and the run's progress
// under it. fallback: what the place showed before, when there is no size to offer. noProfiles: one control only
// (the Containers list); noStatus: the place shows <ResizeStatus> itself, under its own title.
export function ResizeOr({ from, title, need = "any", alsoStart, fallback, primary, noStatus, noProfiles, vmWords }: { from: string; title: string; need?: "any" | "memory"; alsoStart?: string[]; fallback: ReactNode; primary?: boolean; noStatus?: boolean; noProfiles?: boolean; vmWords?: boolean }) {
  const env = useResizeEnv();
  const s = useResize();
  const size = useResizeTarget(need);
  const shown = s.from === from && (s.progress || s.outcome) ? s.target : size;
  if (!shown || !env) return <>{fallback}</>;
  return (
    <span className="resize-or">
      <span className="actions-inline">
        {!(s.from === from && s.outcome) && <ResizeButton from={from} size={shown} title={title} alsoStart={alsoStart} primary={primary} vmWords={vmWords} />}
        {!noProfiles && <button className="link" aria-label={`Change in Profiles: ${title}`} onClick={env.onProfiles}>Change in Profiles</button>}
      </span>
      {!noStatus && <ResizeStatus from={from} />}
    </span>
  );
}

// The quiet way to other numbers, in a row's body text beside a one-click size ("Other numbers? Change in Profiles"),
// so the row's actions hold one button. Shown only when ResizeOr offers a size.
export function ResizeOther({ title, need = "any" }: { title: string; need?: "any" | "memory" }) {
  const env = useResizeEnv();
  const size = useResizeTarget(need);
  if (!size || !env) return null;
  return <span className="hint">Other numbers? <button className="link" aria-label={`Change in Profiles: ${title}`} onClick={env.onProfiles}>Change in Profiles</button></span>;
}

// App's announcements for a run whose page is closed (the user went to another tab): each step, then the result.
// A failure, or containers that didn't start, is an alert; the rest is a polite status.
export function ResizeAnnouncer() {
  const s = useResize();
  const seen = useRef(`${s.tick}:${s.progress}`);
  const [said, setSaidNow] = useState<{ status: string; alert: string }>({ status: "", alert: "" });
  const later = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(later.current), []);
  useEffect(() => {
    const key = `${s.tick}:${s.progress}`;
    if (key === seen.current) return;
    seen.current = key;
    clearTimeout(later.current);
    // Cleared first, then written, so the same words twice in a row are still read.
    setSaidNow({ status: "", alert: "" });
    // Shown on this page and still running (or nothing to say): the page's own line speaks. A finished result is spoken
    // here unless a status line already took focus to it, so a good result is heard when focus moved during the restart.
    if (onScreen(s.from) && (s.progress || !s.outcome)) return;
    const next = s.progress ? { status: plain(progressText(s)), alert: "" } : !s.outcome ? null : isBad(s.outcome) ? { status: "", alert: plain(resultText(s.outcome)) } : { status: plain(resultText(s.outcome)), alert: "" };
    // A result a status line already took focus to was said by that focus; saying it again would be twice.
    const tick = s.tick;
    if (next) later.current = setTimeout(() => { if (!s.progress && lastShownTick === tick) return; setSaidNow(next); }, 50);
  }, [s]);
  return (
    <>
      <p className="sr-only" role="status" aria-live="polite" data-resize-announcer="">{said.status}</p>
      <p className="sr-only" role="alert" data-resize-announcer="">{said.alert}</p>
    </>
  );
}

// Holds a value still while the VM restarts, so a count or a list doesn't drop and come back.
export function useHeld<T>(value: T): T {
  const s = useResize();
  const held = useRef(value);
  if (!resizing(s)) held.current = value;
  return held.current;
}

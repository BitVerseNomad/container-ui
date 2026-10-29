// Gives a small VM a better size in one click, from any place that notices it is small: the Doctor's size row,
// a container that ran out of memory, the note about Kafka and the like. One run at a time, for the whole app.
// The run outlives the page that started it (switching tabs unmounts it, the VM keeps restarting), so its state
// lives here, like a Compose run. The VM part goes through App's VM runner, so the sidebar, the VM strip and every
// container button lock and follow it. Its commands go to All commands without a toast: the row reports the run.
import { ReactNode, createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Profile, ctxFor, docker, dockerJson } from "./api";
import { composeRunState } from "./ComposeProjects";
import { activity, dockerLine } from "./lib/activity";
import { parseLabels } from "./lib/compose";
import { snapshot as fixRuns } from "./lib/fixStore";
import type { Host, RestartPlan, RunningRow } from "./lib/vmSize";
import { KUBE_BACK, confirmText, doneText, explainResize, nameList, notStarted, planRestart, resizeTo, sizeWords, startReason, stepDown, withoutKube } from "./lib/vmSize";
import { useConfirm } from "./ui";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";

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
type Failed = { name: string; short: string; long: string | null };
type Outcome =
  | { kind: "done"; text: string; failed: Failed[]; slow: string[] }
  | { kind: "failed"; text: string; step: Size | null; tried: Size; stopped: boolean }
  | { kind: "refused"; text: string };
// kube: how many running containers Kubernetes owns (left to it, not counted).
export type ResizeState = { from: string | null; profile: string; target: Size | null; was: Size | null; plan: RestartPlan; count: number; kube: number; progress: "restarting" | "starting" | null; outcome: Outcome | null; pressed: string | null; tick: number };
const NONE: RestartPlan = { waves: [], healthy: [] };
const IDLE: ResizeState = { from: null, profile: "default", target: null, was: null, plan: NONE, count: 0, kube: 0, progress: null, outcome: null, pressed: null, tick: 0 };
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

// The size a resize from here would give, or null when the app can't pick a better one (then it is the user's call).
// need "memory": a container ran out of memory, so only the memory changes and the CPUs stay as they are.
export function useResizeTarget(need: "any" | "memory" = "any"): Size | null {
  const env = useResizeEnv();
  const s = useResize();
  if (s.progress && s.target) return s.target;
  const p = env?.profile;
  if (!env || !p || p.status !== "Running") return null;
  const to = resizeTo({ cpus: p.cpus, memory: p.memory }, env.pick, env.host?.memory);
  if (!to || need === "any") return to;
  return to.memory > Math.round(p.memory / 1024 ** 3) ? { cpus: p.cpus, memory: to.memory } : null;
}

type Inspected = { Name?: string; State?: { Running?: boolean }; Config?: { Labels?: Record<string, string> | null } };
const fromInspect = (containers?: unknown[]): RunningRow[] | null =>
  containers ? (containers as Inspected[]).filter((c) => c.State?.Running).map((c) => ({ name: (c.Name ?? "").replace(/^\//, ""), labels: c.Config?.Labels ?? {} })) : null;
const fixing = () => fixRuns().some((r) => r.step != null);

// The VM part: stop, start with the size, then start what was running. Each step ends with focus on its result.
async function restart(env: ResizeEnv, size: Size, pressed: string) {
  const p = env.profile;
  if (!p) return;
  set({ progress: "restarting", target: size, pressed });
  const args = { opts: { name: state.profile, cpus: size.cpus, memory: size.memory }, restart: p.status === "Running" };
  const err = await env.runVm("restarting", "apply_resources", args);
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
    (e: unknown) => notStarted(String(e), names).map((name) => ({ name, ...startReason(String(e), name) })),
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
  finish(failed, slow);
}

const failLine = (f: Failed) => `${f.name} didn't start: ${f.short}.`;
const slowLine = (slow: string[]) => (slow.length ? ` ${nameList(slow)} ${slow.length === 1 ? "wasn't" : "weren't"} healthy after a minute; what needs ${slow.length === 1 ? "it" : "them"} was started anyway.` : "");
const finish = (failed: Failed[], slow: string[] = []) => set({ progress: null, pressed: null, outcome: { kind: "done", text: doneText(state.target!, state.count, failed.length) + (state.kube ? ` ${KUBE_BACK}` : "") + slowLine(slow), failed, slow }, tick: state.tick + 1 });

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
    (e: unknown) => finish([...left, { name, ...startReason(String(e), name) }]),
  );
}

// Asks once, then runs. alsoStart: a container that stopped for lack of memory, started again with the rest.
export async function askResize(env: ResizeEnv, confirm: ReturnType<typeof useConfirm>, size: Size, from: string, alsoStart: string[] = []) {
  const p = env.profile;
  if (!p || env.locked || state.progress) return;
  const was = { cpus: p.cpus, memory: Math.round(p.memory / 1024 ** 3) };
  const known = fromInspect(env.containers);
  const shown = known ? withoutKube(known) : null;
  if (!(await confirm(confirmText(size, shown?.rows.length ?? null, was, shown?.kube), "Restart the VM", { safe: true }))) return;
  // The confirm waited for a click; something else may have started meanwhile. Checked again, then claimed at once.
  if (state.progress || composeRunState().busy || fixing()) return;
  set({ ...IDLE, tick: state.tick, from, profile: p.name, was, target: size, progress: "restarting", pressed: "main" });
  // Read now, not from the last check: the list the app starts again must be exactly what is running.
  const ctx = ctxFor(p.name);
  const ps = await dockerJson<{ Names: string; State: string; Labels?: string }>(ctx, ["ps"])
    .then((l) => l.filter((c) => c.State === "running").map((c) => ({ name: c.Names, labels: Object.fromEntries(parseLabels(c.Labels ?? "")) })))
    .catch(() => null);
  const read = ps ?? fromInspect(env.containers);
  if (!read) return set({ progress: null, pressed: null, outcome: { kind: "refused", text: "Couldn't read which containers are running, so the VM wasn't restarted." }, tick: state.tick + 1 });
  const { rows, kube } = withoutKube(read);
  const extra = alsoStart.filter((n) => !rows.some((r) => r.name === n));
  set({ plan: planRestart([...rows, ...extra.map((name) => ({ name, labels: {} }))]), count: rows.length + extra.length, kube });
  await restart(env, size, "main");
}

export const dismissResize = () => set({ ...IDLE, tick: state.tick });

// The main button. Doctor's VM row says "Give it 6 CPUs and 8 GiB"; a container line names the VM, since the
// container isn't what grows ("Give the VM 8 GiB"). It stays while the VM restarts, saying so, so focus stays on it.
export function ResizeButton({ from, size, title, primary, alsoStart, vmWords }: { from: string; size: Size; title: string; primary?: boolean; alsoStart?: string[]; vmWords?: boolean }) {
  const env = useResizeEnv();
  const s = useResize();
  const confirm = useConfirm();
  const mine = s.from === from && s.pressed === "main";
  const off = !env || env.locked || s.progress !== null;
  const label = mine ? (s.progress === "starting" ? "Starting…" : "Restarting…") : vmWords ? `Give the VM ${size.memory} GiB` : `Give it ${sizeWords(size)}`;
  const why = !env ? undefined : s.progress && !mine ? "Another VM size change is running" : env.locked && !mine ? "Waits for the VM, Compose run or container fix that is running" : undefined;
  return (
    <button className={primary ? "small primary" : "small"} title={why ?? `Restarts the VM with ${sizeWords(size)}`} aria-label={`${label}: ${title}`} aria-disabled={off || undefined} onClick={() => !off && env && askResize(env, confirm, size, from, alsoStart)}>
      {label}
    </button>
  );
}

// One line: what happened, and each container that didn't start with its reason.
const resultText = (o: Outcome) => `${o.text}${o.kind === "failed" && o.stopped ? " The VM is stopped." : ""}${o.kind === "done" ? o.failed.map((f) => ` ${failLine(f)}`).join("") : ""}`;
const isBad = (o: Outcome) => o.kind !== "done" || o.failed.length > 0;
const progressText = (s: ResizeState) => (!s.progress || !s.target ? "" : s.progress === "restarting" ? `Restarting the VM with ${sizeWords(s.target)}… about a minute` : `Starting ${s.count === 1 ? "the container" : `your ${s.count} containers`} again…`);
export const resizeLine = (s: ResizeState) => progressText(s);

// Progress and result, under the title of whatever started the run. Progress goes to one polite status line;
// each result is said once, by moving focus to it. Kept in view above the command toast.
export function ResizeStatus({ from, after }: { from: string; after?: () => void }) {
  const env = useResizeEnv();
  const s = useResize();
  const box = useRef<HTMLDivElement>(null);
  const line = useRef<HTMLParagraphElement>(null);
  const seen = useRef(s.tick);
  const mine = s.from === from;
  useEffect(() => {
    shownOn.set(from, (shownOn.get(from) ?? 0) + 1);
    return () => { shownOn.set(from, (shownOn.get(from) ?? 1) - 1); };
  }, [from]);
  useEffect(() => {
    if (s.tick === seen.current) return;
    seen.current = s.tick;
    if (!mine || !s.outcome) return;
    line.current?.focus({ preventScroll: true });
    box.current?.scrollIntoView?.({ block: "nearest" });
  }, [s.tick, mine, s.outcome]);
  const progress = mine ? progressText(s) : "";
  const off = !env || env.locked || s.progress !== null;
  const btn = (key: string, label: string, busyLabel: string, go: () => void, primary = false, aria?: string) => (
    <button key={key} className={primary ? "small primary" : "small"} aria-label={aria} aria-disabled={off || undefined} onClick={() => !off && go()}>{s.pressed === key ? busyLabel : label}</button>
  );
  const o = mine ? s.outcome : null;
  const [whyOpen, setWhyOpen] = useState<string | null>(null);
  const dismiss = () => {
    // Focus goes on to the next thing to do, not to the page top.
    const row = box.current?.closest("li");
    const next = row?.nextElementSibling?.querySelector<HTMLElement>("button") ?? document.querySelector<HTMLElement>(".doctor-head button");
    dismissResize();
    after?.();
    next?.focus();
  };
  return (
    <div className="resize-status" ref={box}>
      <p className="sr-only" role="status" aria-live="polite">{progress}</p>
      {progress && <p className="hint resize-progress" aria-hidden="true">{progress}</p>}
      {o && (
        <p ref={line} tabIndex={-1} className={`resize-result ${isBad(o) ? "bad" : "ok"}`}>
          <Icon name={isBad(o) ? "alert" : "check"} size={14} />
          <span>{resultText(o)}</span>
        </p>
      )}
      {o && env && (
        <span className="actions-inline resize-actions">
          {o.kind === "done" && o.failed.map((f) => [
            btn(`start:${f.name}`, `Start ${f.name}`, "Starting…", () => void startOne(f.name)),
            f.long && <button key={`why:${f.name}`} className="small" aria-expanded={whyOpen === f.name} aria-controls={`resize-why-${f.name}`} aria-label={`See why ${f.name} didn't start`} onClick={() => setWhyOpen((x) => (x === f.name ? null : f.name))}>See why</button>,
          ])}
          {o.kind === "failed" && o.step && btn("step", `Try ${sizeWords(o.step)}`, "Restarting…", () => void restart(env, o.step!, "step"), true)}
          {o.kind === "failed" && s.was && btn("was", `Start it as it was (${sizeWords(s.was)})`, "Starting…", () => void restart(env, s.was!, "was"))}
          <button className="small fix-dismiss" aria-disabled={s.progress !== null || undefined} onClick={() => s.progress === null && dismiss()}>Dismiss</button>
        </span>
      )}
      {o?.kind === "done" && o.failed.filter((f) => f.long).map((f) => (
        <p key={f.name} id={`resize-why-${f.name}`} className="hint resize-why" hidden={whyOpen !== f.name}>{f.long}</p>
      ))}
      {mine && (s.progress || (o && o.kind !== "refused")) && (
        <details className="out-more">
          <summary><Icon name="chevron" size={12} />Show output</summary>
          <OutputLog event="colima-progress" active={s.progress === "restarting"} />
        </details>
      )}
    </div>
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
    if (onScreen(s.from)) return;
    const next = s.progress ? { status: progressText(s), alert: "" } : !s.outcome ? null : isBad(s.outcome) ? { status: "", alert: resultText(s.outcome) } : { status: resultText(s.outcome), alert: "" };
    if (next) later.current = setTimeout(() => setSaidNow(next), 50);
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

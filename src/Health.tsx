import { ReactNode, useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Line, ago } from "./lib/events";
import { Problem, ProblemFix, State, problemsFor } from "./lib/health";
import type { Apply } from "./lib/health";
import { TEXTEDIT_HINT, flipSaid, limitRaised, notReady, openFailure, raisedLine, serviceFacts, stillText } from "./lib/composeLimit";
import { Icon } from "./ui/icons";
import { dockerJson } from "./api";
import { composeRunState, runCompose, useComposeRun } from "./ComposeProjects";
import Ticks, { plain } from "./ui/Ticks";
import FixIt from "./FixIt";
import { ResizeOr, useResizeEnv } from "./Resize";

export const stripHealth = (status: string) => status.replace(/\s*\((?:un)?healthy\)|\s*\(health: starting\)/, "");

export function HealthBadge({ status }: { status: "starting" | "healthy" | "unhealthy" | null }) {
  if (!status) return null;
  return <span className={`hbadge ${status}`}>{status}</span>;
}

export function ActivityList({ lines, empty }: { lines: Line[]; empty: string }) {
  if (lines.length === 0) return <p className="hint">{empty}</p>;
  const now = Date.now();
  return (
    <ul className="activity">
      {lines.map((l, i) => (
        <li key={`${l.time}-${i}`} className={l.level}>
          <span className="adot" aria-hidden="true" />
          <span>{l.text}</span>
          <span className="when">{ago(l.time, now)}</span>
        </li>
      ))}
    </ul>
  );
}

// A container that hit its own memory limit, from a project the scan lists (the backend opens or runs nothing else).
// The file is read again (`docker compose config`) on mount, on window focus (the user saved and came back) and after
// each Compose run, so the line can tell an unchanged limit from a raised one. kind "unreadable": the config couldn't
// be read, so nothing is said about the limit's current value.
type PsRow = { State: string; Status?: string; Labels?: string };
export type LimitView = { kind: "reading" | "unreadable" | "unchanged" | "raised"; now: number; waiting: string[] };
export const isListed = (path: string, listed: string[]) => listed.some((x) => x.toLowerCase() === path.toLowerCase());
export function useServiceLimit(ctx: string | undefined, apply: Apply | undefined, enabled: boolean): LimitView {
  const [view, setView] = useState<LimitView>({ kind: "reading", now: 0, waiting: [] });
  const busy = useComposeRun().busy;
  useEffect(() => {
    if (!ctx || !apply || !enabled) return;
    let live = true;
    const dir = apply.file.slice(0, apply.file.lastIndexOf("/"));
    const read = async () => {
      const json = await invoke<string>("compose_config", { context: ctx, file: apply.file }).catch(() => null);
      const facts = json ? serviceFacts(json, apply.service) : null;
      const ps = facts?.dependsOn.length ? await dockerJson<PsRow>(ctx, ["ps", "-a", "--filter", `label=com.docker.compose.project.working_dir=${dir}`, ...(facts.project ? ["--filter", `label=com.docker.compose.project=${facts.project}`] : [])]).catch(() => [] as PsRow[]) : [];
      if (!live) return;
      setView(!facts ? { kind: "unreadable", now: 0, waiting: [] } : { kind: limitRaised(apply, facts.limit) ? "raised" : "unchanged", now: facts.limit, waiting: notReady(facts.dependsOn, ps, facts.project) });
    };
    void read();
    window.addEventListener("focus", read);
    return () => { live = false; window.removeEventListener("focus", read); };
  }, [ctx, apply?.file, apply?.service, apply?.limit, enabled, !!busy]); // eslint-disable-line react-hooks/exhaustive-deps
  return view;
}
// A limit line's button that changes with what the file says. key: which button shows (each its own element, so a
// screen reader never hears one button rename itself). When the key changes while that button had focus, focus moves
// to the new one; onFlip(was) then runs (it says the change), only once the line already showed a limit, so the first
// read when the page opens stays quiet. Put the returned ref on a wrapper around the button.
export function useLimitFlip(key: string, kind: LimitView["kind"], onFlip: (keyChanged: boolean) => void) {
  const box = useRef<HTMLSpanElement>(null);
  // Read during render, while the old button is still on the page.
  const hadFocus = useRef(false);
  hadFocus.current = !!box.current?.contains(document.activeElement);
  const before = useRef({ key, kind });
  useEffect(() => {
    const was = before.current;
    before.current = { key, kind };
    const keyChanged = was.key !== key;
    const sides = (k: LimitView["kind"]) => (k === "raised" ? "raised" : k === "unchanged" ? "unchanged" : null);
    if (keyChanged && hadFocus.current) box.current?.querySelector<HTMLElement>("button")?.focus();
    if (!sides(was.kind) || !sides(kind) || (!keyChanged && sides(was.kind) === sides(kind))) return;
    onFlip(keyChanged);
  }, [key, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  return box;
}

// Open for one Compose file, on home, Doctor and the container page. Which app will open it is looked up on mount and
// on window focus (no side effect), so the button can name it ("Open in Cursor"); when it is TextEdit, whose smart
// quotes break YAML, the line also says so before any click. The click opens at once. While open runs (up to its 30 s
// deadline) the button reads Opening… and a second press does nothing. A failure names the app and turns Open into
// Show in Finder. Every button's accessible name starts with its visible words, then ": " and the detail (WCAG 2.5.3).
// Each target is its own button: when the app changes under focus, focus moves to the new one and it is said.
type Said = { status: string; alert: string };
type Plan = { how: string; app: string | null };
export function useOpenCompose(path: string, enabled: boolean, say: (s: Said) => void) {
  const file = path.slice(path.lastIndexOf("/") + 1);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [failed, setFailed] = useState<{ text: string; finder: boolean } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    const read = () => invoke<Plan>("compose_editor", { path }).then((p) => { if (live) setPlan(p); }).catch(() => {});
    void read();
    window.addEventListener("focus", read);
    return () => { live = false; window.removeEventListener("focus", read); };
  }, [path, enabled]);
  const app = plan?.app ?? null;
  // The open button's identity is its target. Read during render, while the old button is still on the page.
  const box = useRef<HTMLSpanElement>(null);
  const hadFocus = useRef(false);
  hadFocus.current = !!box.current?.contains(document.activeElement);
  const before = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const was = before.current;
    before.current = plan ? app : undefined;
    if (!hadFocus.current || was === app) return;
    box.current?.querySelector<HTMLElement>("button")?.focus();
    // Quiet when the first lookup lands (the page just opened): only a change after that is news.
    if (was !== undefined) say({ status: `It now opens in ${app ?? "an editor"}.`, alert: "" });
  }, [app]); // eslint-disable-line react-hooks/exhaustive-deps
  const finderRef = useFocusOnSwap(!!failed?.finder);
  const open = async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setFailed(null);
    try {
      await invoke<string>("open_compose", { path });
    } catch (e) {
      const f = openFailure(file, String(e));
      if (f.still) say({ status: f.text, alert: "" });
      else { setFailed({ text: f.text, finder: f.finder }); say({ status: "", alert: f.text }); }
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const reveal = () => invoke<void>("reveal_compose", { path }).catch((e) => say({ status: "", alert: `Couldn't show \`${file}\` in Finder. ${String(e)}` }));
  const textEdit = plan?.how === "textedit";
  const label = pending ? "Opening…" : app ? `Open in ${app}` : `Open ${file}`;
  const name = (who: string) => (pending ? `${label}: ${file}` : app ? `${label}: ${file}, ${who}` : `${label}: ${who}`);
  // who: the service the line is about. cls: the button's size class.
  const button = (who: string, cls?: string) => (
    <span className="limit-action" ref={box}>
      {failed?.finder
        ? <button key="finder" ref={finderRef} className={cls} aria-label={`Show in Finder: ${file}`} onClick={() => void reveal()}>Show in Finder</button>
        : <button key={`open:${app ?? ""}`} className={cls} aria-disabled={pending || undefined} aria-label={name(who)} onClick={() => void open()}>{label}</button>}
    </span>
  );
  return { file, textEdit, hint: textEdit ? TEXTEDIT_HINT : "", pending, failed, open, reveal, label, button };
}

// After a failure Open becomes Show in Finder; if Open had focus (it was just pressed), focus moves to the new button.
export function useFocusOnSwap(on: boolean) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (on && (!document.activeElement || document.activeElement === document.body)) ref.current?.focus();
  }, [on]);
  return ref;
}
const projectOf = (file: string) => { const dir = file.slice(0, file.lastIndexOf("/")); return { dir, files: [file.slice(file.lastIndexOf("/") + 1)], name: dir.slice(dir.lastIndexOf("/") + 1) }; };

// On Doctor and the container page: what the file says now and any refusal sit first, at the text's width; under them
// the file's button, then Apply and start (right-aligned on Doctor). Pressed while the file still sets the old limit it
// doesn't run (it would hit the same limit) and says so; with what it depends on stopped, the project's own Start is
// offered instead (`--no-deps` leaves them as they are). Says each step itself, since these pages have no live
// region of their own.
export function LimitActions({ fix, ctx, listed, fallback, small }: { fix: ProblemFix & { reveal: string }; ctx?: string; listed: string[]; fallback: ReactNode; small?: boolean }) {
  const shown = isListed(fix.reveal, listed);
  const view = useServiceLimit(ctx, fix.apply, shown);
  const run = useComposeRun();
  const [note, setNote] = useState<{ status: string; alert: string }>({ status: "", alert: "" });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const say = (next: { status: string; alert: string }) => { setNote({ status: "", alert: "" }); clearTimeout(timer.current); timer.current = setTimeout(() => setNote(next), 50); };
  const id = useId();
  const a = fix.apply;
  const p = projectOf(fix.reveal);
  const key = view.waiting.length ? "start" : "apply";
  const label = key === "start" ? `Start ${p.name}` : "Apply and start";
  const opener = useOpenCompose(fix.reveal, shown, say);
  useEffect(() => () => clearTimeout(timer.current), []);
  // Only when the file side really changes (raised <-> unchanged, or the button itself): a refusal ("still sets
  // 256 MiB") belonged to the old state, so it goes; any other alert (a start that failed) stays, and so does a
  // status until the change is said. A re-read that can't read the file changes nothing here.
  const box = useLimitFlip(key, view.kind, (changed) => {
    if (!a) return;
    clearTimeout(timer.current);
    setNote((n) => ({ status: "", alert: n.alert === stillText(a) ? "" : n.alert }));
    timer.current = setTimeout(() => setNote((n) => ({ ...n, status: flipSaid(a, view.kind === "raised", view.now, label, changed) })), 50);
  });
  if (!shown) return <>{fallback}</>;
  const cls = small ? "small" : undefined;
  const mine = !!a && run.busy?.service === a.service && run.busy.dir === p.dir;
  const locked = !!run.busy;
  const waitWhy = locked && !mine ? <span className="sr-only" id={`${id}-why`}>Waits for the Compose run that is going.</span> : null;
  const go = async (service?: string) => {
    if (!ctx || locked) return;
    const who = service ?? p.name;
    say({ status: `Starting ${who}…`, alert: "" });
    await runCompose(ctx, p, "up", [], service);
    const f = composeRunState().failed;
    say(f && f.dir === p.dir ? { status: "", alert: `${who} didn't start. ${f.why ?? f.text.split("\n")[0]}` } : { status: service ? `${service} started with its new limit.` : `${p.name} started.`, alert: "" });
  };
  const second = !a || !ctx ? null : view.waiting.length ? (
    <button key="start" className={cls} aria-disabled={locked || undefined} aria-describedby={waitWhy ? `${id}-why` : undefined} aria-label={`Start ${p.name}: ${a.service} needs ${view.waiting.join(" and ")}`} onClick={() => void go()}>Start {p.name}</button>
  ) : (
    <button key="apply" className={cls} aria-disabled={locked || undefined} aria-describedby={waitWhy ? `${id}-why` : undefined} aria-label={`${mine ? "Starting" : "Apply and start"} ${a.service}`} title={`docker compose up -d --no-deps ${a.service}`}
      onClick={() => { if (locked) return; if (view.kind === "unchanged") say({ status: "", alert: stillText(a) }); else void go(a.service); }}>
      {mine ? "Starting…" : "Apply and start"}
    </button>
  );
  const raised = !!a && view.kind === "raised";
  return (
    <div className="limit-actions">
      {raised && <p className="resize-result off limit-note"><Icon name="stop" size={14} /><span><Ticks text={raisedLine(a, view.now, view.waiting, p.name)} /></span></p>}
      {!raised && view.waiting.length > 0 && a && <p className="hint limit-note">Start {p.name} first: {a.service} needs {view.waiting.join(" and ")}.</p>}
      {opener.hint && !opener.failed && <p className="hint limit-note">{opener.hint}</p>}
      {note.alert && <p className="resize-result warn limit-note" aria-hidden="true"><Icon name="alert" size={14} /><span><Ticks text={note.alert} /></span></p>}
      <span className="actions-inline">
        {opener.button(a?.service ?? "the project", cls)}
        <span className="limit-action" ref={box}>{second}</span>
      </span>
      {waitWhy}
      <span className="sr-only" role="status">{plain(note.status)}</span>
      <span className="sr-only" role="alert">{plain(note.alert)}</span>
    </div>
  );
}

// Health, restarts and anything wrong with a container, in plain words.
// ctx and onFixed let a problem with a fix run it here; onFixed gets the name of the replaced container.
export function HealthPanel({ state, extra = [], onLogs, ctx, onFixed, listed = [] }: { state: State; extra?: Problem[]; onLogs?: () => void; ctx?: string; onFixed?: (name: string) => void; listed?: string[] }): ReactNode {
  const vm = useResizeEnv()?.profile;
  const problems: Problem[] = [...problemsFor(state, vm?.status === "Running" ? vm.memory : undefined), ...extra];
  return (
    <div className="health-panel panel">
      <div className="hp-row">
        <b>Health</b>
        {state.health ? (
          <>
            <HealthBadge status={state.health.status} />
            {state.health.streak > 0 && !problems.some((p) => p.id === "unhealthy") && <span className="hint">{state.health.streak} checks in a row have failed</span>}
          </>
        ) : (
          <span className="hint">No health check is defined for this image. Without one, Docker can tell a container is running but not whether it is working.</span>
        )}
      </div>
      <div className="hp-row">
        <b>Restarts</b>
        <span>{state.restartCount}</span>
        <span className="hint">{state.running ? (state.startedAt ? `Started ${ago(Date.parse(state.startedAt), Date.now())}` : "Running") : `Exited with code ${state.exitCode}`}</span>
      </div>
      {problems.map((p) => (
        <div key={p.id} className={`problem-line ${p.level}`}>
          <b><Ticks text={p.title} /></b>
          <div className="hint"><Ticks text={p.detail} /></div>
          {p.fix?.reveal ? (
            <LimitActions fix={{ ...p.fix, reveal: p.fix.reveal }} ctx={ctx} listed={listed} fallback={onLogs && <button onClick={onLogs}>Open the logs</button>} />
          ) : p.fix?.resize ? (
            <ResizeOr from={`detail:${state.name}:${p.id}`} title={`${p.title}, ${state.name}`} need="memory" alsoStart={[state.name]} primary vmWords fallback={onLogs && <button onClick={onLogs}>Open the logs</button>} />
          ) : p.fix ? (
            <FixIt fix={p.fix} ctx={ctx} onFixed={onFixed} />
          ) : (
            onLogs && <button onClick={onLogs}>Open the logs</button>
          )}
        </div>
      ))}
    </div>
  );
}

// Compose projects found on the Mac, next to what is already running from them. Start, Stop, Restart and Down run
// `docker compose` in the project's own folder, exactly as typing it there would.
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import Drawer from "./ui/Drawer";
import OutputLog from "./ui/OutputLog";
import ComposeLogs from "./ComposeLogs";
import { Banner, useConfirm } from "./ui";
import { Icon } from "./ui/icons";
import { ComposeScan } from "./useComposeScan";
import { cdPath, portHolder, projectName, projectsFrom, shellQuote, whyFailed } from "./lib/composeScan";
import { docker, pinComposeStop } from "./api";
import { noteCompose } from "./lib/appStopped";
import type { ComposeProject } from "./lib/composeScan";
import { rank } from "./lib/fuzzy";
import { activity, dockerLine } from "./lib/activity";
import { useFixRuns } from "./FixIt";
import { bringBusy, useBringBusy } from "./bringBusy";

type Ctr = { State: string; Labels?: string; Names?: string; Ports?: string };
export type Action = "up" | "stop" | "restart" | "down" | "build" | "pull";
// The backend sends one path past this cap when the list was cut.
const SHOWN_MAX = 300;
const tilde = (dir: string) => dir.replace(/^\/Users\/[^/]+/, "~");
const VERB: Record<Action, [string, string]> = { up: ["Start", "Starting…"], stop: ["Stop", "Stopping…"], restart: ["Restart", "Restarting…"], down: ["Down", "Taking down…"], build: ["Rebuild", "Rebuilding…"], pull: ["Update images", "Updating images…"] };
const TAIL: Record<Action, string> = { up: "up -d", stop: "stop", restart: "restart", down: "down", build: "up -d --build", pull: "up -d --pull always" };
const tail = (a: Action) => TAIL[a];
// What the button runs, as you'd type it, with the context named so a paste acts on the same profile.
const ctxWord = (ctx: string) => (/^[\w.@-]+$/.test(ctx) ? ctx : shellQuote(ctx));
const typed = (dir: string, a: Action, ctx: string) => `cd ${cdPath(dir)} && docker --context ${ctxWord(ctx)} compose ${tail(a)}`;

// The run outlives the panel: switching tabs unmounts it, but the backend keeps going, so its state lives here.
// holder: the container that has the port a failed start needed, when it is one Docker runs.
// service: one service of the project, started again on its own (`up -d <service>`), so Compose recreates it.
type RunState = { busy: { dir: string; action: Action; service?: string } | null; failed: { dir: string; action: Action; text: string; why: string | null; holder: string | null; service?: string } | null };
let state: RunState = { busy: null, failed: null };
const subs = new Set<() => void>();
const setRun = (next: Partial<RunState>) => { state = { ...state, ...next }; subs.forEach((f) => f()); };
// For tests: each one starts with no run in progress.
export const resetComposeRun = () => setRun({ busy: null, failed: null });
// Read once, outside render: whether the run that just ended failed.
export const composeRunState = () => state;
export const useComposeRun = () => useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => state);
// The backend's mark for an error from before anything ran (main.rs NOT_STARTED): the rest, or null.
export const notStarted = (e: string) => (e.startsWith("Not started: ") ? e.slice("Not started: ".length) : null);
const NO_COMPOSE = /'compose' is not a docker command|unknown command "compose"|unknown shorthand flag: 'd'/i;

// Runs one Compose action for a project, as typing it in its folder would. The home list and this panel share it,
// so both show the same run in progress. The caller asks first for Down and checks no Fix is running.
// Returns false when another run held the lock and nothing ran.
export async function runCompose(ctx: string, p: Pick<ComposeProject, "dir" | "files" | "name">, action: Action, containers: Ctr[], service?: string): Promise<boolean> {
  if (state.busy || bringBusy()) return false;
  setRun({ busy: { dir: p.dir, action, service }, failed: null });
  noteCompose(ctx, p.dir, p.name, action);
  try {
    await activity.ran(`compose ${action}`, `${typed(p.dir, action, ctx)}${service ? ` ${service}` : ""}`, () => invoke<void>("compose_action", { context: ctx, file: `${p.dir}/${p.files[0]}`, action, ...(service ? { service } : {}) }), service ?? p.name);
    if (action === "stop") await pinComposeStop(ctx, p.dir, p.name).catch(() => {});
  } catch (e) {
    // A check before Compose refused (the file's config couldn't be read, a name not of the project): nothing ran.
    const refused = notStarted(String(e));
    const text = refused ?? String(e);
    const why = NO_COMPOSE.test(text) ? "docker compose isn't installed, so nothing ran. The Doctor can install it." : refused ? `${text}. Nothing was started.` : whyFailed(text, containers);
    // Compose may have created a network or some services before it failed; Down clears what it left.
    const left = action === "up" && !refused ? " Part of the project may have been created; Down removes what was left." : "";
    setRun({ failed: { dir: p.dir, action, text, why: why ? `${why}${left}` : left.trim() || null, holder: portHolder(text, containers), service } });
  } finally {
    setRun({ busy: null });
  }
  return true;
}

function CopyCommand({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      aria-label={label}
      title={text}
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }, () => {})}
    >
      <Icon name="copy" size={13} /> {done ? "Copied" : "Copy"}
    </button>
  );
}

// attention: what the Doctor found per container name, so a card says "web keeps restarting", not just "2 of 3 running".
type Props = { ctx: string; scan: ComposeScan; containers: Ctr[]; attention?: Map<string, { short?: string; title: string }[]>; onClose: () => void; onChanged?: () => void; query?: string };

export default function ComposeProjects({ ctx, scan, containers, attention, onClose, onChanged, query = "" }: Props) {
  const confirm = useConfirm();
  const [q, setQ] = useState(query);
  const [err, setErr] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  // One project's live logs open at a time; a read, so it never waits for a run.
  const [logsDir, setLogsDir] = useState<string | null>(null);
  // One project at a time, as the backend allows; its output shows under it.
  const { busy, failed } = useComposeRun();
  // A Fix renames a container to NAME-old; compose acting on the project then would remove or restart that copy.
  // A Bring over copy holds Docker too; Compose waits for it the same way.
  const bringing = useBringBusy();
  const fixRunning = useFixRuns().some((r) => r.step != null);
  const fixing = fixRunning || bringing;
  const cut = (scan.paths?.length ?? 0) > SHOWN_MAX;
  // Added folders first, so the cut never hides one the user just added.
  const listed = useMemo(() => [...new Set([...(scan.pinned ?? []), ...(scan.paths ?? []).slice(0, SHOWN_MAX)])], [scan.pinned, scan.paths]);
  // The order is fixed while the panel is open, so the card you just started or took down stays where it was.
  const seen = useRef(new Map<string, number>());
  const all = useMemo(() => {
    const ps = projectsFrom(listed, containers);
    for (const p of ps) if (!seen.current.has(p.dir)) seen.current.set(p.dir, seen.current.size);
    return ps.sort((a, b) => seen.current.get(a.dir)! - seen.current.get(b.dir)!);
  }, [listed, containers]);
  const rows = useMemo(() => rank(all, q, (p) => p.name, (p) => tilde(p.dir)), [all, q]);

  async function run(p: ComposeProject, action: Action) {
    if (state.busy || fixing) return;
    if (action === "down" && !(await confirm(`Stop and remove the containers of ${p.name}? Its volumes, and the data in them, stay.`, "Down"))) return;
    await runCompose(ctx, p, action, containers);
    onChanged?.();
  }

  // The fix the port note asks for, in one click: stop the container holding the port, then start this project.
  async function freePortAndStart(p: ComposeProject, holder: string) {
    if (state.busy || fixing) return;
    try {
      await activity.ran("stop", dockerLine(ctx, ["stop", holder]), () => docker(ctx, ["stop", holder]), holder);
    } catch (e) {
      return setErr(String(e));
    }
    await run(p, "up");
  }

  async function addFolder() {
    setErr(null);
    try {
      const known = new Set(all.map((p) => p.dir));
      const dir = await scan.add();
      if (dir) {
        setAdded(known.has(dir) ? `${tilde(dir)} is already in the list.` : `Added ${tilde(dir)}. It stays in the list and is checked on every scan.`);
        setQ(projectName(dir.slice(dir.lastIndexOf("/") + 1)));
      }
    } catch (e) {
      setErr(String(e));
    }
  }

  return (
    <Drawer label="Compose projects" title={<>Compose projects</>} onClose={onClose}>
      <p className="hint">Every folder in your home with a Compose file. Missing one? Add its folder.</p>
      {fixing && <p className="hint">{bringing ? "Wait for the copy from Docker Desktop to finish" : "Wait for the fix to finish"} before starting or stopping a project.</p>}
      <div className="inline">
        <label className="search-field">
          <Icon name="search" size={14} />
          <input placeholder="Search projects" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button onClick={() => scan.scan()} disabled={scan.scanning}><Icon name="restart" size={13} /> {scan.scanning ? "Scanning…" : "Scan again"}</button>
        <button onClick={addFolder} disabled={scan.scanning}><Icon name="plus" size={13} /> Add a folder…</button>
      </div>
      {added && <p className="hint" role="status">{added}</p>}
      <Banner error={scan.error ?? err} onClose={() => setErr(null)} />
      {scan.paths && all.length === 0 && <p className="hint">No Compose files found. Spotlight skips hidden folders and folders it doesn't index.</p>}
      {cut && <p className="hint">Showing the first {SHOWN_MAX} Compose files, A to Z. Search to narrow the list.</p>}
      {all.length > 0 && rows.length === 0 && <p className="hint">Nothing matches "{q.trim()}". Try part of the folder name.</p>}
      <ul className="compose-list">
        {rows.map((p) => {
          const mine = busy?.dir === p.dir;
          const up = p.running > 0;
          const stopped = p.total - p.running;
          const sick = p.names.flatMap((n) => (attention?.get(n)?.[0] ? [`${n}: ${(attention.get(n)![0].short ?? attention.get(n)![0].title).toLowerCase()}`] : []));
          const logsHere = logsDir === p.dir;
          // On a partly running project, Start only starts what is stopped, so it says so.
          // Rebuild and Update images end with `up -d`, so on a stopped project they start it too, and say so.
          const label = (a: Action) => (a === "up" && up ? `Start the ${stopped} stopped` : !up && (a === "build" || a === "pull") ? `${VERB[a][0]} and start` : VERB[a][0]);
          // A failed Start may leave a network or some services behind; Down is offered then, as the note says.
          const leftovers = failed?.dir === p.dir && !mine;
          const btn = (a: Action, kind?: "primary" | "danger") => (
            <button className={kind} disabled={!!busy || fixing} title={fixing ? (bringing ? "Wait for the copy from Docker Desktop to finish" : "Wait for the fix to finish") : typed(p.dir, a, ctx)} aria-label={`${VERB[a][0]} ${p.name}`} onClick={() => run(p, a)}>
              {mine && busy?.action === a ? VERB[a][1] : label(a)}
            </button>
          );
          return (
            <li key={p.dir} className="compose-item">
              <div className="compose-head">
                <span className={sick.length ? "sdot warn" : up ? "sdot on" : "sdot"} aria-hidden="true" />
                <b>{p.name}</b>
                <span className="hint">{p.total ? `${p.running} of ${p.total} running` : "Not running"}</span>
              </div>
              {sick.length > 0 && <p className="compose-sick"><Icon name="alert" size={13} /> {sick.length === 1 ? "1 needs attention" : `${sick.length} need attention`}: {sick.join("; ")}</p>}
              <span className="mono sub clip" title={`${p.dir}/${p.files.join(", ")}`}>{tilde(p.dir)}</span>
              <div className="actions-inline">
                {up ? <>{stopped > 0 && btn("up", "primary")}{btn("restart")}{btn("stop")}{btn("down", "danger")}</> : <>{btn("up", "primary")}{leftovers && btn("down", "danger")}</>}
                {mine && <button className="link" onClick={() => invoke("cancel_compose").catch(() => {})}>Cancel</button>}
                {p.total > 0 && <button className="link" aria-expanded={!!logsHere} aria-label={`Logs of ${p.name}`} onClick={() => setLogsDir(logsHere ? null : p.dir)}>{logsHere ? "Hide logs" : "Logs"}</button>}
                {!mine && <button className="link" disabled={!!busy || fixing} title={typed(p.dir, "build", ctx)} aria-label={`Rebuild ${p.name}`} onClick={() => run(p, "build")}>{label("build")}</button>}
                {!mine && <button className="link" disabled={!!busy || fixing} title={typed(p.dir, "pull", ctx)} aria-label={`Update images of ${p.name}`} onClick={() => run(p, "pull")}>{label("pull")}</button>}
                {!mine && (
                  <button
                    className="link"
                    aria-label={`Show ${p.name} in Finder`}
                    onClick={() => invoke("reveal_compose", { path: `${p.dir}/${p.files[0]}` }).then(() => setErr(null), (e) => setErr(String(e)))}
                  >
                    Show in Finder
                  </button>
                )}
              </div>
              {failed?.dir === p.dir && failed.why && !mine && (
                <div className="note" role="status">
                  <p>{failed.why}</p>
                  {failed.holder && (
                    <button className="primary" disabled={!!busy || fixing} onClick={() => freePortAndStart(p, failed.holder!)}>
                      Stop {failed.holder} and start {p.name}
                    </button>
                  )}
                </div>
              )}
              {logsHere && <ComposeLogs ctx={ctx} file={`${p.dir}/${p.files[0]}`} project={p.name} />}
              {(mine || failed?.dir === p.dir) && <OutputLog event="compose-progress" active={mine} failure={failed?.dir === p.dir ? failed.text : null} />}
              <details className="fix-commands">
                <summary>Run it yourself</summary>
                {(up ? (["up", "restart", "stop", "down", "build", "pull"] as Action[]) : (["up", "build", "pull"] as Action[])).map((a) => (
                  <div key={a} className="cmd-row">
                    <span className="cmd-label">{label(a)}</span>
                    <pre className="cmd">{typed(p.dir, a, ctx)}</pre>
                    <CopyCommand text={typed(p.dir, a, ctx)} label={`Copy the ${VERB[a][0].toLowerCase()} command for ${p.name}`} />
                  </div>
                ))}
              </details>
            </li>
          );
        })}
      </ul>
    </Drawer>
  );
}

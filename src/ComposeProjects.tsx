// Compose projects found on the Mac, next to what is already running from them. Start, Stop, Restart and Down run
// `docker compose` in the project's own folder, exactly as typing it there would.
import { useMemo, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import Drawer from "./ui/Drawer";
import OutputLog from "./ui/OutputLog";
import { Banner, useConfirm } from "./ui";
import { Icon } from "./ui/icons";
import { ComposeScan } from "./useComposeScan";
import { cdPath, projectsFrom, shellQuote, whyFailed } from "./lib/composeScan";
import type { ComposeProject } from "./lib/composeScan";
import { rank } from "./lib/fuzzy";
import { activity } from "./lib/activity";
import { useFixRuns } from "./FixIt";

type Ctr = { State: string; Labels?: string; Names?: string; Ports?: string };
type Action = "up" | "stop" | "restart" | "down";
// The backend sends one path past this cap when the list was cut.
const SHOWN_MAX = 300;
const tilde = (dir: string) => dir.replace(/^\/Users\/[^/]+/, "~");
const VERB: Record<Action, [string, string]> = { up: ["Start", "Starting…"], stop: ["Stop", "Stopping…"], restart: ["Restart", "Restarting…"], down: ["Down", "Taking down…"] };
const tail = (a: Action) => (a === "up" ? "up -d" : a);
// What the button runs, as you'd type it, with the context named so a paste acts on the same profile.
const ctxWord = (ctx: string) => (/^[\w.@-]+$/.test(ctx) ? ctx : shellQuote(ctx));
const typed = (dir: string, a: Action, ctx: string) => `cd ${cdPath(dir)} && docker --context ${ctxWord(ctx)} compose ${tail(a)}`;

// The run outlives the panel: switching tabs unmounts it, but the backend keeps going, so its state lives here.
type RunState = { busy: { dir: string; action: Action } | null; failed: { dir: string; text: string; why: string | null } | null };
let state: RunState = { busy: null, failed: null };
const subs = new Set<() => void>();
const setRun = (next: Partial<RunState>) => { state = { ...state, ...next }; subs.forEach((f) => f()); };
const useRun = () => useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => state);
const NO_COMPOSE = /'compose' is not a docker command|unknown command "compose"|unknown shorthand flag: 'd'/i;

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

type Props = { ctx: string; scan: ComposeScan; containers: Ctr[]; onClose: () => void; onChanged?: () => void; query?: string };

export default function ComposeProjects({ ctx, scan, containers, onClose, onChanged, query = "" }: Props) {
  const confirm = useConfirm();
  const [q, setQ] = useState(query);
  const [err, setErr] = useState<string | null>(null);
  // One project at a time, as the backend allows; its output shows under it.
  const { busy, failed } = useRun();
  // A Fix renames a container to NAME-old; compose acting on the project then would remove or restart that copy.
  const fixing = useFixRuns().some((r) => r.step != null);
  const cut = (scan.paths?.length ?? 0) > SHOWN_MAX;
  const all = useMemo(() => projectsFrom((scan.paths ?? []).slice(0, SHOWN_MAX), containers), [scan.paths, containers]);
  const rows = useMemo(() => rank(all, q, (p) => p.name, (p) => tilde(p.dir)), [all, q]);

  async function run(p: ComposeProject, action: Action) {
    if (state.busy || fixing) return;
    if (action === "down" && !(await confirm(`Stop and remove the containers of ${p.name}? Its volumes, and the data in them, stay.`, "Down"))) return;
    setRun({ busy: { dir: p.dir, action }, failed: null });
    try {
      await activity.ran(`compose ${action}`, typed(p.dir, action, ctx), () => invoke<void>("compose_action", { context: ctx, file: `${p.dir}/${p.files[0]}`, action }), p.name);
    } catch (e) {
      const text = String(e);
      const why = NO_COMPOSE.test(text) ? "docker compose isn't installed, so nothing ran. The Doctor can install it." : whyFailed(text, containers);
      // Compose may have created a network or some services before it failed; Down clears what it left.
      const left = action === "up" ? " Part of the project may have been created; Down removes what was left." : "";
      setRun({ failed: { dir: p.dir, text, why: why ? `${why}${left}` : left.trim() || null } });
    } finally {
      setRun({ busy: null });
      onChanged?.();
    }
  }

  return (
    <Drawer label="Compose projects" title={<>Compose projects</>} onClose={onClose} closeDisabled={!!busy}>
      <p className="hint">Every folder in your home with a Compose file.</p>
      {fixing && <p className="hint">Wait for the fix to finish before starting or stopping a project.</p>}
      <div className="inline">
        <label className="search-field">
          <Icon name="search" size={14} />
          <input placeholder="Search by name, initials or folder" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button onClick={() => scan.scan()} disabled={scan.scanning}><Icon name="restart" size={13} /> {scan.scanning ? "Scanning…" : "Scan again"}</button>
      </div>
      <Banner error={scan.error ?? err} onClose={() => setErr(null)} />
      {scan.paths && all.length === 0 && <p className="hint">No Compose files found. Spotlight skips hidden folders and folders it doesn't index.</p>}
      {cut && <p className="hint">Showing the first {SHOWN_MAX} Compose files, A to Z. Search to narrow the list.</p>}
      {all.length > 0 && rows.length === 0 && <p className="hint">Nothing matches "{q.trim()}". Try part of the folder name.</p>}
      <ul className="compose-list">
        {rows.map((p) => {
          const mine = busy?.dir === p.dir;
          const up = p.running > 0;
          const stopped = p.total - p.running;
          // On a partly running project, Start only starts what is stopped, so it says so.
          const label = (a: Action) => (a === "up" && up ? `Start the ${stopped} stopped` : VERB[a][0]);
          const btn = (a: Action, kind?: "primary" | "danger") => (
            <button className={kind} disabled={!!busy || fixing} title={fixing ? "Wait for the fix to finish" : typed(p.dir, a, ctx)} aria-label={`${VERB[a][0]} ${p.name}`} onClick={() => run(p, a)}>
              {mine && busy?.action === a ? VERB[a][1] : label(a)}
            </button>
          );
          return (
            <li key={p.dir} className="compose-item">
              <div className="compose-head">
                <span className={up ? "sdot on" : "sdot"} aria-hidden="true" />
                <b>{p.name}</b>
                <span className="hint">{p.total ? `${p.running} of ${p.total} running` : "Not running"}</span>
              </div>
              <span className="mono sub clip" title={`${p.dir}/${p.files.join(", ")}`}>{tilde(p.dir)}</span>
              <div className="actions-inline">
                {up ? <>{stopped > 0 && btn("up", "primary")}{btn("restart")}{btn("stop")}{btn("down", "danger")}</> : btn("up", "primary")}
                {mine && <button className="link" onClick={() => invoke("cancel_compose").catch(() => {})}>Cancel</button>}
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
              {failed?.dir === p.dir && failed.why && !mine && <p className="note" role="status">{failed.why}</p>}
              {(mine || failed?.dir === p.dir) && <OutputLog event="compose-progress" active={mine} failure={failed?.dir === p.dir ? failed.text : null} />}
              <details className="fix-commands">
                <summary>Run it yourself</summary>
                {(up ? (["up", "restart", "stop", "down"] as Action[]) : (["up"] as Action[])).map((a) => (
                  <div key={a} className="cmd-row">
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

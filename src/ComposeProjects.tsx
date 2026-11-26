// Compose projects found on the Mac, next to what is already running from them. Start, Stop, Restart and Down run
// `docker compose` in the project's own folder, exactly as typing it there would.
import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import OutputLog from "./ui/OutputLog";
import { usePlatform } from "./lib/platform";
import RegistryLoginFix from "./RegistryLoginFix";
import ComposeLogs from "./ComposeLogs";
import { Banner, Button, Col, Dot, Empty, Field, Icon, List, Menu, MenuItem, MenuSeparator, MoreButton, Problem, Row, Sheet, useConfirm } from "./ui/op";
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
// A long folder path keeps its start and its end, so the folder's own name shows. The full path is in the title.
const PATH_SHOWN = 48;
const middle = (s: string) => (s.length <= PATH_SHOWN ? s : `${s.slice(0, 20)}…${s.slice(-26)}`);
const VERB: Record<Action, [string, string]> = { up: ["Start", "Starting…"], stop: ["Stop", "Stopping…"], restart: ["Restart", "Restarting…"], down: ["Remove containers", "Removing containers…"], build: ["Rebuild", "Rebuilding…"], pull: ["Update images", "Updating images…"] };
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
    // Compose may have created a network or some services before it failed; Remove containers clears what it left.
    const left = action === "up" && !refused ? "Part of the project may have been created; Remove containers (under More actions) clears what was left." : "";
    // The banner always names a reason, even when none is known: the raw error waits under Show details.
    const reason = why ?? `Docker couldn't start ${p.name}.`;
    setRun({ failed: { dir: p.dir, action, text, why: left ? `${reason} ${left}` : reason, holder: portHolder(text, containers), service } });
  } finally {
    setRun({ busy: null });
  }
  return true;
}

function CopyCommand({ text, label }: { text: string; label: string }) {
  return (
    <Button icon="copy" size="xs" onClick={() => navigator.clipboard.writeText(text)} aria-label={label} title={text}>
      Copy
    </Button>
  );
}

// attention: what the Doctor found per container name, so a card says "web keeps restarting", not just "2 of 3 running".
type Props = { ctx: string; scan: ComposeScan; containers: Ctr[]; attention?: Map<string, { short?: string; title: string }[]>; onClose: () => void; onChanged?: () => void; query?: string };

export default function ComposeProjects({ ctx, scan, containers, attention, onClose, onChanged, query = "" }: Props) {
  const confirm = useConfirm();
  const win = usePlatform().os === "windows"; // no Finder there
  const [q, setQ] = useState(query);
  const [err, setErr] = useState<string | null>(null);
  const [cmdsOpen, setCmdsOpen] = useState<Set<string>>(new Set());
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
    if (action === "down" && !(await confirm({ title: `Remove the containers of ${p.name}?`, body: "Its volumes, and the data in them, stay.", confirm: "Remove containers", danger: true }))) return;
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
    <Sheet open={true} onClose={onClose} title="Start a Compose project" wide>
      <p className="hint">Every folder in your home with a Compose file. Missing one? Add its folder.</p>
      {fixing && <p className="hint">{bringing ? "Wait for the copy from Docker Desktop to finish" : "Wait for the fix to finish"} before starting or stopping a project.</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Field aria-label="Search projects" placeholder="Search projects" icon="search" width="search" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button icon="restart" size="md" onClick={() => scan.scan()} disabled={scan.scanning}>
          {scan.scanning ? "Scanning…" : "Scan again"}
        </Button>
        <Button icon="plus" size="md" onClick={addFolder} disabled={scan.scanning}>Choose a folder…</Button>
      </div>
      {added && <p className="text-sm text-fg-muted" role="status">{added}</p>}
      {scan.error || err ? <Banner tone="bad" title="Warning">{scan.error ?? err}</Banner> : null}
      {scan.paths && all.length === 0 && (
        <Empty icon="folder" title="No Compose files found">Spotlight skips hidden folders and folders it doesn't index.</Empty>
      )}
      {cut && <p className="hint">Showing the first {SHOWN_MAX} Compose files, A to Z. Search to narrow the list.</p>}
      {all.length > 0 && rows.length === 0 && <p className="text-sm text-fg-muted">Nothing matches "{q.trim()}". Try part of the folder name.</p>}
      <List aria-label="Compose projects">
        {rows.map((p) => {
          const mine = busy?.dir === p.dir;
          const up = p.running > 0;
          const stopped = p.total - p.running;
          const sick = p.names.flatMap((n) => (attention?.get(n)?.[0] ? [`${n}: ${(attention.get(n)![0].short ?? attention.get(n)![0].title).toLowerCase()}`] : []));
          const logsHere = logsDir === p.dir;
          const full = `${p.dir}/${p.files.join(", ")}`;
          // On a partly running project, Start only starts what is stopped, so it says so.
          // Rebuild and Update images end with `up -d`, so on a stopped project they start it too, and say so.
          const label = (a: Action) => (a === "up" && up ? `Start the ${stopped} stopped` : !up && (a === "build" || a === "pull") ? `${VERB[a][0]} and start` : VERB[a][0]);
          // A failed Start may leave a network or some services behind; Remove containers is offered then, as the note says.
          const leftovers = failed?.dir === p.dir && !mine;
          const off = !!busy || fixing;
          const btn = (a: Action) => (
            <Button size="xs" disabled={off} title={fixing ? (bringing ? "Wait for the copy from Docker Desktop to finish" : "Wait for the fix to finish") : typed(p.dir, a, ctx)} aria-label={`${VERB[a][0]} ${p.name}`} onClick={() => run(p, a)}>
              {mine && busy?.action === a ? VERB[a][1] : label(a)}
            </Button>
          );
          const menu = (
            <Menu trigger={<MoreButton name={p.name} />} label={`Actions for ${p.name}`} align="end" wide contentClassName="z-50">
              {up && stopped > 0 && (
                <MenuItem label="Stop" why="When you're done for now. The containers stay, so Start is quick." disabled={off} onSelect={() => void run(p, "stop")} />
              )}
              {up && (
                <MenuItem label="Restart" why="After you change a setting in compose.yaml." disabled={off} onSelect={() => void run(p, "restart")} />
              )}
              <MenuItem label={label("build")} why="After you change a Dockerfile or the code it copies in." disabled={off} onSelect={() => void run(p, "build")} />
              <MenuItem label={label("pull")} why="When a newer version of an image is out." disabled={off} onSelect={() => void run(p, "pull")} />
              {p.total > 0 && <MenuSeparator />}
              {p.total > 0 && (
                <MenuItem label={logsHere ? "Hide logs" : "Show logs"} why="When something misbehaves and you want to see why." disabled={off} onSelect={() => setLogsDir(logsHere ? null : p.dir)} />
              )}
              <MenuItem label={cmdsOpen.has(p.dir) ? "Hide the commands" : "Show the commands to run yourself"} why="If you'd rather run it in Terminal yourself." onSelect={() => setCmdsOpen((o) => { const n = new Set(o); if (!n.delete(p.dir)) n.add(p.dir); return n; })} />
              {!win && <MenuItem label="Show in Finder" why="To edit compose.yaml or the project's files." onSelect={() => void invoke("reveal_compose", { path: `${p.dir}/${p.files[0]}` }).then(() => setErr(null), (e) => setErr(String(e)))} />}
              {(up || leftovers) && <MenuSeparator />}
              {(up || leftovers) && (
                <MenuItem label="Remove containers" why="To start clean. Volumes and data are kept." danger disabled={off} onSelect={() => void run(p, "down")} />
              )}
            </Menu>
          );
          // The common action is the button: Start when the project has stopped services, Stop when it runs.
          return (
            <div key={p.dir} className="border-b border-line">
              <Row
                tall
                lead={<Icon name="folder" size="sm" />}
                name={<span className="font-semibold">{p.name}</span>}
                title={full}
                meta={<span className="path font-mono text-meta" title={full}>{middle(tilde(p.dir))}</span>}
                action={mine ? <Button size="xs" onClick={() => invoke("cancel_compose").catch(() => {})}>Cancel</Button> : up && stopped === 0 ? btn("stop") : btn("up")}
                menu={!mine ? menu : undefined}
              >
                <Col kind="state"><span className="flex items-center gap-1.5"><Dot state={up ? "ok" : "off"} /><span className="status">{p.total ? `${p.running} of ${p.total} running` : "Not running"}</span></span></Col>
              </Row>
              {sick.length > 0 && <Problem level="warn" text={sick.length === 1 ? "1 needs attention" : `${sick.length} need attention`} />}
              {failed?.dir === p.dir && !mine && <RegistryLoginFix text={failed.text} />}
              {failed?.dir === p.dir && failed.why && !mine && (
                <Problem
                  level="bad"
                  wrap
                  text={failed.why}
                  action={failed.holder ? <Button size="xs" className="primary" disabled={!!busy || fixing} onClick={() => freePortAndStart(p, failed.holder!)}>Stop {failed.holder} and start {p.name}</Button> : undefined}
                />
              )}
              {failed?.dir === p.dir && !mine && (
                <details className="mt-1 px-3 pb-2 text-meta text-fg-muted">
                  <summary className="cursor-pointer select-none hover:text-fg">Show details</summary>
                  <div className="mt-2 flex flex-col items-start gap-2">
                    <pre className="max-h-40 w-full overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg-canvas p-3 font-mono text-meta text-fg">{failed.text}</pre>
                    <Button size="xs" icon="copy" aria-label={`Copy the error for ${p.name}`} onClick={() => navigator.clipboard.writeText(failed.text)}>Copy</Button>
                  </div>
                </details>
              )}
              {logsHere && <ComposeLogs ctx={ctx} file={`${p.dir}/${p.files[0]}`} project={p.name} />}
              {(mine || failed?.dir === p.dir) && <OutputLog event="compose-progress" active={mine} />}
              {cmdsOpen.has(p.dir) && (
                <div className="mt-2 flex flex-col gap-1.5" role="group" aria-label={`Commands for ${p.name}`}>
                  {(up ? (["up", "restart", "stop", "down", "build", "pull"] as Action[]) : (["up", "build", "pull"] as Action[])).map((a) => (
                    <div key={a} className="flex flex-col gap-1">
                      <span className="font-mono text-xs">{label(a)}</span>
                      <pre className="font-mono text-sm">{typed(p.dir, a, ctx)}</pre>
                      <CopyCommand text={typed(p.dir, a, ctx)} label={`Copy the ${VERB[a][0].toLowerCase()} command for ${p.name}`} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </List>
    </Sheet>
  );
}

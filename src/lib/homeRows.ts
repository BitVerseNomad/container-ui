// Turns `docker ps -a` into the home screen's rows: one per Compose project, one per loose container, and one for
// everything Kubernetes runs. A project is keyed by its folder, so two folders called "shop" stay two rows.
import { isKubeOwned, parseLabels } from "./compose.ts";
import { projectKey, stoppedByApp } from "./appStopped.ts";

const PROJECT = "com.docker.compose.project";
const WORKDIR = "com.docker.compose.project.working_dir";
const FILES = "com.docker.compose.project.config_files";
export const KUBE_KEY = "\u0000kubernetes";

type Ctr = { ID: string; Names: string; State: string; Status: string; Labels?: string };
// files: Compose file names inside dir, known from the folder scan or the containers' labels. Empty when neither
// says, and then Start and Stop act on the containers themselves.
export type App<T extends Ctr> = { key: string; kind: "compose" | "container" | "kubernetes"; name: string; dir: string | null; files: string[]; rows: T[] };
export type AppState = "running" | "stopped" | "partly";

// What `docker inspect` tells about how a container is meant to run. `ps` has none of it: an exited container shows
// no ports there, and no restart policy at all.
// ranMs: StartedAt to FinishedAt of its last run, undefined when either is missing. startedAt: when that run began.
// volume: a named volume is mounted (data that outlives the container, so a service). job: another Compose service
// waits for it with `condition: service_completed_successfully`, so Compose itself calls it a one-shot. byApp: this
// app stopped it after it last started (set by the caller, not by inspect).
export type RunInfo = { restart: string; published: boolean; healthCheck: boolean; ranMs?: number; startedAt?: number; volume: boolean; job: boolean; byApp?: boolean };
type Inspected = {
  Name?: string;
  State?: { StartedAt?: string; FinishedAt?: string };
  Mounts?: { Type?: string; Name?: string }[] | null;
  HostConfig?: { RestartPolicy?: { Name?: string }; PortBindings?: Record<string, unknown[] | null> | null };
  Config?: { Healthcheck?: { Test?: string[] } | null; Labels?: Record<string, string> | null };
};
const SERVICE = "com.docker.compose.service";
const DEPENDS = "com.docker.compose.depends_on";
// Docker writes 0001-01-01T00:00:00Z for a time it never set.
const when = (t?: string) => { const ms = t ? Date.parse(t) : NaN; return Number.isNaN(ms) || ms <= 0 ? undefined : ms; };
const serviceKey = (l: Record<string, string>, service: string) => `${l[WORKDIR] ?? ""}\u0000${l[PROJECT] ?? ""}\u0000${service}`;
export function runInfo(inspect: unknown[]): Map<string, RunInfo> {
  const all = inspect.map((raw) => raw as Inspected).filter((c) => c?.Name);
  // depends_on reads "db:service_healthy:false,migrate:service_completed_successfully:false".
  const jobs = new Set<string>();
  for (const c of all) {
    const l = c.Config?.Labels ?? {};
    for (const dep of (l[DEPENDS] ?? "").split(",")) {
      const [service, condition] = dep.split(":");
      if (service && condition === "service_completed_successfully") jobs.add(serviceKey(l, service));
    }
  }
  const out = new Map<string, RunInfo>();
  for (const c of all) {
    const test = c.Config?.Healthcheck?.Test;
    const l = c.Config?.Labels ?? {};
    const started = when(c.State?.StartedAt);
    const ended = when(c.State?.FinishedAt);
    out.set(c.Name!.replace(/^\//, ""), {
      restart: c.HostConfig?.RestartPolicy?.Name ?? "",
      published: Object.values(c.HostConfig?.PortBindings ?? {}).some((b) => Array.isArray(b) && b.length > 0),
      healthCheck: !!test?.length && test[0] !== "NONE",
      ranMs: started !== undefined && ended !== undefined && ended >= started ? ended - started : undefined,
      startedAt: started,
      // An anonymous volume (64 hex characters) is scratch space the image declared, not data someone keeps.
      volume: (c.Mounts ?? []).some((m) => m?.Type === "volume" && !!m.Name && !/^[0-9a-f]{64}$/.test(m.Name)),
      job: !!l[SERVICE] && jobs.has(serviceKey(l, l[SERVICE])),
    });
  }
  return out;
}
// The run info of one ps row with "stopped by this app" filled in. ctx null: no VM is running, so nothing in it can
// have been stopped by this app (said plainly, not left to a key that matches nothing).
export function withAppStop(ctx: string | null, c: { ID: string; Names: string; State: string; Labels?: string }, info: RunInfo | undefined): RunInfo | undefined {
  if (!info) return info;
  if (!ctx) return { ...info, byApp: false };
  const l = parseLabels(c.Labels ?? "");
  const dir = l.get(WORKDIR);
  const name = l.get(PROJECT);
  // Only while docker reports the run our stop ended: a later start, from anywhere, clears it.
  return { ...info, byApp: stoppedByApp(ctx, c.ID, [c.ID, c.Names, dir && name ? projectKey(dir, name) : null], info.startedAt, c.State === "exited") };
}
type Row = { State: string; Status: string };
// A run this short that ended with exit 0 is a job (a migration, a seed). The window is kept short on purpose: every
// minute added lets a service that was stopped soon after it started hide as Finished.
export const JOB_MS = 2 * 60_000;
// Finished means done, not down. Exit 0 and one of: Compose says another service waits for it to complete, or it has
// nothing that marks a service (published port, health check, restart policy, named volume) and ran under 2 minutes.
// Never when this app stopped it. Anything not known (inspect not read, no run time) is the safer reading: Stopped.
export function finished(c: Row, info?: RunInfo) {
  if (c.State !== "exited" || !/^Exited \(0\)/.test(c.Status) || !info || info.byApp) return false;
  if (info.job) return true;
  const plain = !info.published && !info.healthCheck && !info.volume && (info.restart === "" || info.restart === "no");
  return plain && info.ranMs !== undefined && info.ranMs < JOB_MS;
}
export const stateWord = (c: Row, info?: RunInfo) => (c.State === "running" ? "Running" : finished(c, info) ? "Finished" : "Stopped");

// Names for a line: "a", "a and b", "a, b and c", then "a, b, c and N more".
export const listed = (names: string[]) => {
  const shown = names.length > 3 ? [...names.slice(0, 3), `${names.length - 3} more`] : names;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0];
};
// The line under a partly running project for what is down with no problem line of its own, so every container
// missing from "N of M running" is on a line: "cache is stopped" with Start, or "cache and db are stopped" with
// Start them.
// The label starts with the visible words ("Start them: cache and db"), so a voice command for the button works.
// done: what is said once they run, the names that started (not the project's name).
export const downLine = (names: string[]) => ({
  text: `${listed(names)} ${names.length === 1 ? "is" : "are"} stopped`,
  button: names.length === 1 ? "Start" : "Start them",
  label: names.length === 1 ? `Start ${names[0]}` : `Start them: ${listed(names)}`,
  done: `${listed(names)} started`,
});

// What a project's "Start …" item starts, named: one by name, several as "the 2 stopped (cache, report-job)", with at
// most three names before "and N more".
// A line about how the last run ended (out of memory, an error) is over once the container runs, but a crash loop
// (a restart policy) would flip it on and off: then only after the new run has lasted over a minute. Read from
// `docker ps` ("Up 5 seconds", "Up About a minute"), so no clock is compared.
const JUST_UP = /^Up (Less than a second|\d+ seconds?)\b/;
// No inspect yet: the policy is unknown, so the line stays until it lands (a loop would flicker otherwise).
export const lastRunOver = (c: Row & { Status?: string }, info: RunInfo | undefined) =>
  c.State === "running" && !!info && (!info.restart || info.restart === "no" || !JUST_UP.test(c.Status ?? ""));

export function startWhat(names: string[]) {
  if (names.length === 1) return names[0];
  const shown = names.slice(0, 3).join(", ");
  return `the ${names.length} stopped (${names.length > 3 ? `${shown} and ${names.length - 3} more` : shown})`;
}

export function appState<T extends Row>(rows: T[], info: (c: T) => RunInfo | undefined = () => undefined): { state: AppState; up: number; of: number } {
  const counted = rows.filter((c) => !finished(c, info(c)));
  const up = counted.filter((c) => c.State === "running").length;
  const of = counted.length;
  return { state: up === 0 ? "stopped" : up === of ? "running" : "partly", up, of };
}

// The name Compose gives a project from its folder: lowercase, letters, digits, "-" and "_" only.
const defaultName = (folder: string) => folder.toLowerCase().replace(/[^a-z0-9_-]/g, "");

// scanned: Compose files found on the Mac (full paths). A folder there wins over the label, which can name a file
// that was moved since.
export function appsFrom<T extends Ctr>(containers: T[], scanned: string[] = []): App<T>[] {
  const onDisk = new Map<string, string[]>();
  for (const p of scanned) {
    const cut = p.lastIndexOf("/");
    const dir = p.slice(0, cut).toLowerCase();
    onDisk.set(dir, [...(onDisk.get(dir) ?? []), p.slice(cut + 1)]);
  }
  const projects = new Map<string, App<T>>();
  const out: App<T>[] = [];
  const kube: T[] = [];
  for (const c of containers) {
    if (isKubeOwned(c)) {
      kube.push(c);
      continue;
    }
    const l = parseLabels(c.Labels ?? "");
    const name = l.get(PROJECT);
    if (!name) {
      out.push({ key: c.ID, kind: "container", name: c.Names, dir: null, files: [], rows: [c] });
      continue;
    }
    const dir = l.get(WORKDIR) ?? null;
    // The label keeps the path as typed in the shell; APFS ignores letter case, so ~/dev and ~/Dev are one folder.
    // Two projects can run from one folder (`docker compose -p other up`), so the label is part of the key.
    const key = dir ? `${dir.toLowerCase()}\u0000${name}` : `label:${name}`;
    let app = projects.get(key);
    if (!app) {
      const fromLabel = (l.get(FILES) ?? "").split(",").filter((f) => dir && f.startsWith(`${dir}/`)).map((f) => f.slice(dir!.length + 1));
      app = { key, kind: "compose", name, dir, files: (dir && onDisk.get(dir.toLowerCase())?.sort()) || fromLabel, rows: [] };
      projects.set(key, app);
      out.push(app);
    }
    app.rows.push(c);
  }
  // `docker compose` in a folder acts on the folder's default project. When a second one runs from the same folder
  // (`-p other`), only the default keeps its file; the other's Start and Stop go to its containers by ID.
  const byDir = new Map<string, App<T>[]>();
  for (const a of projects.values()) if (a.dir) byDir.set(a.dir.toLowerCase(), [...(byDir.get(a.dir.toLowerCase()) ?? []), a]);
  for (const [dir, same] of byDir) {
    if (same.length < 2) continue;
    const own = defaultName(dir.slice(dir.lastIndexOf("/") + 1));
    for (const a of same) if (a.name !== own) a.files = [];
  }
  // Alphabetical and nothing else: a row never moves because something started or stopped.
  out.sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
  for (const a of out) a.rows.sort((x, y) => x.Names.localeCompare(y.Names));
  if (kube.length) out.push({ key: KUBE_KEY, kind: "kubernetes", name: "Kubernetes", dir: null, files: [], rows: kube });
  return out;
}

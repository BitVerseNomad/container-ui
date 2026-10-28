// Turns `docker ps -a` into the home screen's rows: one per Compose project, one per loose container, and one for
// everything Kubernetes runs. A project is keyed by its folder, so two folders called "shop" stay two rows.
import { isKubeOwned, parseLabels } from "./compose.ts";

const PROJECT = "com.docker.compose.project";
const WORKDIR = "com.docker.compose.project.working_dir";
const FILES = "com.docker.compose.project.config_files";
export const KUBE_KEY = "\u0000kubernetes";

type Ctr = { ID: string; Names: string; State: string; Status: string; Labels?: string };
// files: Compose file names inside dir, known from the folder scan or the containers' labels. Empty when neither
// says, and then Start and Stop act on the containers themselves.
export type App<T extends Ctr> = { key: string; kind: "compose" | "container" | "kubernetes"; name: string; dir: string | null; files: string[]; rows: T[] };
export type AppState = "running" | "stopped" | "partly";

// A job that finished cleanly (a migration, a seed) is done, not down.
export const finished = (c: { State: string; Status: string }) => c.State === "exited" && /^Exited \(0\)/.test(c.Status);

export function appState(rows: { State: string; Status: string }[]): { state: AppState; up: number; of: number } {
  const counted = rows.filter((c) => !finished(c));
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

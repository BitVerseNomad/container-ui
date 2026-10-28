// Turns the Compose files Spotlight found into projects, and matches them to containers already started from them.
import { parseLabels } from "./compose.ts";

const WORKDIR = "com.docker.compose.project.working_dir";

// Compose's default project name: the folder name, lowercased, keeping only letters, digits, "-" and "_".
export function projectName(folder: string): string {
  return folder.toLowerCase().replace(/[^a-z0-9_-]/g, "");
}

export type ComposeProject = { name: string; dir: string; files: string[]; running: number; total: number };
type Ctr = { State: string; Labels?: string };

export function projectsFrom(paths: string[], containers: Ctr[]): ComposeProject[] {
  const byDir = new Map<string, string[]>();
  for (const p of paths) {
    const cut = p.lastIndexOf("/");
    const dir = p.slice(0, cut);
    byDir.set(dir, [...(byDir.get(dir) ?? []), p.slice(cut + 1)]);
  }
  // Matched by folder, not by name: two folders called "shop" are two different projects.
  const inDir = new Map<string, Ctr[]>();
  for (const c of containers) {
    const dir = parseLabels(c.Labels ?? "").get(WORKDIR);
    // The label keeps the path as typed in the shell; APFS ignores letter case, so ~/dev and ~/Dev are one folder.
    if (dir) inDir.set(dir.toLowerCase(), [...(inDir.get(dir.toLowerCase()) ?? []), c]);
  }
  return [...byDir]
    .map(([dir, files]) => {
      const cs = inDir.get(dir.toLowerCase()) ?? [];
      return { name: projectName(dir.slice(dir.lastIndexOf("/") + 1)), dir, files: files.sort(), running: cs.filter((c) => c.State === "running").length, total: cs.length };
    })
    .sort((a, b) => Number(b.total > 0) - Number(a.total > 0) || a.name.localeCompare(b.name) || a.dir.localeCompare(b.dir));
}

export const shellQuote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;

// What to paste in Terminal to do it yourself.
// The context is named so the project starts in the profile on screen, not whichever one Terminal has selected.
export const upCommand = (dir: string, ctx: string) => `cd ${shellQuote(dir)} && docker --context ${shellQuote(ctx)} compose up -d`;

type Named = { Names?: string; Ports?: string; Labels?: string };
// A folder as you'd type it in any shell: ~/code/shop when that is safe to leave bare, the full path quoted otherwise
// (bash does not expand a ~ that sits next to a quote).
export const cdPath = (dir: string) => {
  const short = dir.replace(/^\/Users\/[^/]+/, "~");
  return /^~?[\w./@+-]*$/.test(short) ? short : shellQuote(dir);
};

// Docker's own words for a taken port, turned into who holds it, when one of the listed containers does.
const TAKEN = /(?:Bind for [\d.:[\]]*?:(\d+) failed: port is already allocated|listen tcp[46]? [\d.:[\]]*?:(\d+): bind: address already in use)/i;
export function whyFailed(text: string, containers: Named[]): string | null {
  const m = TAKEN.exec(text);
  if (!m) return null;
  const port = m[1] ?? m[2];
  const holder = containers.find((c) => new RegExp(`(^|[ ,:])${port}->`).test(c.Ports ?? ""));
  if (!holder) return `Port ${port} is already in use on your Mac, so a service that needs it couldn't start. Stop whatever uses ${port}, then Start again.`;
  const project = parseLabels(holder.Labels ?? "").get("com.docker.compose.project");
  return `Port ${port} is already used by ${holder.Names}${project ? ` (in ${project})` : ""}, so a service that needs it couldn't start. Stop ${holder.Names}, then Start again.`;
}

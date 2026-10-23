// Groups `docker ps` rows by their Compose project, read from the labels Compose sets on every container.

const PROJECT = "com.docker.compose.project";
const WORKDIR = "com.docker.compose.project.working_dir";

// `docker ps --format json` joins labels with commas, and some values (config_files) contain commas too,
// so a piece without "=" belongs to the value before it.
export function parseLabels(s: string): Map<string, string> {
  const out = new Map<string, string>();
  let last: string | null = null;
  for (const part of s ? s.split(",") : []) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      last = part.slice(0, eq);
      out.set(last, part.slice(eq + 1));
    } else if (last) out.set(last, `${out.get(last)},${part}`);
  }
  return out;
}

export type Group<T> = { project: string | null; dir: string | null; rows: T[] };

export function groupByProject<T extends { Labels?: string }>(rows: T[]): Group<T>[] {
  const groups = new Map<string, Group<T>>();
  const loose: T[] = [];
  for (const r of rows) {
    const l = parseLabels(r.Labels ?? "");
    const p = l.get(PROJECT);
    if (!p) {
      loose.push(r);
      continue;
    }
    const g = groups.get(p) ?? { project: p, dir: l.get(WORKDIR) ?? null, rows: [] };
    g.rows.push(r);
    groups.set(p, g);
  }
  const out = [...groups.values()].sort((a, b) => a.project!.localeCompare(b.project!));
  if (loose.length) out.push({ project: null, dir: null, rows: loose });
  return out;
}

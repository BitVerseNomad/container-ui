// Which containers use which volume, and which unused volumes are safe to bulk-remove.

type Inspected = { Name: string; Mounts: { Type: string; Name?: string }[] | null };

// volume name -> names of the containers that mount it (from `docker inspect <all containers>`)
export function volumeUsage(containers: Inspected[]): Map<string, string[]> {
  const usage = new Map<string, string[]>();
  for (const c of containers) {
    for (const m of c.Mounts ?? []) {
      if (m.Type !== "volume" || !m.Name) continue;
      usage.set(m.Name, [...(usage.get(m.Name) ?? []), c.Name.replace(/^\//, "")]);
    }
  }
  return usage;
}

// Docker names anonymous volumes with a 64-character hex ID; named volumes hold data someone chose to keep.
export const isAnonymous = (name: string) => /^[0-9a-f]{64}$/.test(name);

// The only volumes the bulk "remove unused" action may touch.
export const unusedAnonymous = (names: string[], usage: Map<string, string[]>): string[] =>
  names.filter((n) => isAnonymous(n) && !usage.has(n));

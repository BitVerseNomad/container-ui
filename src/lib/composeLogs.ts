// `docker compose logs --timestamps` lines: "<container>  | <RFC3339Nano time> <text>". Services arrive interleaved,
// so lines are sorted by time and the newest time is tracked per service: one global "newest" would drop a slower
// service's lines that arrive later with an older time.
import { parseLine } from "./logMerge.ts";

const PREFIX = /^(\S+?)\s+\| (.*)$/;

export type ProjectLine = { service: string; key: string; iso: string; text: string };

export function parseProjectLine(raw: string): ProjectLine {
  const m = PREFIX.exec(raw);
  if (!m) return { service: "", key: "", iso: "", text: raw };
  return { service: m[1], ...parseLine(m[2]) };
}

export function mergeProjectLogs(prev: ProjectLine[], chunk: string, cap = 5000): ProjectLine[] {
  const last = new Map<string, string>();
  for (const l of prev) if (l.key > (last.get(l.service) ?? "")) last.set(l.service, l.key);
  const fresh = chunk
    .split("\n")
    .filter((l) => l.trim() !== "")
    .map(parseProjectLine)
    // `--since` includes lines at exactly that time, so only strictly newer ones per service are new.
    .filter((l) => !l.key || l.key > (last.get(l.service) ?? ""));
  if (!fresh.length) return prev;
  return [...prev, ...fresh].sort((a, b) => (a.key && b.key ? a.key.localeCompare(b.key) : 0)).slice(-cap);
}

// The oldest of the per-service newest times, so the next poll misses no service. Null starts from the tail.
export function projectSince(lines: ProjectLine[]): string | null {
  const last = new Map<string, ProjectLine>();
  for (const l of lines) if (l.key && l.key > (last.get(l.service)?.key ?? "")) last.set(l.service, l);
  const oldest = [...last.values()].sort((a, b) => a.key.localeCompare(b.key))[0];
  return oldest?.iso ?? null;
}

// A service name as you'd say it: "shop-web-1" in project shop is "web".
export const serviceName = (container: string, project: string) => container.replace(new RegExp(`^${project.replace(/[^\w-]/g, "")}[-_]`), "").replace(/[-_]\d+$/, "");

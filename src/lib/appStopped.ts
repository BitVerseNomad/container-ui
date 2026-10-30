// Which containers this app stopped, so a database stopped with the Stop button never reads Finished: docker stop
// sends SIGTERM and Postgres or Redis exit 0 on it, which looks the same as a job that completed.
// Each stop keeps its time. It counts only while the container's current run started before it, so any later start
// clears it, from wherever it came: a terminal `docker compose up -d`, a restart policy, a recreate under the same name.
// Keys are per Docker context, so stopping db in one profile says nothing about db in another. Kept for the app's
// lifetime; after a restart of the app the run-time rule (homeRows.finished) still tells the two apart.
const stops = new Map<string, number>();
const subs = new Set<() => void>();
let version = 0;
const tell = () => { version += 1; subs.forEach((l) => l()); };
const at = (ctx: string, key: string) => `${ctx}\u0000${key}`;
const FULL_ID = /^[0-9a-f]{64}$/;

// Called with every `docker` argument list the app runs, and with the stops the backend made itself.
export function noteDocker(ctx: string, args: string[], now = Date.now()) {
  if (args[0] !== "stop" && args[0] !== "kill") return;
  // ps shows 12-character IDs; a container's own page may stop it by its full one.
  for (const a of args.slice(1)) if (!a.startsWith("-")) { stops.set(at(ctx, a), now); if (FULL_ID.test(a)) stops.set(at(ctx, a.slice(0, 12)), now); }
  tell();
}
export const projectKey = (dir: string, name: string) => `${dir.toLowerCase()}\u0000${name}`;
// Called with every Compose action the app runs on a project.
export function noteCompose(ctx: string, dir: string, name: string, action: string, now = Date.now()) {
  if (action !== "stop" && action !== "down") return;
  stops.set(at(ctx, projectKey(dir, name)), now);
  tell();
}
// The latest stop this app made of any of these keys (ID, name, project key) in this context.
export function stoppedAt(ctx: string, keys: (string | null | undefined)[]): number | undefined {
  const times = keys.flatMap((k) => (k && stops.has(at(ctx, k)) ? [stops.get(at(ctx, k))!] : []));
  return times.length ? Math.max(...times) : undefined;
}
// Stopped by the app: a stop of ours came after the run docker reports. No start time known is the safe reading.
export const byApp = (stopped: number | undefined, startedAt: number | undefined) => stopped !== undefined && (startedAt === undefined || startedAt < stopped);
export const appStoppedVersion = () => version;
export const subscribeAppStopped = (l: () => void) => { subs.add(l); return () => { subs.delete(l); }; };
// Tests only.
export function resetAppStopped() { stops.clear(); tell(); }

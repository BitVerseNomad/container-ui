// Which containers this app stopped, so a database stopped with the Stop button never reads Finished: docker stop
// sends SIGTERM and Postgres or Redis exit 0 on it, which looks the same as a job that completed.
// Each stop keeps the Mac's time, but only until the first look: the first time home sees the container exited and
// stopped by us, it keeps that run's StartedAt (the VM's clock) beside the stop. From then on "stopped by the app"
// means the run docker reports is that same run, so the two clocks are never compared again, and any later start
// clears it, from wherever it came: a terminal `docker compose up -d`, a restart policy, a recreate.
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
// Stopped by the app, before the first look: a stop of ours came after the run docker reports. No start time known
// is the safe reading.
export const byApp = (stopped: number | undefined, startedAt: number | undefined) => stopped !== undefined && (startedAt === undefined || startedAt < stopped);
// The run each stop ended, once seen: `${ctx}\0${id}` -> the stop's time and that run's StartedAt.
const seen = new Map<string, { stop: number; started: number }>();
// What home asks per container: id from ps, keys (ID, name, project key), the run's StartedAt, and whether it is
// exited now. The first look that finds it exited and stopped by us keeps its StartedAt; later looks compare to it.
// It changes nothing anyone is subscribed to, so it is safe to call while rendering.
export function stoppedByApp(ctx: string, id: string, keys: (string | null | undefined)[], startedAt: number | undefined, exited: boolean): boolean {
  const stop = stoppedAt(ctx, keys);
  if (stop === undefined) return false;
  const pin = seen.get(at(ctx, id));
  if (pin && pin.stop === stop) return startedAt === pin.started;
  // That stop was pinned when it ran, for every container it ended: one without a pin under it (a recreate, with a
  // new ID) is a container our stop never touched. Only a stop that never got that pin falls back to the clocks.
  if (pinnedAtStop.has(at(ctx, String(stop)))) return false;
  const ours = byApp(stop, startedAt);
  if (ours && exited && startedAt !== undefined) seen.set(at(ctx, id), { stop, started: startedAt });
  return ours;
}
// Right after the app's own stop, the run it ended, read with docker inspect: pinned at once, so the Mac's clock is
// never compared with the VM's. key: what the stop was keyed by (an ID or name, or the project key for Compose). A
// failed read pins nothing, and the first look above still pins.
export type Ended = { Id: string; Name?: string; State?: { StartedAt?: string } };
const pinnedAtStop = new Set<string>();
export function pinStopped(ctx: string, key: string, runs: Ended[]) {
  const stop = stops.get(at(ctx, key));
  if (stop === undefined) return;
  if (runs.length) pinnedAtStop.add(at(ctx, String(stop)));
  for (const r of runs) {
    const started = Date.parse(r.State?.StartedAt ?? "");
    if (!r.Id || Number.isNaN(started)) continue;
    for (const id of new Set([r.Id, r.Id.slice(0, 12)])) seen.set(at(ctx, id), { stop, started });
  }
}
// Which inspected run a stop argument named: an ID (full or short) or a name.
export const runOf = (arg: string, runs: Ended[]) => runs.filter((r) => r.Id.startsWith(arg) || r.Name?.replace(/^\//, "") === arg);
export const appStoppedVersion = () => version;
export const subscribeAppStopped = (l: () => void) => { subs.add(l); return () => { subs.delete(l); }; };
// Tests only.
export function resetAppStopped() { stops.clear(); seen.clear(); pinnedAtStop.clear(); tell(); }

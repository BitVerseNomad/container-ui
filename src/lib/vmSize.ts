// Colima's own default (2 CPUs, 2 GiB) is too small for most local stacks, and the Setup check
// would warn about it right away. Half the cores and a quarter of the memory leave the Mac usable.
import { isKubeOwned } from "./compose.ts";
import { explainStartFailure } from "./startFailure.ts";

export type Host = { cpus: number; memory: number };
const GiB = 1024 ** 3;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function firstVmSize(h: Host): { cpus: number; memory: number } {
  return { cpus: clamp(Math.floor(h.cpus / 2), 2, 8), memory: clamp(Math.floor(h.memory / GiB / 4), 2, 16) };
}

// The size Doctor's one click gives a small VM: what this Mac would start a new VM with, never less than it has now,
// and never more than half the Mac's memory, so macOS keeps enough. null when that is no bigger, or would still be as
// small as Colima's default; then the numbers are the user's call.
// Free memory is not checked: macOS counts its file cache as used, and the VM takes memory as it needs it, so the
// total is the only steady number. A start that still runs out is caught after (see stepDown).
export function resizeTo(vm: { cpus: number; memory: number }, pick: { cpus: number; memory: number } | null, hostMemory?: number): { cpus: number; memory: number } | null {
  if (!pick) return null;
  const now = { cpus: vm.cpus, memory: Math.round(vm.memory / GiB) };
  const half = hostMemory ? Math.floor(hostMemory / GiB / 2) : pick.memory;
  const to = { cpus: Math.max(now.cpus, pick.cpus), memory: Math.max(now.memory, Math.min(pick.memory, half)) };
  if (to.cpus <= 2 || to.memory <= 2) return null;
  return to.cpus === now.cpus && to.memory === now.memory ? null : to;
}

// One step down after the Mac couldn't give the memory: the next smaller common size, still more than the VM had.
const STEPS = [3, 4, 6, 8, 12, 16];
// One step up after a container still ran out of memory: the next common size above the one just tried, kept to
// half the Mac's memory (as the first size is). None when no bigger size fits.
export function stepUp(to: { cpus: number; memory: number }, hostMemory?: number): { cpus: number; memory: number } | null {
  if (!hostMemory) return null;
  const memory = STEPS.find((m) => m > to.memory && m <= Math.floor(hostMemory / GiB / 2));
  return memory ? { cpus: to.cpus, memory } : null;
}
export function stepDown(to: { cpus: number; memory: number }, was: { cpus: number; memory: number } | null): { cpus: number; memory: number } | null {
  const floor = Math.max(2, was?.memory ?? 2);
  const memory = [...STEPS].reverse().find((m) => m < to.memory && m > floor);
  return memory ? { cpus: to.cpus, memory } : null;
}

export const sizeWords = (s: { cpus: number; memory: number }) => `${s.cpus} CPUs and ${s.memory} GiB`;
// The Mac's memory as Apple sells it, in GB.
export const macWords = (hostMemory: number) => `${Math.round(hostMemory / GiB)} GB`;

const count = (n: number) => `${n} running container${n === 1 ? "" : "s"}`;
// The confirm: what stops, and that the app starts it again, so nobody has to.
// was: the size now; when only the memory changes, the question names only that.
// kube: running containers Kubernetes owns; they aren't counted, since Kubernetes brings them back itself.
export function confirmText(to: { cpus: number; memory: number }, running: number | null, was?: { cpus: number; memory: number }, kube = 0): string {
  const stops = running === null ? "Running containers stop and start again after (about a minute)." : running === 0 ? "Nothing is running, so nothing stops. It takes about a minute." : `Your ${count(running)} ${running === 1 ? "stops and starts" : "stop and start"} again after (about a minute).`;
  return [`Give the VM ${was && was.cpus === to.cpus ? `${to.memory} GiB of memory` : sizeWords(to)}?`, `The VM restarts to take the new size. ${stops}${kube ? ` ${KUBE_BACK}` : ""}`, "", "Images, volumes and containers stay."].join("\n");
}

// The line after: what changed in the size (was: the size before), and that what ran runs again. No count: "N containers" would read against the row's own "N of M running", and the ones that didn't start have
// their own lines. extraOk: containers started from their own out-of-memory line that did start.
export function doneText(size: { cpus: number; memory: number }, restarted: number, failed: number, was?: { cpus: number; memory: number } | null, extraOk: string[] = []): string {
  const back = restarted - failed;
  const parts = was ? [size.cpus !== was.cpus && `${size.cpus} CPUs`, size.memory !== was.memory && `${size.memory} GiB`].filter(Boolean) : [];
  const grew = parts.length ? parts.join(" and ") : sizeWords(size);
  const ran = !restarted || !back ? "" : failed ? "Everything else that was running is running again" : "Everything that was running is running again";
  const extra = extraOk.length ? `${names(extraOk)} started again` : "";
  const said = ran && extra ? `${ran}, and ${extra}` : ran || extra;
  return `The VM has ${grew} now.${said ? ` ${said}.` : ""}`;
}

// One container that didn't start, on the result line: Docker's reason in plain words when the app knows it.
export const failLine = (f: { name: string; short: string | null }) => (f.short ? `${f.name} didn't start: ${f.short}.` : `${f.name} didn't start. See why shows Docker's message.`);

// Which of the names `docker start a b c` couldn't start. Docker lists them on its last line.
export function notStarted(error: string, tried: string[]): string[] {
  const m = /failed to start containers?: (.+)$/m.exec(error);
  if (!m) return tried;
  const said = m[1].split(/,\s*/).map((x) => x.trim()).filter(Boolean);
  return tried.filter((n) => said.includes(n));
}

// A failed resize in one plain sentence. The backend's lock message is already plain; a start failure reads like one.
export function explainResize(error: string, profile: string): { text: string; memory: boolean } {
  if (/^Another VM operation/.test(error)) return { text: error.split("\n")[0], memory: false };
  const e = explainStartFailure(error, profile);
  if (e.kind === "memory") return { text: "The Mac couldn't give the VM that much memory right now.", memory: true };
  return { text: e.kind === "unknown" ? `Colima couldn't start the VM with the new size. ${e.detail}` : `${e.title}. ${e.detail}`, memory: false };
}

const names = (l: string[]) => {
  const shown = l.length > 4 ? [...l.slice(0, 3), `${l.length - 3} more`] : l;
  return shown.length > 1 ? `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}` : shown[0];
};
export { names as nameList };

// How to start again what ran before the restart, with plain `docker start` (no compose file, so nothing is
// recreated or rebuilt): in waves, a Compose service after the services of its project it depends on, read from the
// `com.docker.compose.depends_on` label ("db:service_healthy:false,queue:service_started:false"). healthy: the
// containers a later wave waits on until they report healthy. A dependency that isn't running is ignored; a cycle
// puts its project in one wave. Loose containers start in the last wave.
export type RunningRow = { name: string; labels: Record<string, string> };
export type RestartPlan = { waves: string[][]; healthy: string[] };
const CONDITIONS = new Set(["service_started", "service_healthy", "service_completed_successfully"]);
export function dependsOn(label: string | undefined): { service: string; healthy: boolean }[] {
  return (label ?? "").split(",").flatMap((part) => {
    const [service, condition] = part.trim().split(":");
    return service && CONDITIONS.has(condition) ? [{ service, healthy: condition === "service_healthy" }] : [];
  });
}
// Kubernetes restarts its own pods; starting their containers by hand only breaks them, so the restart leaves them out.
export function withoutKube(rows: RunningRow[]): { rows: RunningRow[]; kube: number } {
  const own = rows.filter((r) => !isKubeOwned({ Names: r.name, Labels: Object.entries(r.labels).map(([k, v]) => `${k}=${v}`).join(",") }));
  return { rows: own, kube: rows.length - own.length };
}
export const KUBE_BACK = "Kubernetes brings its pods back on its own.";

// The containers to start again: what ran, plus the out-of-memory one (extra) in its depends_on place when its
// labels could be read (it is exited, so docker inspect still has them). Only what ran is counted. late: extras whose
// labels weren't read, started after the waves as before.
// Doctor's report and containers are held while the VM is resized, and after it until a read that started after the
// resize ended was kept (endedAt and dataFrom on the Mac's clock). A failed or older read keeps holding, and the
// next poll that lands releases it.
export const holdAfterResize = (resizing: boolean, endedAt: number | null, dataFrom: number) => resizing || (endedAt !== null && dataFrom < endedAt);

export function planWith(running: RunningRow[], extra: string[], inspected: RunningRow[] | null): { plan: RestartPlan; count: number; late: string[] } {
  const known = (inspected ?? []).filter((r) => extra.includes(r.name) && !!r.labels["com.docker.compose.project"]);
  return { plan: planRestart([...running, ...known]), count: running.length, late: extra.filter((n) => !known.some((k) => k.name === n)) };
}

export function planRestart(rows: RunningRow[]): RestartPlan {
  const level = new Map<string, number>();
  const healthy = new Set<string>();
  const loose: string[] = [];
  const projects = new Map<string, RunningRow[]>();
  for (const r of rows) {
    const project = r.labels["com.docker.compose.project"];
    // Keyed like the home list: two clones both called "shop" are two projects.
    const key = `${(r.labels["com.docker.compose.project.working_dir"] ?? "").toLowerCase()}\u0000${project}`;
    if (!project || !r.labels["com.docker.compose.service"]) loose.push(r.name);
    else projects.set(key, [...(projects.get(key) ?? []), r]);
  }
  for (const members of projects.values()) {
    const of = (svc: string) => members.filter((m) => m.labels["com.docker.compose.service"] === svc);
    const needs = new Map(members.map((m) => [m.name, dependsOn(m.labels["com.docker.compose.depends_on"]).flatMap((d) => of(d.service).map((c) => ({ name: c.name, healthy: d.healthy })))]));
    // Longest path from a container with no dependency; a container on a cycle never resolves.
    const mine = new Map<string, number>();
    for (let changed = true, rounds = 0; changed && rounds <= members.length; rounds++) {
      changed = false;
      for (const m of members) {
        const deps = needs.get(m.name)!;
        if (mine.has(m.name) || !deps.every((d) => mine.has(d.name))) continue;
        mine.set(m.name, deps.reduce((n, d) => Math.max(n, mine.get(d.name)! + 1), 0));
        changed = true;
      }
    }
    if (mine.size < members.length) { members.forEach((m) => level.set(m.name, 0)); continue; }
    mine.forEach((n, name) => level.set(name, n));
    needs.forEach((deps) => deps.filter((d) => d.healthy).forEach((d) => healthy.add(d.name)));
  }
  const waves: string[][] = [];
  level.forEach((n, name) => { (waves[n] ??= []).push(name); });
  const out = waves.filter(Boolean);
  if (loose.length) out.length ? out[out.length - 1].push(...loose) : out.push(loose);
  return { waves: out, healthy: [...healthy] };
}

// Why a container didn't start: a short reason for the result line, and the longer help when there is more to say.
// memory: the VM's memory in GiB after a resize. A memory failure says so and is marked, so the result offers the
// next size (or Profiles) instead of a Start that would fail the same way.
export function startReason(error: string, name: string, memory?: number): { short: string | null; long: string | null; memory?: boolean } {
  const port = /(?:Bind for [^\s]*:(\d+) failed: port is already allocated|listen tcp[^:]*:(\d+): bind: address already in use)/.exec(error);
  const p = port?.[1] ?? port?.[2];
  if (p) return { short: `port ${p} is in use on your Mac`, long: `Something on your Mac already uses port ${p}. Stop it, then press Start ${name}.` };
  const daemon = (error.split("\n").find((l) => /Error response from daemon/.test(l)) ?? error.split("\n")[0]).replace(/^.*Error response from daemon:\s*/, "").trim();
  if (/cannot allocate memory|out of memory|oom/i.test(daemon)) return { short: `${memory ? `${memory} GiB` : "the VM's memory"} still isn't enough for it. Give the VM more memory, or make ${name} use less`, long: daemon, memory: true };
  // No reason the app can say in plain words: short is null, and the result line points to See why.
  return daemon.length <= 90 ? { short: daemon.replace(/\.$/, ""), long: null } : { short: null, long: daemon };
}

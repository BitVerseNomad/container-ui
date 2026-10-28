// Every command a click ran, newest first, so the app never hides what it did to Docker. Now and then it asks you to
// recall the command before showing it, like a phone that asks for the PIN even though Face ID works: the button
// stays convenient and the skill doesn't fade (JetBrains' Key Promoter X does the same for keyboard shortcuts).
// what: the thing acted on, in words ("web", "shop"), for the toast to say what happened.
export type Entry = { id: number; kind: string; cmd: string; ok: boolean | null; at: number; recall: boolean; what?: string };
export type Activity = { entries: Entry[]; tips: boolean };
type Storage = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void };

const KEY = "colima-ui:learn";

// The command as you would type it. The context is always named, so a paste acts on the profile on screen and not
// on whichever one Terminal has selected. Quotes only words that need them.
const word = (w: string) => (/^[\w.@:/=+%,-]+$/.test(w) ? w : `'${w.replace(/'/g, `'\\''`)}'`);
export const dockerLine = (ctx: string, args: string[]) => ["docker", "--context", ctx, ...args].map(word).join(" ");

type Opts = { name: string; cpus?: number; memory?: number; disk?: number; runtime?: string; kubernetes?: boolean };
// The colima command behind a VM button, built the way the backend's start_args builds it.
const VM: Record<string, (a: { name?: string; opts?: Opts }) => string[]> = {
  start_profile: ({ opts: o }) => ["start", o!.name, ...(o!.cpus ? ["--cpu", String(o!.cpus)] : []), ...(o!.memory ? ["--memory", String(o!.memory)] : []), ...(o!.disk ? ["--disk", String(o!.disk)] : []), ...(o!.runtime ? ["--runtime", o!.runtime] : []), ...(o!.kubernetes ? ["--kubernetes"] : [])],
  stop_profile: ({ name }) => ["stop", name!],
  force_stop_profile: ({ name }) => ["stop", "--force", name!],
  restart_profile: ({ name }) => ["restart", name!],
  force_restart_profile: ({ name }) => ["stop", "--force", name!, "&&", "colima", "start", name!],
  delete_profile: ({ name }) => ["delete", "--force", name!],
};
export const colimaLine = (cmd: string, args: Record<string, unknown>): string | null =>
  VM[cmd] ? ["colima", ...VM[cmd](args as { name?: string; opts?: Opts })].map((w) => (w === "&&" ? w : word(w))).join(" ") : null;
// Logs a VM button's command when it has one; otherwise just runs it.
export const ranVm = <T,>(cmd: string, args: Record<string, unknown>, work: () => Promise<T>) => {
  const line = colimaLine(cmd, args);
  return line ? activity.ran(cmd.replace(/_profile$/, ""), line, work, `the ${String(args.name ?? (args.opts as Opts | undefined)?.name)} VM`) : work();
};
const KEEP = 100;

// Spaced, not every time: recall works because it is occasional (retrieval practice), and nagging gets turned off.
export const recallDue = (n: number) => n === 3 || n === 10 || n === 30 || (n >= 100 && n % 100 === 0);

export function createActivity(storage: Storage | undefined) {
  let saved: { counts: Record<string, number>; tips: boolean } = { counts: {}, tips: true };
  try {
    const raw = storage?.getItem(KEY);
    if (raw) saved = { ...saved, ...JSON.parse(raw) };
  } catch {
    // Blocked or broken storage: counting starts over, nothing else changes.
  }
  const save = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(saved));
    } catch {
      // Not remembered after a restart, which is fine.
    }
  };
  let state: Activity = { entries: [], tips: saved.tips };
  let next = 1;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((l) => l());
  const set = (entries: Entry[]) => {
    state = { ...state, entries };
    emit();
  };

  // kind groups clicks that teach the same command (every restart counts towards "restart").
  function record(kind: string, cmd: string, what?: string): number {
    const n = (saved.counts[kind] ?? 0) + 1;
    saved.counts[kind] = n;
    save();
    const id = next++;
    set([{ id, kind, cmd, what, ok: null, at: Date.now(), recall: saved.tips && recallDue(n) }, ...state.entries].slice(0, KEEP));
    return id;
  }
  const settle = (id: number, ok: boolean) => set(state.entries.map((e) => (e.id === id ? { ...e, ok } : e)));

  return {
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot: () => state,
    record,
    settle,
    // Runs the work and logs the command it stands for; the result or error passes through untouched.
    async ran<T>(kind: string, cmd: string, work: () => Promise<T>, what?: string): Promise<T> {
      const id = record(kind, cmd, what);
      try {
        const out = await work();
        settle(id, true);
        return out;
      } catch (e) {
        settle(id, false);
        throw e;
      }
    },
    // A recall entry, once shown, reads like any other.
    reveal: (id: number) => set(state.entries.map((e) => (e.id === id ? { ...e, recall: false } : e))),
    setTips(on: boolean) {
      saved.tips = on;
      save();
      state = { ...state, tips: on, entries: on ? state.entries : state.entries.map((e) => ({ ...e, recall: false })) };
      emit();
    },
  };
}

const browserStorage = (): Storage | undefined => {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
};
export const activity = createActivity(browserStorage());

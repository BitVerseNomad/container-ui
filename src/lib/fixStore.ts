// A running Fix and its result live here, not in the panel that started it: the panel goes away as soon as the
// container it describes is renamed, and the result must still reach the page. One run per container at a time.
import type { Connect, Replace } from "./health.ts";
import { runConnect, runFix } from "./fixRun.ts";
import type { FixResult } from "./fixRun.ts";

export type Run = { names: string[]; step: string | null; result: FixResult | null };
type Docker = (args: string[]) => Promise<string>;

let runs: Run[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
// Runs are told apart by their names array, which is created once per run.
const update = (names: string[], next: Partial<Run>) => {
  runs = runs.map((r) => (r.names === names ? { ...r, ...next } : r));
  emit();
};

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const snapshot = () => runs;

// The run that involves this container, under its own name or the -old name it has during the fix.
export const runFor = (list: Run[], name: string) => list.find((r) => r.names.includes(name.replace(/-old$/, "")));
export const busy = (list: Run[], name: string) => runFor(list, name)?.step != null;

export function dismiss(name: string) {
  runs = runs.filter((r) => !r.names.includes(name.replace(/-old$/, "")));
  emit();
}

// Starts a fix unless one is already running for any of its containers. Returns false when it didn't start.
export function startFix(steps: Replace[], docker: Docker, wait: (ms: number) => Promise<void>, allowed: ((args: string[]) => Promise<void>) | undefined, done: (r: FixResult) => void): boolean {
  return start(steps.map((s) => s.name), (onStep) => runFix(steps, docker, onStep, wait, allowed), done);
}

export function startConnect(c: Connect, docker: Docker, done: (r: FixResult) => void): boolean {
  return start(c.containers, (onStep) => runConnect(c, docker, onStep), done);
}

function start(names: string[], run: (onStep: (s: string) => void) => Promise<FixResult>, done: (r: FixResult) => void): boolean {
  if (names.some((n) => busy(runs, n))) return false;
  // Claimed before the first await, so a second click finds it busy.
  runs = [...runs.filter((r) => !r.names.some((n) => names.includes(n))), { names, step: "Checking…", result: null }];
  emit();
  run((step) => update(names, { step }))
    // runFix reports its own failures; this is only for a bug in it, where what changed isn't known.
    .catch((e): FixResult => ({ ok: false, replaced: [], leftover: [], failed: names[0], reason: `The fix stopped unexpectedly (${String(e)}). Check ${names.map((n) => `${n} and ${n}-old`).join(", ")} in the Containers list.`, logs: "", untouched: false, restored: false, unknown: true }))
    .then((result) => {
      update(names, { step: null, result });
      done(result);
    });
  return true;
}

// For tests.
export const reset = () => {
  runs = [];
  emit();
};

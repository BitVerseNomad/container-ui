// One rule for every button that changes containers or the VM: wait while something else is changing Docker.
// That is a VM start, stop or restart, a resize, a Bring over copy, a Compose run, or a Fix. A new button calls
// this instead of combining the stores by hand, so it can't miss one.
import { useSyncExternalStore } from "react";
import { bringBusy, useBringBusy } from "./bringBusy";
import { composeRunState, useComposeRun } from "./ComposeProjects";
import { busy as fixBusy, snapshot as fixRuns, subscribe as fixSubscribe } from "./lib/fixStore";
import { resizeState, resizing, useResize } from "./Resize";

// Whether App's VM runner has an operation going (vm.op). App owns the state and mirrors it here as it sets it,
// so a check outside React (a click handler, a claim after a confirm) reads the same value the screen shows.
let vmBusyNow = false;
const vmSubs = new Set<() => void>();
export const vmBusy = () => vmBusyNow;
export const setVmBusy = (next: boolean) => { if (next !== vmBusyNow) { vmBusyNow = next; vmSubs.forEach((f) => f()); } };
const useVmBusy = () => useSyncExternalStore((l) => { vmSubs.add(l); return () => vmSubs.delete(l); }, () => vmBusyNow);

// names: the containers this button acts on. A Fix locks only its own containers' buttons; without names, any Fix
// locks (the VM and Compose act on everything).
export function dockerLocked(names?: string[]): boolean {
  const runs = fixRuns();
  const fixing = names ? names.some((n) => fixBusy(runs, n)) : runs.some((r) => r.step != null);
  return vmBusyNow || resizing(resizeState()) || bringBusy() || !!composeRunState().busy || fixing;
}

// The same, re-rendering when any of them changes.
export function useDockerLocked(names?: string[]): boolean {
  useVmBusy();
  useResize();
  useBringBusy();
  useComposeRun();
  useSyncExternalStore(fixSubscribe, fixRuns);
  return dockerLocked(names);
}

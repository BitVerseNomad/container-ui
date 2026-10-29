// Whether "Bring them over" is copying right now. While it is, nothing else may touch Docker or the VM: a
// container started or a VM stopped under a copy or a replace would leave a half-written volume.
// Module level, like Resize's state, so the sidebar, Containers and Compose read it without a provider.
import { useSyncExternalStore } from "react";

let busy = false;
const subs = new Set<() => void>();
export const bringBusy = () => busy;
export const setBringBusy = (next: boolean) => { busy = next; subs.forEach((f) => f()); };
export const useBringBusy = () => useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => busy);

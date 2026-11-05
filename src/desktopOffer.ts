// What of Docker Desktop's data is still not in Colima, read once when home opens, again after a copy, and on window
// focus at most every 10 minutes while something is unknown or showing (never on a poll: it asks Docker Desktop, and
// `system df -v` walks every volume). Home's offer, its problem line and Doctor's row all read this one answer.
// Module level, like bringBusy, so App, Setup and Containers share it. The rules live in lib/desktopRead.
import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { docker } from "./api";
import { DesktopOffer, NOTHING, desktopReader } from "./lib/desktopRead";

export type { DesktopOffer };
let state = NOTHING;
const subs = new Set<() => void>();
export const useDesktopOffer = () => useSyncExternalStore((l) => { subs.add(l); return () => subs.delete(l); }, () => state);

const DF = ["system", "df", "-v", "--format", "json"];
const reader = desktopReader(
  {
    running: async () => (await invoke<{ running: boolean }>("desktop_state")).running,
    desktopDf: () => invoke<string>("desktop_docker", { args: DF }),
    colimaDf: (ctx) => docker(ctx, DF),
    colimaPs: (ctx) => docker(ctx, ["ps", "-a", "--format", "{{json .}}"]),
    colimaInspect: (ctx, names) => docker(ctx, ["inspect", "--type", "volume", ...names]),
  },
  (next) => { state = next; subs.forEach((f) => f()); },
);
export const readDesktop = reader.read;
export const readDesktopOnFocus = reader.onFocus;
export const adoptDesktop = reader.adopt;

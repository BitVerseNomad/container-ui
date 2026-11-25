import type { Profile } from "../api.ts";
import { ctxFor, gbOf } from "../api.ts";

export type EngineState = "running" | "stopped" | "starting" | "stopping" | "unreachable";

// Until iteration 4 the only engines are Colima machines.
export type ColimaEngine = {
  id: string;            // the Colima profile name ("default", "work")
  context: string;       // the docker context name (ctxFor)
  caption: string;
  name: string;          // "default"
  label: string;         // "Colima · default"
  state: EngineState;
  managed: boolean;      // the app can start and stop it (not the WSL engine)
  cpus: number;
  memoryGb: number;
  kubernetes: boolean;
};

export type EngineOptions = { busy?: "starting" | "stopping" | null; kubernetes?: boolean; unreachable?: boolean };

export function engineOfProfile(p: Profile, opts: EngineOptions = {}): ColimaEngine {
  const running = p.status === "Running";
  const state: EngineState = opts.busy ?? (opts.unreachable ? "unreachable" : running ? "running" : "stopped");
  return {
    id: p.name,
    context: ctxFor(p.name),
    caption: "Colima",
    name: p.name,
    label: `Colima · ${p.name}`,
    state,
    managed: true,
    cpus: p.cpus,
    memoryGb: gbOf(p.memory),
    kubernetes: !!opts.kubernetes && running,
  };
}

// Windows: the docker inside WSL2. One engine, always running, nothing to start, stop or resize.
export const wslEngine = (p: Profile): ColimaEngine => ({ ...engineOfProfile(p), caption: "Docker", name: "WSL", label: p.name, managed: false });

// The muted line under the label (spec 5.3 rule 2).
export function stateLine(e: ColimaEngine): string {
  if (!e.managed) return "Running";
  switch (e.state) {
    case "running": return `Running · ${e.cpus} CPU · ${e.memoryGb} GB`;
    case "stopped": return "Stopped";
    case "starting": return "Starting…";
    case "stopping": return "Stopping…";
    case "unreachable": return "Not reachable";
  }
}

// The facts on a row of the popover: "4 CPU · 8 GB · Kubernetes", "Stopped".
export function factsLine(e: ColimaEngine): string {
  if (!e.managed || e.state !== "running") return stateLine(e);
  return [`${e.cpus} CPU`, `${e.memoryGb} GB`, ...(e.kubernetes ? ["Kubernetes"] : [])].join(" · ");
}

export const dotOf = (e: ColimaEngine): "ok" | "bad" | "busy" | "off" =>
  e.state === "running" ? "ok" : e.state === "unreachable" ? "bad" : e.state === "starting" || e.state === "stopping" ? "busy" : "off";

// "Engine: Colima, default. Running" (the button's accessible name, as in the mockup).
export const buttonLabel = (e: ColimaEngine): string => `Engine: ${e.caption}, ${e.name}. ${stateLine(e).split(" · ")[0]}`;

export type EngineGroup = { caption: string; engines: ColimaEngine[] };
export const groupEngines = (list: ColimaEngine[]): EngineGroup[] => (list.length ? [{ caption: list[0].caption, engines: list }] : []);

// Which machine an operation in progress belongs to. App.tsx passes { op: vm.op, name: opName(vm) }; "restarting" shows as "starting".
export type BusyInput = { op: "starting" | "stopping" | "restarting" | null; name?: string };
export const busyOf = (b: BusyInput, machine: string): "starting" | "stopping" | null =>
  b.op && b.name === machine ? (b.op === "stopping" ? "stopping" : "starting") : null;

// Which engine is selected: the stored one if it still exists, else the first running one, else the first.
export function chooseEngine(list: ColimaEngine[], stored: string | null): ColimaEngine | null {
  return list.find((e) => e.id === stored) ?? list.find((e) => e.state === "running") ?? list[0] ?? null;
}

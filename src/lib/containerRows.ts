import { KUBE_KEY, type App } from "./homeRows.ts";

import type { DotState } from "../ui/op/index.ts";

// Shape of a container record as returned by `docker ps` (matches the local `Ctr` type in homeRows.ts).
type CtrShape = { ID: string; Names: string; State: string; Status: string; Labels?: string };

// What one container needs to be drawn (a plain copy of what docker ps and the Doctor say).
export type StateInput = {
  state: string;            // docker State: running, restarting, exited, paused, created, dead
  exitCode?: number;        // exited containers
  oomKilled?: boolean;
  unhealthy?: boolean;      // the health check is failing
  finding?: "bad" | "warn" | null;   // the worst Doctor finding about it
  busy?: "Starting…" | "Stopping…" | "Restarting…" | "Removing…" | null;
};

export type StateView = { dot: DotState; word: string; action: "Stop" | "Start"; busy: boolean };

// Spec 6.4 table, row by row. A busy row wins over everything.
export function stateView(i: StateInput): StateView {
  if (i.busy) return { dot: "busy", word: i.busy, action: i.busy === "Stopping…" ? "Start" : "Stop", busy: true };
  if (i.oomKilled) return { dot: "bad", word: "Out of memory", action: "Start", busy: false };
  if (i.state === "restarting") return { dot: "warn", word: "Restarting", action: "Stop", busy: false };
  if (i.state === "running" || i.state === "paused") {
    const word = i.state === "paused" ? "Paused" : i.unhealthy ? "Unhealthy" : "Running";
    const dot: DotState = i.unhealthy || i.finding === "bad" ? "bad" : i.finding === "warn" ? "warn" : "ok";
    return { dot, word, action: "Stop", busy: false };
  }
  if (i.state === "exited" && (i.exitCode ?? 0) !== 0) return { dot: "bad", word: "Stopped (error)", action: "Start", busy: false };
  return { dot: "off", word: "Stopped", action: "Start", busy: false };
}

// "2% · 512 MB". Empty when the container is not running.
export function statsText(cpuPercent: number, memBytes: number, running: boolean): string {
  if (!running) return "";
  return `${Math.round(cpuPercent)}% · ${memText(memBytes)}`;
}

// Sizes with one unit and at most three digits (spec 9.5): "9 MB", "512 MB", "1.6 GB".
export function memText(bytes: number): string {
  const mb = bytes / 1024 ** 2;
  if (mb < 1000) return `${Math.max(1, Math.round(mb))} MB`;
  const gb = bytes / 1024 ** 3;
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(1)} GB`;
}

// Docker's Ports text ("0.0.0.0:8080->80/tcp, :::8080->80/tcp, 5432/tcp") to the host ports, once each, in order.
export function hostPorts(ports: string): number[] {
  const out: number[] = [];
  for (const m of ports.matchAll(/(?:^|[ ,])(?:[\d.]+|::|\[::\]):(\d+)->/g)) {
    const n = Number(m[1]);
    if (!out.includes(n)) out.push(n);
  }
  return out;
}

// At most two ports show; more become "+n" that opens the detail's Network tab (spec 7.1 rule 4).
export function portCell(ports: number[]): { shown: number[]; more: number } {
  return { shown: ports.slice(0, 2), more: Math.max(0, ports.length - 2) };
}

export type BlockState = "ok" | "warn" | "bad" | "off";

export type Block = { name: string; state: BlockState; label: string };

export const blockOfDot = (d: DotState): BlockState => (d === "off" ? "off" : d === "busy" ? "warn" : d);
export const blockOf = (name: string, dot: DotState, word: string): Block => ({ name, state: blockOfDot(dot), label: word });

// The header summary: "10" or "10 · 5 need attention" (spec 7.1 rule 1).
export function summary(total: number, needAttention: number): string {
  return needAttention > 0 ? `${total} · ${needAttention} need attention` : String(total);
}

// Order (spec 7.1 rule 7): entries with a problem first, then running, then stopped; alphabetical inside each.
// The Kubernetes group is always last: the cluster owns it.
export type SortInput = { key: string; name: string; hasProblem: boolean; running: boolean };

export function sortEntries<T extends SortInput>(entries: T[]): T[] {
  const rank = (e: T) => (e.key === KUBE_KEY ? 3 : e.hasProblem ? 0 : e.running ? 1 : 2);
  return [...entries].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

// A project is open by default when anything in it needs attention (spec 7.1 rule 5). A saved choice wins.
export const isOpen = (hasProblem: boolean, saved: boolean | undefined): boolean => saved ?? hasProblem;

export type Line<C> =
  | { kind: "entry"; id: string; entry: App<any>; open: boolean }
  | { kind: "child"; id: string; entry: App<any>; c: C }
  | { kind: "problem"; id: string; entry: App<any>; c: C; indent: boolean; prefix: boolean };

export function flatten<C>(entries: App<any>[], open: (e: App<any>) => boolean, hasProblem: (c: C) => boolean): Line<C>[] {
  const out: Line<C>[] = [];
  for (const e of entries) {
    const isGroup = e.kind === "compose";
    const opened = isGroup && open(e);
    out.push({ kind: "entry", id: e.key, entry: e as never, open: opened });
    if (e.kind === "kubernetes") continue;
    if (opened) {
      for (const c of e.rows) {
        out.push({ kind: "child", id: `${e.key}/${c.Names}`, entry: e as never, c: c as never });
        if (hasProblem(c)) out.push({ kind: "problem", id: `${e.key}/${c.Names}/problem`, entry: e as never, c: c as never, indent: true, prefix: false });
      }
    } else {
      for (const c of e.rows) if (hasProblem(c)) out.push({ kind: "problem", id: `${e.key}/${c.Names}/problem`, entry: e as never, c: c as never, indent: false, prefix: isGroup });
    }
  }
  return out;
}

export const countNeedAttention = <C>(entries: App<any>[], hasProblem: (c: C) => boolean): number =>
  entries.filter((e) => e.kind !== "kubernetes" && e.rows.some(hasProblem)).length;

import { invoke } from "@tauri-apps/api/core";
import { Ended, noteDocker, pinStopped, projectKey, runOf } from "./lib/appStopped";

export type Profile = {
  name: string;
  status: string;
  arch: string;
  cpus: number;
  memory: number;
  disk: number;
  runtime: string;
  address?: string;
};

// Only the fields you set are passed to `colima start`; the rest keep their saved values.
export type StartOpts = {
  name: string;
  cpus?: number;
  memory?: number; // GiB
  disk?: number; // GiB
  runtime?: string;
  kubernetes?: boolean;
};

export const gbOf = (bytes: number) => Math.round(bytes / 1024 ** 3);

// Colima registers a docker context per profile: "colima" for default, "colima-<name>" otherwise.
export const ctxFor = (name: string) => (name === "default" ? "colima" : `colima-${name}`);

// Every stop and start the app runs is noted, so a service it stopped never reads Finished.
export const docker = (ctx: string, args: string[], mergeStderr = false) => {
  noteDocker(ctx, args);
  const run = invoke<string>("docker", { context: ctx, args, mergeStderr });
  if (args[0] === "stop" || args[0] === "kill") void run.then(() => pinAfterStop(ctx, args.slice(1).filter((a) => !a.startsWith("-")))).catch(() => {});
  return run;
};

// After the app's stop: the StartedAt of each run it ended, pinned (appStopped.pinStopped).
const inspectRuns = async (ctx: string, ids: string[]) => (ids.length ? (JSON.parse(await invoke<string>("docker", { context: ctx, args: ["inspect", ...ids], mergeStderr: false })) as (Ended & { Config?: { Labels?: Record<string, string> | null } })[]) : []);
async function pinAfterStop(ctx: string, keys: string[]) {
  const runs = await inspectRuns(ctx, keys);
  for (const k of keys) pinStopped(ctx, k, runOf(k, runs));
}
// The same after `compose stop`: the project's containers by its label, then only the clone in that folder.
export async function pinComposeStop(ctx: string, dir: string, name: string) {
  const ids = (await invoke<string>("docker", { context: ctx, args: ["ps", "-a", "-q", "--filter", `label=com.docker.compose.project=${name}`], mergeStderr: false })).split("\n").map((l) => l.trim()).filter(Boolean);
  const runs = (await inspectRuns(ctx, ids)).filter((r) => (r.Config?.Labels?.["com.docker.compose.project.working_dir"] ?? "").toLowerCase() === dir.toLowerCase());
  pinStopped(ctx, projectKey(dir, name), runs);
}

export async function dockerJson<T>(ctx: string, args: string[]): Promise<T[]> {
  const out = await docker(ctx, [...args, "--format", "{{json .}}"]);
  return out
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as T);
}

// Opens a link in the browser. A failure would otherwise be a click that does nothing, so it reaches
// the app-wide banner instead.
export function openUrl(url: string): Promise<void> {
  return invoke<void>("open_url", { url }).catch((e) => {
    window.dispatchEvent(new CustomEvent("app-error", { detail: `Couldn't open ${url}: ${e}` }));
  });
}

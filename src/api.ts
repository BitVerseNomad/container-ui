import { invoke } from "@tauri-apps/api/core";

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

export const docker = (ctx: string, args: string[], mergeStderr = false) =>
  invoke<string>("docker", { context: ctx, args, mergeStderr });

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

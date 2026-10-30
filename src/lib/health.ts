// Health, restarts and exit codes, turned into plain-language problems.
// Exit-code meanings are from Docker's own run.go (125, 126, 127) and the 128 + signal convention; see docs/research/2026-10-09-observability.md.

import type { VmChange } from "./vmChange.ts";

export type Health = { status: "starting" | "healthy" | "unhealthy"; streak: number; lastOutput: string; lastExit: number | null };
// memLimit: the container's own memory limit in bytes (HostConfig.Memory, 0 = none). composeFile: the first file of
// its config_files label (an override can come after it, in composeFiles); service: its Compose service.
export type State = { name: string; running: boolean; status: string; exitCode: number; oomKilled: boolean; restartCount: number; startedAt: string; health: Health | null; memLimit: number; composeFile: string | null; composeFiles: string[]; service: string | null; restart: string };
// One container replaced in place: the old one is renamed to <name>-old and stopped, `run` (docker run args) starts
// the new one, it joins `connect`, and the old one is removed only once the new one keeps running.
// keep: what the container ran with, checked against its image before a Fix so nothing is silently dropped.
export type Keep = { image: string; imageId?: string; Cmd?: unknown; Entrypoint?: unknown; User?: unknown; WorkingDir?: unknown; Healthcheck?: unknown };
// restart: the container's own restart policy, turned off on the old copy while it waits aside and put back on undo.
export type Replace = { name: string; createNetwork?: string; run: string[]; connect: string[]; keep?: Keep; restart?: string };
// `short` is the list-row label when the title is too long. `fix` is shown as commands to copy; with `steps`, the
// app can also do it itself (Fix), in order.
// connect: one click joins containers to a network (adding a network takes nothing away). go: a page that has the fix.
export type Connect = { network: string; create: boolean; containers: string[] };
// resize: the fix is a bigger VM, which the app gives in one click where it can pick a size (src/Resize.tsx).
// reveal: the project's Compose file, shown in Finder when its project is listed (else See why only). apply: start
// that one service again with `docker compose up -d <service>`, so Compose recreates it with the file's new limit.
// vm: a change that restarts the VM (share a folder, restart for the Mac's network, the Mac's proxy), run by the app
// through the same runner as the size change (src/Resize.tsx, src/lib/vmChange.ts).
export type ProblemFix = { label: string; text: string; note?: string; steps?: Replace[]; confirm?: string; connect?: Connect; go?: "Profiles" | "Images"; resize?: boolean; reveal?: string; apply?: Apply; vm?: VmChange };
// limit: what the container was killed at (bytes); where: how the line names the file(s) ("`compose.yaml`").
export type Apply = { file: string; service: string; limit: number; where: string };
// id is the check's id ("oom", "kafka-localhost", "localhost-target"...), stable so a finding can be muted.
export type Problem = { id: string; level: "bad" | "warn"; title: string; short?: string; detail: string; fix?: ProblemFix };

export function exitCodeMeaning(code: number): string {
  switch (code) {
    case 0: return "finished normally";
    case 1: return "stopped with an error";
    case 125: return "Docker couldn't start it (a problem with the options it was run with)";
    case 126: return "its command can't be run (not executable)";
    case 127: return "its command was not found";
    case 128: return "stopped with an application-specific code";
    case 137: return "was killed (a forced stop or the system killing it)";
    case 139: return "crashed (a segmentation fault)";
    case 143: return "was asked to stop (a normal stop)";
    case 255: return "exited with a code out of range";
    default: return code > 128 && code < 255 ? `was ended by signal ${code - 128}` : `exited with code ${code}`;
  }
}

// `docker inspect <container>`
export function parseState(json: string): State | null {
  try {
    const c = JSON.parse(json)[0];
    if (!c?.State) return null;
    const h = c.State.Health;
    const last = h?.Log?.length ? h.Log[h.Log.length - 1] : null;
    return {
      name: String(c.Name ?? "").replace(/^\//, ""),
      running: !!c.State.Running,
      status: String(c.State.Status ?? ""),
      exitCode: Number(c.State.ExitCode ?? 0),
      oomKilled: !!c.State.OOMKilled,
      restartCount: Number(c.RestartCount ?? 0),
      startedAt: String(c.State.StartedAt ?? ""),
      memLimit: Number(c.HostConfig?.Memory ?? 0),
      composeFiles: String(c.Config?.Labels?.["com.docker.compose.project.config_files"] ?? "").split(",").map((x) => x.trim()).filter(Boolean),
      composeFile: String(c.Config?.Labels?.["com.docker.compose.project.config_files"] ?? "").split(",")[0].trim() || null,
      service: String(c.Config?.Labels?.["com.docker.compose.service"] ?? "") || null,
      restart: String(c.HostConfig?.RestartPolicy?.Name ?? ""),
      health: h ? { status: h.Status, streak: Number(h.FailingStreak ?? 0), lastOutput: String(last?.Output ?? "").trim(), lastExit: last ? Number(last.ExitCode) : null } : null,
    };
  } catch {
    return null;
  }
}

export const memWords = (bytes: number) => { const mib = Math.round(bytes / 1024 ** 2); return mib >= 1024 ? `${+(mib / 1024).toFixed(1)} GiB` : `${mib} MiB`; };
const baseName = (p: string) => p.slice(p.lastIndexOf("/") + 1);
// Its own limit counts as the cause only when clearly below the VM's memory; near it, the VM may be what ran out.
const OWN_LIMIT_SHARE = 0.75;

// vmMemory (bytes): the VM's memory, when known. A container that hit its own limit gets that said, with the way to
// apply a raised limit, never a bigger VM: the VM wasn't what ran out. Which key set the limit isn't known (mem_limit,
// deploy.resources.limits.memory, docker run -m), so none is named.
export function problemsFor(s: State, vmMemory?: number): Problem[] {
  const out: Problem[] = [];
  const ownLimit = s.memLimit > 0 && !!vmMemory && s.memLimit <= OWN_LIMIT_SHARE * vmMemory;
  if (!s.running && s.oomKilled && ownLimit) {
    // An override file may be the one that sets it, so with several files none is named as the place.
    const where = !s.composeFile ? "" : s.composeFiles.length > 1 ? "the project's Compose files" : `\`${baseName(s.composeFile)}\``;
    const apply = s.composeFile && s.service ? { file: s.composeFile, service: s.service, limit: s.memLimit, where } : undefined;
    out.push({
      id: "oom",
      level: "bad",
      title: `It hit its own ${memWords(s.memLimit)} memory limit${where ? ` (set in ${where})` : ""}`,
      detail: `${s.name} is allowed ${memWords(s.memLimit)} and used more, so Docker stopped it. A bigger VM won't help: ${apply ? `raise its memory limit in ${where}, then press Apply and start.` : "raise its memory limit or make it use less, then start it again."}`,
      ...(s.composeFile ? { fix: { label: `Apply and start ${s.name}`, text: "", reveal: s.composeFile, apply } } : {}),
    });
  } else if (!s.running && s.oomKilled) {
    const limit = s.memLimit > 0 ? ` It also has its own ${memWords(s.memLimit)} memory limit; if a bigger VM isn't enough, raise that too.` : "";
    out.push({ id: "oom", level: "bad", title: "Ran out of memory", detail: `${s.name} used more memory than it was allowed. Give the VM more memory or lower the app's memory use, then start it again.${limit}`, fix: { label: "Give the VM more memory", text: "", resize: true } });
  } else if (!s.running && s.exitCode !== 0 && s.exitCode !== 143) {
    out.push({ id: "crashed", level: "bad", title: "Stopped with an error", detail: `${s.name} ${exitCodeMeaning(s.exitCode)} (exit code ${s.exitCode}). The logs usually say why.` });
  }
  if (s.health?.status === "unhealthy") {
    const { streak, lastOutput, lastExit } = s.health;
    const last = lastOutput ? ` The last one said: "${lastOutput.slice(0, 240)}"` : lastExit !== null ? ` The check exited with code ${lastExit} and printed nothing.` : "";
    out.push({ id: "unhealthy", level: "bad", title: "Its health check is failing", detail: `${streak} checks in a row have failed.${last}` });
  }
  if (s.restartCount >= 3 && (s.running || s.status === "restarting")) {
    out.push({ id: "restarting", level: "warn", title: "It keeps restarting", detail: `${s.name} has restarted ${s.restartCount} times. The logs from its start usually show the error it hits.` });
  }
  return out;
}

// docker ps prints health in the Status text, like "Up 2 hours (healthy)".
export function healthFromStatus(status: string): Health["status"] | null {
  if (/\(unhealthy\)/.test(status)) return "unhealthy";
  if (/\(healthy\)/.test(status)) return "healthy";
  if (/\(health: starting\)/.test(status)) return "starting";
  return null;
}

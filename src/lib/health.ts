// Health, restarts and exit codes, turned into plain-language problems.
// Exit-code meanings are from Docker's own run.go (125, 126, 127) and the 128 + signal convention; see docs/research/2026-10-09-observability.md.

export type Health = { status: "starting" | "healthy" | "unhealthy"; streak: number; lastOutput: string; lastExit: number | null };
export type State = { name: string; running: boolean; status: string; exitCode: number; oomKilled: boolean; restartCount: number; startedAt: string; health: Health | null };
export type Problem = { id: "oom" | "unhealthy" | "restarting" | "crashed"; level: "bad" | "warn"; title: string; detail: string };

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
      health: h ? { status: h.Status, streak: Number(h.FailingStreak ?? 0), lastOutput: String(last?.Output ?? "").trim(), lastExit: last ? Number(last.ExitCode) : null } : null,
    };
  } catch {
    return null;
  }
}

export function problemsFor(s: State): Problem[] {
  const out: Problem[] = [];
  if (!s.running && s.oomKilled) {
    out.push({ id: "oom", level: "bad", title: "Ran out of memory", detail: `${s.name} used more memory than it was allowed. Give the VM more memory (Profiles, Edit) or lower the app's memory use, then start it again.` });
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

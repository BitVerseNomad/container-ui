// Turns a failed `colima start` into one plain sentence and one next step.
// Patterns come from the most-discussed abiosoft/colima issues (docs/research/2026-10-23-market.md).

export type StartFailure = {
  kind: "stuck" | "download" | "port" | "memory" | "unknown";
  title: string;
  detail: string;
  fix: "force_restart" | "retry";
  // the most telling line from the VM log, when the CLI output alone says nothing useful
  line?: string;
};

// Lima names the instance "colima" for the default profile and "colima-<name>" for others.
export const limaLogPath = (profile: string) => `~/.colima/_lima/${profile === "default" ? "colima" : `colima-${profile}`}/ha.stderr.log`;

const STALE = /ha\.pid|ha\.sock|vz\.pid|seems to be running|already running|essential requirement|"ssh"|fd_connect|did not receive an event/i;
const DOWNLOAD = /sha256|digest|checksum|error downloading/i;
const PORT = /address already in use|port is already allocated/i;
const MEMORY = /not enough memory|cannot allocate memory|insufficient memory/i;

const ERRORISH = /level=(error|fatal)|\berror\b|\bfailed\b/i;

export function explainStartFailure(cli: string, profile: string, log = ""): StartFailure {
  const text = `${cli}\n${log}`;
  if (STALE.test(text))
    return {
      kind: "stuck",
      title: "The VM is stuck from an earlier run",
      detail: "This usually happens after the Mac slept or restarted while Colima was running. Stopping it by force clears the old lock files; your containers and images stay.",
      fix: "force_restart",
    };
  if (DOWNLOAD.test(text))
    return { kind: "download", title: "The VM image didn't download fully", detail: "The file doesn't match what was expected. Check your network or VPN, then try again.", fix: "retry" };
  if (PORT.test(text))
    return { kind: "port", title: "A port Colima needs is taken", detail: "Another app (often an old Docker Desktop or Kubernetes) is using it. Quit that app, then try again.", fix: "retry" };
  if (MEMORY.test(text))
    return { kind: "memory", title: "The Mac doesn't have that much free memory", detail: "Close some apps, or give the VM less memory in Profiles.", fix: "retry" };
  const line = log.split("\n").filter((l) => ERRORISH.test(l)).pop();
  return { kind: "unknown", title: "Colima couldn't start the VM", detail: `The VM log is ${limaLogPath(profile)}. Copy the details if you ask for help.`, fix: "retry", line };
}

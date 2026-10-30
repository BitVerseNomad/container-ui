// A change that needs the VM to restart, from the Doctor or a home line: share a folder, restart so the VM follows
// the Mac's network, or give the VM the Mac's proxy. It runs through the same VM runner as the size change
// (src/Resize.tsx): confirm first, stop, start with the new setting, start again what ran. The app never edits
// ~/.colima: `colima start` saves its own file.
import { explainStartFailure } from "./startFailure.ts";
import { nameList } from "./vmSize.ts";

type Folder = { path: string; writable: boolean };
// before: what the profile had when the change was asked for. Colima saves the new list before it starts the VM, so
// after a failed start the new list stays saved; before is how the app starts the VM again the way it was.
// undo: this change is that way back (it has no way back of its own).
export type VmChange =
  | { kind: "mounts"; mounts: Folder[]; before: Folder[]; what: string; makeWritable: boolean; undo?: true }
  | { kind: "restart"; why: string }
  | { kind: "proxy"; env: [string, string][]; before: [string, string][]; summary: string; undo?: true };

// The change that puts the saved setting back, or null when there is nothing to put back.
const isUndo = (c: VmChange) => c.kind !== "restart" && !!c.undo;
export function undoOf(c: VmChange): VmChange | null {
  if (isUndo(c)) return null;
  if (c.kind === "mounts") return { ...c, mounts: c.before, before: c.mounts, makeWritable: false, undo: true };
  if (c.kind === "proxy") return { ...c, env: c.before, before: c.env, undo: true };
  return null;
}
export const undoLabel = (c: VmChange) => (c.kind === "mounts" ? "Start with the folders you had" : "Start with the settings you had");

// The backend command and its arguments. `restart` is Colima's own restart; the other two stop, then start with flags.
// running: false after a failed start left the VM stopped, so the retry only starts it.
export function changeCommand(c: VmChange, profile: string, running = true): { cmd: string; args: Record<string, unknown> } {
  // The way back (undo) stops by force first: a half-up VM after a failed start can swallow a plain start.
  const how = isUndo(c) ? { force: true } : running ? {} : { restart: false };
  if (c.kind === "mounts") return { cmd: "apply_mounts", args: { name: profile, mounts: c.mounts, ...how } };
  if (c.kind === "proxy") return { cmd: "apply_env", args: { name: profile, env: c.env, ...how } };
  return { cmd: "restart_profile", args: { name: profile } };
}

export const changeLabel = (c: VmChange) => (c.kind === "mounts" ? (c.makeWritable ? "Make it writable…" : "Share folder…") : c.kind === "proxy" ? "Use the proxy…" : "Restart the VM…");
// The confirm's button: what it does, since the VM restarts.
export const changeConfirmLabel = (c: VmChange) => (c.kind === "mounts" ? (c.makeWritable ? "Make writable and restart" : "Share and restart") : c.kind === "proxy" ? "Use the proxy and restart" : "Restart the VM");
const plain = (t: string) => t.split("`").join("");
export const changeBusy = "Restarting…";
export const changeHint = (c: VmChange) => (c.kind === "mounts" ? `Restarts the VM to share ${plain(c.what)}` : c.kind === "proxy" ? "Restarts the VM with the Mac's proxy" : "Restarts the VM");

const count = (n: number) => `${n} running container${n === 1 ? "" : "s"}`;
export const stopsLine = (running: number | null) =>
  running === null ? "Running containers stop and start again after (about a minute)." : running === 0 ? "Nothing is running, so nothing stops. It takes about a minute." : `Your ${count(running)} ${running === 1 ? "stops and starts" : "stop and start"} again after (about a minute).`;

export function changeConfirm(c: VmChange, running: number | null, kubeNote = ""): string {
  const stops = `${stopsLine(running)}${kubeNote ? ` ${kubeNote}` : ""}`;
  if (c.kind === "mounts")
    return [c.makeWritable ? `Let containers change files in \`${c.what}\`?` : `Share \`${c.what}\` with the VM?`, `The VM restarts to take the change. ${stops}`, "", c.makeWritable ? "Only that folder's setting changes. Images, volumes and containers stay." : "Only that folder is added to what is shared. Images, volumes and containers stay."].join("\n");
  if (c.kind === "proxy") return [`Give the VM the Mac's proxy (\`${c.summary}\`)?`, `The VM restarts to take it. ${stops}`, "", "Images, volumes and containers stay."].join("\n");
  return ["Restart the VM?", `It starts with the Mac's current network and name lookup. ${stops}`, "", "Images, volumes and containers stay."].join("\n");
}

export function changeProgress(c: VmChange, progress: "restarting" | "starting"): string {
  if (progress === "starting") return "Starting everything that was running…";
  return c.kind === "mounts" ? `Restarting the VM to share \`${c.what}\`… about a minute` : c.kind === "proxy" ? "Restarting the VM with the Mac's proxy… about a minute" : "Restarting the VM… about a minute";
}

// The line after: what changed, and that what ran runs again (the same words as the size change).
export function changeDone(c: VmChange, restarted: number, failed: number, extraOk: string[] = [], headOverride?: string): string {
  const own = c.kind === "mounts" ? (c.undo ? "The VM started with the folders it had." : c.makeWritable ? `\`${c.what}\` is writable in the VM now.` : `\`${c.what}\` is shared with the VM now.`) : c.kind === "proxy" ? (c.undo ? "The VM started with the settings it had." : "The VM has the Mac's proxy now.") : "The VM restarted.";
  const head = headOverride ?? own;
  const back = restarted - failed;
  const ran = !restarted || !back ? "" : failed ? "Everything else that was running is running again" : "Everything that was running is running again";
  const extra = extraOk.length ? `${nameList(extraOk)} started again` : "";
  const said = ran && extra ? `${ran}, and ${extra}` : ran || extra;
  return `${head}${said ? ` ${said}.` : ""}`;
}

// A restart or start that failed for a change: what failed in the change's own words (never "the new size"), then
// whether the new setting stayed saved. The VM is stopped after a failed start.
export function changeFail(c: VmChange, error: string, profile: string): string {
  if (/^Another VM operation/.test(error)) return error.split("\n")[0];
  const e = explainStartFailure(error, profile);
  const cause = e.kind === "unknown" ? "" : e.kind === "memory" ? " The Mac couldn't give the VM memory right now." : ` ${e.title}. ${e.detail}`;
  if (isUndo(c)) return `Colima couldn't start the VM the way it was.${cause} The VM is stopped.`;
  const head = c.kind === "mounts" ? `Colima couldn't start the VM with \`${c.what}\` ${c.makeWritable ? "writable" : "shared"}.` : c.kind === "proxy" ? "Colima couldn't start the VM with the Mac's proxy." : "Colima couldn't restart the VM.";
  const saved = c.kind === "mounts" ? ` \`${c.what}\` stays saved in the profile, so a plain start tries it again.` : c.kind === "proxy" ? " The proxy stays saved in the profile, so a plain start tries it again." : "";
  return `${head}${cause} The VM is stopped.${saved}`;
}

// Is the profile still saved with the list that failed? The way back applies only then: when the person fixed
// colima.yaml by hand or changed it in Profiles, going "back" would undo their edit. Mounts compare by expanded path
// and writable flag; the environment by name and value. Unknown (null) never matches.
export function stillFailed(c: VmChange, saved: { mounts: { location: string; writable: boolean }[] | null; env: Record<string, string> | null }, home: string): boolean {
  const expand = (p: string) => (p === "~" ? home : p.startsWith("~/") ? home + p.slice(1) : p).replace(/\/+$/, "") || "/";
  if (c.kind === "mounts") {
    // An empty saved list means the home folder, writable.
    const now = saved.mounts ? (saved.mounts.length ? saved.mounts.map((m) => `${expand(m.location)}:${m.writable}`) : [`${home}:true`]) : null;
    const failed = c.mounts.map((m) => `${expand(m.path)}:${m.writable}`);
    return !!now && now.length === failed.length && [...now].sort().join("\n") === [...failed].sort().join("\n");
  }
  if (c.kind === "proxy") {
    const now = saved.env ? Object.entries(saved.env).map(([k, v]) => `${k}=${v}`) : null;
    const failed = c.env.map(([k, v]) => `${k}=${v}`);
    return !!now && now.length === failed.length && [...now].sort().join("\n") === [...failed].sort().join("\n");
  }
  return false;
}
// The line on the stopped card while the way back is offered: what is still saved, and that a plain start tries it.
export const wayBackNote = (c: VmChange) => `The last change didn't start. ${c.kind === "mounts" ? `\`${c.what}\` is still saved in the profile` : "The Mac's proxy is still saved in the profile"}, so Start VM tries it again.`;

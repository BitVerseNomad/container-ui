// Opens a shell in a running container: bash when it has one, else sh. A minimal image (distroless, scratch) has
// neither, so it opens a throwaway busybox next to it instead, sharing its processes and network. SYS_PTRACE lets
// that busybox read the files of a process running as another user, under /proc/1/root.
import { invoke } from "@tauri-apps/api/core";
import { activity, dockerLine } from "./activity";

// Pinned, so the helper can't change under the app. The backend builds the same line.
const BUSYBOX = "busybox:1.36";

export const borrowedShell = (ctx: string, name: string) =>
  dockerLine(ctx, ["run", "--rm", "-it", "--pid", `container:${name}`, "--network", `container:${name}`, "--cap-add", "SYS_PTRACE", BUSYBOX, "sh"]);

// One probe at a time per container; a second click while Docker is slow does nothing.
const probing = new Set<string>();

export async function openShell(ctx: string, name: string): Promise<void> {
  const key = `${ctx}/${name}`;
  if (probing.has(key)) return;
  probing.add(key);
  try {
    const sh = await invoke<string>("container_shell", { context: ctx, name });
    if (sh === "none") {
      await activity.ran("debug", borrowedShell(ctx, name), () => invoke("open_terminal", { kind: "debug", context: ctx, target: name }), name);
      return;
    }
    await activity.ran("exec", dockerLine(ctx, ["exec", "-it", name, sh]), () => invoke("open_terminal", { kind: sh === "bash" ? "bash" : "shell", context: ctx, target: name }), name);
  } finally {
    probing.delete(key);
  }
}

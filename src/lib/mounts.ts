// Folder sharing between the Mac and the Colima VM, read from the profile and from `docker inspect`. Pure functions.
// Facts: Colima shares $HOME (writable) when `mounts` is empty, and exactly the listed folders when it is not
// (environment/vm/lima/yaml.go); it refuses overlapping mounts with a plain string-prefix test; `colima start
// --mount` replaces the whole list; mountType and vmType cannot change on an existing VM. Docker, for a bind
// mount whose source is missing, makes an empty folder there (docs.docker.com/engine/storage/bind-mounts), and in
// the VM a Mac folder that is not shared does not exist. See notes in the round 35 CHANGELOG entry.
import { UNREADABLE_MOUNTS } from "./colimaConfig.ts";
import type { ColimaConfig } from "./colimaConfig.ts";
import type { App } from "./apps.ts";
import type { VmChange } from "./vmChange.ts";

export type Share = { path: string; writable: boolean };

export const expand = (p: string, home: string) => (p === "~" ? home : p.startsWith("~/") ? home + p.slice(1) : p).replace(/\/+$/, "") || "/";
// "/Users/me/code/api" as "~/code/api"; other paths stay as they are.
export const tilde = (p: string, home: string) => (home && p === home ? "~" : home && p.startsWith(`${home}/`) ? `~${p.slice(home.length)}` : p);

// What the VM really shares: Colima's rule for an empty list is the home folder, writable. null: the list could not
// be read (flow style, a shape the app does not know), so nothing is said about what is shared.
export function sharesOf(cfg: Pick<ColimaConfig, "mounts">, home: string): Share[] | null {
  if (!cfg.mounts) return null;
  return cfg.mounts.length ? cfg.mounts.map((m) => ({ path: expand(m.location, home), writable: m.writable })) : [{ path: home, writable: true }];
}
export const covering = (path: string, shares: Share[]): Share | undefined =>
  shares.filter((s) => path === s.path || path.startsWith(`${s.path}/`)).sort((a, b) => b.path.length - a.path.length)[0];

// Mac folders a container can bind: the user's folders and external disks. Other paths (/tmp, /var/lib/docker,
// /etc) are inside the VM and mean the VM's own folder, so they are never "missing".
const MAC_ONLY = /^\/(Users|Volumes)\//;

export type BindUse = { app: string; source: string; dest: string; readOnly: boolean };
export function binds(apps: App[]): BindUse[] {
  return apps.filter((a) => a.running).flatMap((a) =>
    a.mounts.filter((m) => m.type === "bind" && MAC_ONLY.test(m.source)).map((m) => ({ app: a.name, source: m.source.replace(/\/+$/, ""), dest: m.dest, readOnly: !!m.spec?.endsWith(":ro") })),
  );
}
export const unshared = (uses: BindUse[], shares: Share[]) => uses.filter((u) => !covering(u.source, shares));
// The container writes (its own mount is not :ro) into a folder the VM shares read-only.
export const readOnlyWrites = (uses: BindUse[], shares: Share[]) => uses.filter((u) => !u.readOnly && covering(u.source, shares) && !covering(u.source, shares)!.writable);

// The container's own log says a write to this mount failed because the folder is read-only.
export const rofsFor = (log: string, dest: string) => !!dest && log.split("\n").some((l) => /read-only file system|EROFS/i.test(l) && l.includes(dest));

// The same rules the backend applies, so the page never offers a change the backend would refuse. Absolute, plain,
// no comma or quote (Colima reads the flag as CSV), not a system folder, and under the home folder not hidden and not
// ~/Library (keychains, app data).
const SYSTEM = /^\/(System|usr|bin|sbin|etc|var|Library|Applications|cores|dev|private\/etc|private\/var)(\/|$)/;
export function mountOk(path: string, home: string): boolean {
  if (!home || !path.startsWith("/") || /[,":\x00-\x1f]|\/\.\.?(\/|$)|\/\//.test(path) || path === "/" || SYSTEM.test(path)) return false;
  if (path === home) return true;
  if (path.startsWith("/Users/") && !path.startsWith(`${home}/`)) return false;
  if (path.startsWith(`${home}/`)) {
    const rest = path.slice(home.length + 1).split("/");
    return !rest[0].toLowerCase().startsWith("library") && rest.every((c) => c !== "" && !c.startsWith("."));
  }
  return path.split("/").length >= 3;
}
// Colima's own overlap test: one path is the start of the other.
export const overlaps = (list: string[]) => list.some((a, i) => list.slice(i + 1).some((b) => a.startsWith(b) || b.startsWith(a)));

export type Plan = { change: VmChange } | { why: string };
// The full list after adding `path` (or making a shared folder writable), as `colima start --mount` takes it. null
// `why`: what stops the app from doing it, in a sentence.
export function mountPlan(cfg: ColimaConfig, home: string, path: string, writable: boolean): Plan {
  if (!cfg.mounts) return { why: UNREADABLE_MOUNTS };
  if (cfg.mounts.some((m) => m.mountPoint && m.mountPoint !== m.location)) return { why: "One of your shared folders uses a different path inside the VM, which the app can't carry over." };
  const now = sharesOf(cfg, home)!;
  const hit = now.find((s) => s.path === path);
  const next: Share[] = hit ? now.map((s) => (s === hit ? { ...s, writable: s.writable || writable } : s)) : [...now, { path, writable }];
  if (!next.every((s) => mountOk(s.path, home))) return { why: "That folder can't be shared from here (hidden folders, ~/Library and system folders never are)." };
  if (overlaps(next.map((s) => s.path))) return { why: "Colima can't share two folders when one name starts like the other." };
  return { change: { kind: "mounts", mounts: next, before: now, what: tilde(path, home), makeWritable: !!hit } };
}

// virtiofs is the fast one and exists with the vz VM type; it is fixed when the VM is created.
export const slowMountType = (cfg: Pick<ColimaConfig, "vmType" | "mountType">) => cfg.vmType === "vz" && (cfg.mountType === "sshfs" || cfg.mountType === "9p");

// What "Bring them over" offers: Docker Desktop's volumes and images, each marked if Colima already has it.
// Volumes are picked by default (databases live there and can't be downloaded again); images are not,
// because Colima pulls them again on the next `docker compose up`.
import { parseBytes } from "../containerInfo.ts";
import { parseVolumeSizes } from "./events.ts";
import { isAnonymous } from "./volumes.ts";

export type Kind = "volume" | "image";
// colimaBytes: the size of Colima's own volume of that name, so a nearly empty one can be pointed out.
// users: containers running in Docker Desktop that write to this volume.
export type Item = { kind: Kind; name: string; bytes: number; inColima: boolean; colimaBytes?: number; users: string[] };
export type Inventory = { items: Item[]; unnamed: number };

type ImageRow = { Repository?: string; Tag?: string; Size?: string };
type PsRow = { Names?: string; Mounts?: string };

const jsonLines = <T,>(out: string): T[] => out.split("\n").filter((l) => l.trim()).flatMap((l) => { try { return [JSON.parse(l) as T]; } catch { return []; } });

type Lists = { desktopDf: string; desktopImages: string; desktopRunning?: string; colimaDf: string; colimaImages: string[] };

// Docker Desktop's `system df -v`, `images` and running `ps` (all --format json), and Colima's `system df -v`
// plus its image names. What Colima already has is never copied over.
export function inventory({ desktopDf, desktopImages, desktopRunning = "", colimaDf, colimaImages }: Lists): Inventory {
  const sizes = parseVolumeSizes(desktopDf);
  const here = parseVolumeSizes(colimaDf);
  const running = jsonLines<PsRow>(desktopRunning);
  const users = (v: string) => running.filter((c) => (c.Mounts ?? "").split(",").includes(v)).map((c) => c.Names ?? "").filter(Boolean);
  const names = [...sizes.keys()];
  const vols: Item[] = names
    .filter((n) => !isAnonymous(n))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ kind: "volume", name, bytes: sizes.get(name) ?? 0, inColima: here.has(name), colimaBytes: here.get(name), users: users(name) }));
  const have = new Set(colimaImages);
  // Only tagged images: `docker save repo` would mean repo:latest, which may be a different image.
  const imgs: Item[] = jsonLines<ImageRow>(desktopImages)
    .filter((r) => r.Repository && r.Repository !== "<none>" && r.Tag && r.Tag !== "<none>")
    .map((r) => ({ kind: "image" as const, name: `${r.Repository}:${r.Tag}`, bytes: parseBytes(r.Size ?? ""), inColima: have.has(`${r.Repository}:${r.Tag}`), users: [] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { items: [...vols, ...imgs], unnamed: names.length - vols.length };
}

// Colima's volume of the same name is much smaller, like the empty one a first `compose up` makes.
// A fresh Postgres folder is already about 40 MB, so "smaller by half" catches it and a tenth would not.
export const nearlyEmpty = (i: Item) => i.inColima && i.colimaBytes !== undefined && i.bytes > 1e6 && i.colimaBytes < i.bytes / 2;

// Room to spare after the copy, so the VM isn't left with a full disk the moment it is done.
const SPARE = 2 * 1024 ** 3;
// free: the VM's disk minus what Docker uses, an estimate. Unknown means don't block on a guess.
export const fits = (need: number, free: number | null) => free === null || need + SPARE <= free;

export const key = (i: Pick<Item, "kind" | "name">) => `${i.kind}:${i.name}`;

export const defaultPick = (items: Item[]) => new Set(items.filter((i) => i.kind === "volume" && !i.inColima).map(key));

export const picked = (items: Item[], pick: Set<string>) => items.filter((i) => !i.inColima && pick.has(key(i)));

// Volumes first: if the user stops halfway, the data that can't be downloaded again is already across.
export const order = (items: Item[]) => [...items.filter((i) => i.kind === "volume"), ...items.filter((i) => i.kind === "image")];

// Containers the copy stops in Docker Desktop, once each, so the confirm can name them.
export const toStop = (items: Item[]) => [...new Set(items.flatMap((i) => i.users))];

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function whatText(items: Item[]): string {
  const v = items.filter((i) => i.kind === "volume").length;
  const m = items.length - v;
  return [v && count(v, "volume"), m && count(m, "image")].filter(Boolean).join(" and ");
}

// Docker's own words for the failures people hit, said as what to do.
export function plainError(why: string): string {
  if (/no space left on device/i.test(why)) return "Colima's disk is full. Give the VM a bigger disk in Profiles.";
  return why.split("\n")[0];
}
export const diskFull = (why: string) => /no space left on device/i.test(why);

export type Outcome = { item: Item; ok: true; bytes: number } | { item: Item; ok: false; why: string };

// The one line after the run. Docker Desktop's copy is mentioned because people worry the move deleted it.
export function doneText(outcomes: Outcome[], stopped: boolean): string {
  const ok = outcomes.filter((o) => o.ok).map((o) => o.item);
  const failed = outcomes.filter((o) => !o.ok).map((o) => `\`${o.item.name}\``);
  const moved = ok.length ? `${whatText(ok)} ${ok.length === 1 ? "is" : "are"} in Colima now.` : "Nothing was copied.";
  const tail = [stopped && "You stopped the rest.", failed.length && `${failed.join(" and ")} didn't copy.`].filter(Boolean).join(" ");
  return `${moved}${tail ? ` ${tail}` : ""} Docker Desktop still has its copy.`;
}

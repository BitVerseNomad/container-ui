// What "Bring them over" offers: Docker Desktop's volumes and images, each marked if Colima already has it.
// Volumes are picked by default (databases live there and can't be downloaded again); images are not,
// because Colima pulls them again on the next `docker compose up`.
import { formatBytes, parseBytes } from "../containerInfo.ts";
import { parseVolumeSizes } from "./events.ts";
import { isAnonymous } from "./volumes.ts";

export type Kind = "volume" | "image";
// colimaBytes: the size of Colima's own volume of that name, so a nearly empty one can be pointed out.
// users: containers running in Docker Desktop that write to this volume. colimaUsers: the same in Colima, for a
// volume whose Colima copy is replaced (running, paused or restarting; a stopped one is left as it is).
// colimaPlain: Colima's volume of that name is confirmed a plain one Docker keeps in the VM (driver local, no
// options); only then may it ever be replaced. colimaWhy says why not, when known: "folder" (a bind to the Mac) or
// the driver's name. colimaBytes is left out when Colima's size can't be read, and then it is never "nearly empty".
// colimaPath: for a folder on the Mac, the folder (the volume's device option), when inspect names one.
export type Item = { kind: Kind; name: string; bytes: number; inColima: boolean; colimaBytes?: number; colimaPlain?: boolean; colimaWhy?: string; colimaPath?: string; users: string[]; colimaUsers?: string[] };
export type Inventory = { items: Item[]; unnamed: number };

type ImageRow = { Repository?: string; Tag?: string; Size?: string };
type PsRow = { Names?: string; Mounts?: string; State?: string };

const jsonLines = <T,>(out: string): T[] => out.split("\n").filter((l) => l.trim()).flatMap((l) => { try { return [JSON.parse(l) as T]; } catch { return []; } });

// colimaInspect: `docker inspect --type volume` of Colima's volumes that Docker Desktop also has (a JSON array).
type Lists = { desktopDf: string; desktopImages: string; desktopRunning?: string; colimaDf: string; colimaPs?: string; colimaInspect?: string; colimaImages: string[] };

// What `inspect` says of each Colima volume: plain, or why not. Missing from the answer means not known.
type Kind2 = { plain: boolean; why?: string; path?: string };
function volumeKinds(json: string | undefined): Map<string, Kind2> {
  const out = new Map<string, Kind2>();
  try {
    for (const v of JSON.parse(json ?? "") as { Name?: string; Driver?: string; Options?: Record<string, unknown> | null }[]) {
      if (!v?.Name) continue;
      const options = v.Options && typeof v.Options === "object" ? Object.keys(v.Options).length : 0;
      // Colima mounts the Mac's /Users at the same path in the VM, so a device there is that folder on the Mac.
      const device = typeof v.Options?.device === "string" && v.Options.device.startsWith("/Users/") ? v.Options.device : undefined;
      out.set(v.Name, v.Driver !== "local" ? { plain: false, why: v.Driver || undefined } : options ? { plain: false, why: "folder", path: device } : { plain: true });
    }
  } catch {
    /* not known: nothing is plain */
  }
  return out;
}

// Colima's sizes, leaving out one that isn't a number ("N/A" for a volume Docker can't measure).
function knownSizes(json: string): Map<string, number> {
  const sizes = parseVolumeSizes(json);
  try {
    const d = JSON.parse(json);
    const rows: { Name?: string; Size?: string | number }[] = Array.isArray(d) ? d : d?.Volumes ?? [];
    for (const v of rows) if (v?.Name && typeof v.Size !== "number" && !/^[\d.]+\s*[A-Za-z]+$/.test(String(v.Size ?? "").trim())) sizes.delete(v.Name);
  } catch {
    /* parseVolumeSizes already found nothing */
  }
  return sizes;
}

// Docker Desktop's `system df -v`, `images` and running `ps` (all --format json), and Colima's `system df -v`
// plus its `ps -a` and image names. What Colima already has is never copied over, except a nearly empty volume.
export function inventory({ desktopDf, desktopImages, desktopRunning = "", colimaDf, colimaPs = "", colimaInspect, colimaImages }: Lists): Inventory {
  const sizes = parseVolumeSizes(desktopDf);
  const listed = parseVolumeSizes(colimaDf);
  const here = knownSizes(colimaDf);
  const kinds = volumeKinds(colimaInspect);
  const running = jsonLines<PsRow>(desktopRunning);
  const mounting = (rows: PsRow[], v: string) => rows.filter((c) => (c.Mounts ?? "").split(",").includes(v)).map((c) => c.Names ?? "").filter(Boolean);
  const users = (v: string) => mounting(running, v);
  const live = jsonLines<PsRow>(colimaPs).filter((c) => !["exited", "created", "dead"].includes(c.State ?? ""));
  const names = [...sizes.keys()];
  const vols: Item[] = names
    .filter((n) => !isAnonymous(n))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ kind: "volume", name, bytes: sizes.get(name) ?? 0, inColima: listed.has(name), colimaBytes: here.get(name), colimaPlain: kinds.get(name)?.plain === true, colimaWhy: kinds.get(name)?.why, colimaPath: kinds.get(name)?.path, users: users(name), colimaUsers: mounting(live, name) }));
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
// Only a plain volume: a folder on the Mac (a bind volume) is the user's own files, whatever its size says.
export const nearlyEmpty = (i: Item) => i.inColima && i.colimaPlain === true && i.colimaBytes !== undefined && i.bytes > 1e6 && i.colimaBytes < i.bytes / 2;

// Room to spare after the copy, so the VM isn't left with a full disk the moment it is done.
const SPARE = 2 * 1024 ** 3;
// free: the VM's disk minus what Docker uses, an estimate. Unknown means don't block on a guess.
export const fits = (need: number, free: number | null) => free === null || need + SPARE <= free;

export const key = (i: Pick<Item, "kind" | "name">) => `${i.kind}:${i.name}`;

// The nearly empty Colima copy can be replaced: it is backed up first, so nothing is lost if that was wrong.
export const replaceable = (i: Item) => i.kind === "volume" && nearlyEmpty(i);

export const replaceLabel = (i: Item) => `Replace Colima's copy (${formatBytes(i.colimaBytes ?? 0)}) with Docker Desktop's (${formatBytes(i.bytes)})`;

// Colima's copy looks freshly made: an empty Postgres folder is about 40 MB, and nothing real has been written yet.
// Size alone is the rule: reading file times would mean another helper run per volume for a small gain.
const FRESH = 64 * 1024 ** 2;
// An unknown size is not fresh.
const fresh = (i: Item) => i.colimaBytes !== undefined && i.colimaBytes < FRESH;

// A replace row's size column. Ticked: what comes in and what goes; unticked: only what Colima has now.
export const replaceSize = (i: Item, ticked: boolean) => (ticked ? `${formatBytes(i.bytes)} · replaces ${formatBytes(i.colimaBytes ?? 0)}` : `Colima has ${formatBytes(i.colimaBytes ?? 0)}`);

// An unticked replace row: a copy bigger than a fresh one may hold work done in Colima since.
export const unpickedNote = (i: Item) =>
  fresh(i)
    ? `Pick it to replace Colima's nearly empty copy with Docker Desktop's ${formatBytes(i.bytes)}; Colima's is backed up first.`
    : `Colima's copy has data, maybe newer than Docker Desktop's. Pick it to replace it with Docker Desktop's ${formatBytes(i.bytes)}; Colima's is backed up first.`;

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const BACKUP = /^(.+)-colima-backup-(\d{4})(\d{2})(\d{2})-\d{4}$/;
// A backup volume this app made (backupName), read back for the Volumes screen. Null for any other name.
export function backupOf(volume: string): string | null {
  const m = BACKUP.exec(volume);
  const month = m ? MONTHS[Number(m[3]) - 1] : undefined;
  return m && month && Number(m[4]) >= 1 && Number(m[4]) <= 31 ? `Backup from bringing over ${m[1]}, ${month} ${Number(m[4])}` : null;
}

// A fresh copy is picked by default (the backup makes a wrong guess cheap); a bigger one is listed for the user to pick.
export const defaultPick = (items: Item[]) => new Set(items.filter((i) => i.kind === "volume" && (!i.inColima || (replaceable(i) && fresh(i)))).map(key));

export const picked = (items: Item[], pick: Set<string>) => items.filter((i) => (!i.inColima || replaceable(i)) && pick.has(key(i)));

// Local time, to the minute, so the name reads as when it was made: shop_db-colima-backup-20261029-1912.
export function backupName(name: string, d: Date): string {
  const two = (n: number) => String(n).padStart(2, "0");
  return `${name}-colima-backup-${d.getFullYear()}${two(d.getMonth() + 1)}${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
}

// Volumes first: if the user stops halfway, the data that can't be downloaded again is already across.
export const order = (items: Item[]) => [...items.filter((i) => i.kind === "volume"), ...items.filter((i) => i.kind === "image")];

// Containers the copy stops in Docker Desktop, once each, so the confirm can name them.
export const toStop = (items: Item[]) => [...new Set(items.flatMap((i) => i.users))];
// Containers the copy stops in Colima, for volumes whose Colima copy is replaced. They start again after on their own.
export const toStopColima = (items: Item[]) => [...new Set(items.filter(replaceable).flatMap((i) => i.colimaUsers ?? []))];

// The confirm before a run that stops containers or replaces a Colima volume. Names in `backticks`, in the code font.
export function stopQuestion(desktop: string[], colima: string[], replaces: { item: Item; backup: string }[]): string {
  const join = (n: string[]) => n.map((x) => `\`${x}\``).join(" and ");
  const it = (n: string[]) => (n.length === 1 ? "it" : "them");
  const sides = [
    desktop.length ? `${join(desktop)} in Docker Desktop. You can start ${it(desktop)} again from here after.` : "",
    colima.length ? `${join(colima)} in Colima. ${n1(colima) ? "It starts" : "They start"} again on ${n1(colima) ? "its" : "their"} own after.` : "",
  ].filter(Boolean);
  const replacing = replaces.map(({ item, backup }) => `Colima's \`${item.name}\` (${formatBytes(item.colimaBytes ?? 0)}) is replaced. It's kept as \`${backup}\` first.`);
  const why = "They write to the volumes being copied, and a database copied while it runs may not start.";
  if (!sides.length) return [`Replace Colima's ${join(replaces.map((r) => r.item.name))}?`, ...replacing].join("\n");
  // The first ". " ends the who-and-where part; a name can hold a dot, but never a dot and a space.
  const cut = (l: string) => l.indexOf(". ");
  const title = sides.length === 2 ? "Stop these for a clean copy?" : `Stop ${sides[0].slice(0, cut(sides[0]))}?`;
  const body = sides.length === 2 ? sides.map((l) => `• ${l}`) : [sides[0].slice(cut(sides[0]) + 2)];
  return [title, ...body, ...replacing, why].join("\n");
}
const n1 = (n: string[]) => n.length === 1;
// The confirm when a pick was dropped just before it (dropped: one notice per dropped volume). It names what will
// come over, says who stops first, and puts the dropped ones last as notices ("! " lines). They stay in the confirm,
// not an alert: the dialog takes focus and a screen reader would cut an alert said at the same moment.
export function bringQuestion(todo: Item[], desktop: string[], colima: string[], replaces: { item: Item; backup: string }[], dropped: string[]): string {
  const join = (n: string[]) => n.map((x) => `\`${x}\``).join(" and ");
  const it = (n: string[]) => (n1(n) ? "it" : "them");
  const title = todo.length <= 2 ? `Bring ${join(todo.map((i) => i.name))} over?` : `Bring ${whatText(todo)} over?`;
  return [
    title,
    desktop.length ? `${join(desktop)} in Docker Desktop ${n1(desktop) ? "is" : "are"} stopped first, so the copy is clean. You can start ${it(desktop)} again from here after.` : "",
    colima.length ? `${join(colima)} in Colima ${n1(colima) ? "is" : "are"} stopped first and ${n1(colima) ? "starts" : "start"} again on ${n1(colima) ? "its" : "their"} own after.` : "",
    ...replaces.map(({ item, backup }) => `Colima's \`${item.name}\` (${formatBytes(item.colimaBytes ?? 0)}) is replaced. It's kept as \`${backup}\` first.`),
    ...dropped.map((d) => `! ${d}`),
  ].filter(Boolean).join("\n");
}

// The one note under a replace row: the backup, then who stops where (a name on both sides is said once).
export function replaceNote(i: Item): string {
  const ticks = (n: string[]) => n.map((x) => `\`${x}\``).join(" and ");
  const d = i.users;
  const c = i.colimaUsers ?? [];
  const both = d.length > 0 && d.length === c.length && d.every((n) => c.includes(n));
  const who = both ? `${ticks(d)} ${n1(d) ? "stops" : "stop"} on both sides; the Colima one${n1(d) ? "" : "s"} ${n1(d) ? "starts" : "start"} again after.`
    : [d.length && `${ticks(d)} ${n1(d) ? "stops" : "stop"} in Docker Desktop.`, c.length && `${ticks(c)} ${n1(c) ? "stops" : "stop"} in Colima and ${n1(c) ? "starts" : "start"} again after.`].filter(Boolean).join(" ");
  return `Colima's copy is backed up first.${who ? ` ${who}` : ""}`;
}

const count = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function whatText(items: Item[]): string {
  const v = items.filter((i) => i.kind === "volume").length;
  const m = items.length - v;
  return [v && count(v, "volume"), m && count(m, "image")].filter(Boolean).join(" and ");
}

// Docker's own words for the failures people hit, said as what to do.
export function plainError(why: string): string {
  if (/no space left on device/i.test(why)) return "Colima's disk is full. Give the VM a bigger disk in Profiles.";
  if (writeError(why)) return "Colima's disk had a write error partway through.";
  return why.split("\n")[0];
}
export const diskFull = (why: string) => /no space left on device/i.test(why);
// The VM's disk failed a write; restarting the VM is the first thing to try.
export const writeError = (why: string) => /input\/output error/i.test(why);

// replaced: set when Colima's own copy was replaced. colima says what became of it: replaced (the backup holds the
// old one), unchanged (it failed before anything changed), restored (put back from the backup), in-backup (only there).
export type Replaced = { colima: "replaced" | "unchanged" | "restored" | "in-backup"; backup: string };
export type Outcome = { item: Item; ok: true; bytes: number; replaced?: Replaced } | { item: Item; ok: false; why: string; replaced?: Replaced };

const tick = (s: string) => `\`${s}\``;
function replacedText(o: Outcome): string {
  const r = o.replaced!;
  const n = tick(o.item.name);
  if (o.ok) return `${n} replaced Colima's nearly empty copy. The old one is in ${tick(r.backup)}; remove it in Volumes once you've checked.`;
  if (r.colima === "unchanged") return `${n} wasn't replaced. Colima's copy wasn't changed.`;
  if (r.colima === "restored") return `${n} wasn't replaced. Colima's copy is back as it was (also saved as ${tick(r.backup)}).`;
  return `${n} wasn't replaced, and putting Colima's copy back failed. It is safe in ${tick(r.backup)}.`;
}

// The lines after the run, one fact each. A failed replace leads: whether Colima's copy is safe is the first question.
// untried: picked but not reached (the run stops after a failed replace), so they are not "nothing was copied".
// restarted: Colima containers a replace stopped and started again on its own.
export function doneLines(outcomes: Outcome[], stopped: boolean, untried: Item[] = [], restarted: string[] = []): string[] {
  const ok = outcomes.filter((o) => o.ok).map((o) => o.item);
  const failed = outcomes.filter((o) => !o.ok && !o.replaced).map((o) => tick(o.item.name));
  const badReplace = outcomes.filter((o) => !o.ok && o.replaced).map(replacedText);
  const nothing = !outcomes.length && !untried.length;
  return [
    ...badReplace,
    ok.length ? `${whatText(ok)} ${ok.length === 1 ? "is" : "are"} in Colima now.` : nothing ? "Nothing was copied." : "",
    ...outcomes.filter((o) => o.ok && o.replaced).map(replacedText),
    stopped ? "You stopped the rest." : "",
    failed.length ? `${failed.join(" and ")} didn't copy.` : "",
    untried.length ? `${untried.map((i) => tick(i.name)).join(" and ")} ${untried.length === 1 ? "wasn't" : "weren't"} copied yet.` : "",
    restarted.length ? `${restarted.map(tick).join(" and ")} ${restarted.length === 1 ? "is" : "are"} running again in Colima.` : "",
  ].filter(Boolean);
}

// What is still not in Colima: the volumes the panel picks by default (missing, or a freshly made empty copy).
// The offer on home and Doctor rests on this, so a partial copy or a restored replace keeps offering the rest.
export const stillToBring = (items: Item[]) => { const want = defaultPick(items); return items.filter((i) => want.has(key(i))); };

// A Colima volume that a first `compose up` made empty while Docker Desktop holds the data, with the Colima
// containers on it (any state: a stopped database is still the one that comes up empty). colimaPs: `ps -a` JSON.
export type Gap = { name: string; here: number; there: number; users: string[] };
export function homeGaps(items: Item[], colimaPs: string): Gap[] {
  const rows = jsonLines<PsRow>(colimaPs);
  return items
    .filter((i) => replaceable(i) && fresh(i))
    .map((i) => ({ name: i.name, here: i.colimaBytes ?? 0, there: i.bytes, users: rows.filter((c) => (c.Mounts ?? "").split(",").includes(i.name)).map((c) => c.Names ?? "").filter(Boolean) }))
    .filter((g) => g.users.length > 0);
}
export const gapLine = (g: Gap) => `\`${g.name}\` is nearly empty here; Docker Desktop has ${formatBytes(g.there)}.`;

// The pick for a "Bring it over…" that names volumes (home's line, Doctor's warning), from the panel's fresh read:
// each named volume only while it is still a fresh empty copy (or missing). If Colima's copy filled up since the line
// was read, replacing it could lose that data, so it isn't picked and its row says what it holds now.
export function pickOnly(items: Item[], only: string[]): { pick: Set<string>; stale: Map<string, string> } {
  const pick = new Set<string>();
  const stale = new Map<string, string>();
  const want = defaultPick(items);
  for (const i of items.filter((x) => x.kind === "volume" && only.includes(x.name))) {
    if (want.has(key(i))) pick.add(key(i));
    else if (i.inColima) stale.set(i.name, staleText(i));
  }
  return { pick, stale };
}

// Why a Colima volume of the same name is never replaced, under its row: a folder on the Mac, or another driver.
// Docker Desktop's copy is untouched either way, so the note says where that data stays.
const tilde = (p: string) => p.replace(/^\/Users\/[^/]+/, "~");
export const folderNote = (i: Item) => {
  if (!i.inColima || i.colimaPlain || !i.colimaWhy) return null;
  const kept = ` Docker Desktop's ${formatBytes(i.bytes)} stays there.`;
  return i.colimaWhy === "folder" ? `Colima's \`${i.name}\` is a folder on your Mac${i.colimaPath ? ` (${tilde(i.colimaPath)})` : ""}, so it isn't replaced.${kept}`
    : `Colima's \`${i.name}\` uses the ${i.colimaWhy} driver, so it isn't replaced.${kept}`;
};

// Named volumes both sides have: the ones whose Colima copy could be replaced, so the ones to inspect.
export function sharedVolumes(desktopDf: string, colimaDf: string): string[] {
  const here = parseVolumeSizes(colimaDf);
  return [...parseVolumeSizes(desktopDf).keys()].filter((n) => !isAnonymous(n) && here.has(n));
}

// Why a volume that was picked as nearly empty no longer is, in the words its row and the result use.
const staleText = (i: Item) => folderNote(i) ?? `Colima's \`${i.name}\` grew to ${formatBytes(i.colimaBytes ?? 0)} since we checked, so it isn't replaced.`;

// Just before the confirm, the picks with both sizes read again (now: a fresh inventory), so the confirm's words
// and the size the backend checks match what is there. A replace that no longer qualifies is dropped, with why.
// late: the same, said for the moment of the click ("while you were picking"), for the footer when nothing is left.
// notice: the same, for the confirm when other picks remain ("`shop_db` isn't replaced: …").
export function refreshed(todo: Item[], now: Item[]): { todo: Item[]; stale: Map<string, string>; late: string[]; notice: string[] } {
  const stale = new Map<string, string>();
  const late: string[] = [];
  const notice: string[] = [];
  const out: Item[] = [];
  for (const i of todo) {
    if (!replaceable(i)) { out.push(i); continue; }
    const n = now.find((x) => x.kind === "volume" && x.name === i.name);
    if (n && replaceable(n)) { out.push({ ...i, bytes: n.bytes, colimaBytes: n.colimaBytes }); continue; }
    stale.set(i.name, n ? staleText(n) : `Colima's \`${i.name}\` changed since we checked, so it isn't replaced.`);
    late.push(n && !folderNote(n) && n.colimaBytes !== undefined ? `Colima's \`${i.name}\` grew to ${formatBytes(n.colimaBytes)} while you were picking.` : n && folderNote(n) ? folderNote(n)! : `Colima's \`${i.name}\` changed while you were picking.`);
    const why = !n ? "changed since we checked" : n.colimaWhy === "folder" ? "is a folder on your Mac" : n.colimaWhy ? `uses the ${n.colimaWhy} driver` : n.colimaBytes !== undefined ? `grew to ${formatBytes(n.colimaBytes)} since we checked` : "changed since we checked";
    notice.push(`\`${i.name}\` isn't replaced: Colima's copy ${why}.`);
  }
  return { todo: out, stale, late, notice };
}
export const lateLine = (late: string[]) => `Nothing was replaced. ${late.join(" ")}`;

import { memWords } from "./health.ts";
import type { Apply } from "./health.ts";
// One service's memory limit and what it depends on, from `docker compose config --format json` (overrides merged,
// every profile). Compose writes the limit as bytes ("268435456"), but a value as typed ("256m", "1g") is read too.
// limit 0: the file sets none. project: the Compose project's name (its `name`), so another project's db isn't read.
export type ServiceFacts = { limit: number; project: string; dependsOn: { service: string; completed: boolean }[] };

// Bytes with no unit; k, m, g, t, p with an optional i and b ("512m", "1GiB", "2tb"), each a power of 1024 as Docker reads them.
const MEM = /^(\d+(\.\d+)?)\s*([kmgtp])?i?b?$/i;
const POWER: Record<string, number> = { k: 1, m: 2, g: 3, t: 4, p: 5 };
export function parseMem(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : null;
  if (typeof v !== "string") return null;
  const m = MEM.exec(v.trim());
  return m ? Math.round(Number(m[1]) * 1024 ** (m[3] ? POWER[m[3].toLowerCase()] : 0)) : null;
}

type Service = { mem_limit?: unknown; deploy?: { resources?: { limits?: { memory?: unknown } } }; depends_on?: Record<string, { condition?: string }> | string[] };
export function serviceFacts(json: string, service: string): ServiceFacts | null {
  let svc: Service | undefined;
  let project = "";
  try {
    const cfg = JSON.parse(json) as { name?: unknown; services?: Record<string, Service> };
    svc = cfg.services?.[service];
    project = typeof cfg.name === "string" ? cfg.name : "";
  } catch { return null; }
  if (!svc) return null;
  // mem_limit wins when both are set, as Compose does.
  const raw = svc.mem_limit ?? svc.deploy?.resources?.limits?.memory;
  const limit = raw === undefined ? 0 : parseMem(raw);
  if (limit === null) return null;
  const deps = Array.isArray(svc.depends_on) ? svc.depends_on.map((s) => [s, {}] as const) : Object.entries(svc.depends_on ?? {});
  return { limit, project, dependsOn: deps.map(([s, d]) => ({ service: s, completed: (d as { condition?: string }).condition === "service_completed_successfully" })) };
}

// The services it depends on that aren't ready: not running, or a job that hasn't finished with exit 0.
// ps: `docker ps -a` rows ({ State, Status, Labels }); only a row of this project (by its name label) counts, so a
// db of another project in the same folder tree is never taken for this one's.
const label = (key: string, value: string) => new RegExp(`(^|,)com\\.docker\\.compose\\.${key}=${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(,|$)`);
export function notReady(deps: ServiceFacts["dependsOn"], ps: { State: string; Status?: string; Labels?: string }[], project: string): string[] {
  const mine = project ? ps.filter((c) => label("project", project).test(c.Labels ?? "")) : ps;
  const of = (svc: string) => mine.find((c) => label("service", svc).test(c.Labels ?? ""));
  return deps.filter((d) => {
    const c = of(d.service);
    if (!c) return true;
    return d.completed ? !(c.State === "exited" && /^Exited \(0\)/.test(c.Status ?? "")) && c.State !== "running" : c.State !== "running";
  }).map((d) => d.service);
}

// What the limit line says once the file was read again. now: the limit the file sets now (0 = none).
const lead = (where: string) => (where.startsWith("`") ? where : `${where[0].toUpperCase()}${where.slice(1)}`);
const plural = (where: string) => !where.startsWith("`");
export const raisedText = (a: Apply, now: number) => (now === 0
  ? `${lead(a.where)} no longer ${plural(a.where) ? "limit" : "limits"} ${a.service}'s memory.`
  : `${lead(a.where)} now ${plural(a.where) ? "set" : "sets"} ${memWords(now)} for ${a.service}.`);
// The visible line once the file was raised: the new value with the old one after it, then the one step left. Home
// puts "report-job · " before it (and starts "its" in lowercase); Doctor and the container page show it as it is.
export function raisedLine(a: Apply, now: number, waiting: string[] = [], project = "") {
  const changed = now === 0
    ? `Its memory limit is no longer set in ${a.where} (was ${memWords(a.limit)}).`
    : `Its limit in ${a.where} is now ${memWords(now)} (was ${memWords(a.limit)}).`;
  return `${changed} ${waiting.length ? `Start ${project} first: ${a.service} needs ${waiting.join(" and ")}.` : "Apply it to start."}`;
}

// What the polite region says when a limit line's button changes under the user (home and Doctor say the same).
// raised: what the file says now; label: the button now; changed: whether the button itself changed.
export function flipSaid(a: Apply, raised: boolean, now: number, label: string, changed: boolean) {
  const said = (raised ? raisedText(a, now) : `${lead(a.where)} ${plural(a.where) ? "set" : "sets"} ${memWords(a.limit)} for ${a.service} again.`).replace(/`/g, "");
  return `${said} ${changed ? `The button is now ${label}.` : `${label} runs it now.`}`;
}
export const stillText = (a: Apply) => `${lead(a.where)} still ${plural(a.where) ? "set" : "sets"} ${memWords(a.limit)} for ${a.service}. Raise it, then press Apply and start.`;
// raised: the file now allows more than the run that was killed (or no limit at all).
export const limitRaised = (a: Apply, now: number) => now === 0 || now > a.limit;

// What the page says when Open didn't open the file. The backend answers STILL_OPENING (open was still going at its
// deadline: a status, not a failure), OPEN_FAILED:<the app it tried>\n<macOS's reason, maybe empty> (then Show in
// Finder is the way out), or a refusal of the path (said as it is; Finder would refuse it too).
const lowerFirst = (t: string) => (/^[A-Z][a-z]/.test(t) ? t[0].toLowerCase() + t.slice(1) : t);
export function openFailure(file: string, e: string): { text: string; still: boolean; finder: boolean } {
  if (e === "STILL_OPENING") return { text: `Still opening \`${file}\`…`, still: true, finder: false };
  if (e.startsWith("OPEN_FAILED:")) {
    const [app, reason = ""] = e.slice("OPEN_FAILED:".length).split("\n");
    return { text: `Couldn't open \`${file}\` in ${app.trim() || "an editor"}${reason.trim() ? `: ${lowerFirst(reason.trim())}` : ""}. Open it from Finder.`, still: false, finder: true };
  }
  return { text: `Couldn't open \`${file}\`. ${e}`, still: false, finder: false };
}

// Said in the line, before any click, when Open will use TextEdit (its smart quotes break YAML).
export const TEXTEDIT_HINT = "It opens in TextEdit: turn off Edit > Substitutions > Smart Quotes before you type.";

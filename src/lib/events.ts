// The activity timeline (docker events) and a few small observability helpers.
import { parseBytes, parsePercent, parseUsage } from "../containerInfo.ts";
import { exitCodeMeaning } from "./health.ts";

export type Ev = { time: number; action: string; name: string; exitCode: number | null; image: string };
export type Line = { time: number; name: string; text: string; level: "info" | "good" | "warn" | "bad" };

// `docker events --format '{{json .}}'` prints one JSON object per line.
export function parseEvents(lines: string): Ev[] {
  const out: Ev[] = [];
  for (const raw of lines.split("\n")) {
    try {
      const e = JSON.parse(raw);
      if (e?.Type !== "container") continue;
      const attrs = e.Actor?.Attributes ?? {};
      out.push({
        time: typeof e.timeNano === "number" ? Math.round(e.timeNano / 1e6) : Number(e.time ?? 0) * 1000,
        action: String(e.Action ?? e.status ?? ""),
        name: String(attrs.name ?? ""),
        exitCode: attrs.exitCode !== undefined ? Number(attrs.exitCode) : null,
        image: String(attrs.image ?? ""),
      });
    } catch {
      /* not an event line */
    }
  }
  return out;
}

export function describeEvent(e: Ev): Line | null {
  const line = (text: string, level: Line["level"]): Line => ({ time: e.time, name: e.name, text, level });
  const action = e.action.split(":")[0];
  switch (action) {
    case "start": return line(`${e.name} started`, "good");
    case "restart": return line(`${e.name} restarted`, "info");
    case "oom": return line(`${e.name} ran out of memory`, "bad");
    case "health_status": {
      const s = e.action.split(":")[1]?.trim();
      return s === "healthy" ? line(`${e.name} became healthy`, "good") : s === "unhealthy" ? line(`${e.name} became unhealthy`, "bad") : null;
    }
    case "die": {
      const code = e.exitCode ?? 0;
      if (code === 0) return line(`${e.name} finished`, "info");
      if (code === 143) return line(`${e.name} was stopped`, "info");
      if (code === 137) return line(`${e.name} was killed (exit 137)`, "warn");
      return line(`${e.name} ${exitCodeMeaning(code)} (exit ${code})`, "bad");
    }
    default: return null;
  }
}

export function timeline(events: Ev[], limit = 50, name?: string): Line[] {
  return events
    .filter((e) => !name || e.name === name)
    .map(describeEvent)
    .filter((l): l is Line => l !== null)
    .sort((a, b) => b.time - a.time)
    .slice(0, limit);
}

// `docker events` streams forever unless it has an end time, so every call gets both ends.
export const eventWindow = (nowMs: number, spanMs: number): string[] => ["--since", String(Math.floor((nowMs - spanMs) / 1000)), "--until", String(Math.floor(nowMs / 1000))];

// `docker system df -v --format json`: the exact shape is unverified, so accept an object with Volumes or a bare array.
export function parseVolumeSizes(json: string): Map<string, number> {
  const sizes = new Map<string, number>();
  try {
    const d = JSON.parse(json);
    const rows: { Name?: string; Size?: string | number }[] = Array.isArray(d) ? d : d?.Volumes ?? [];
    for (const v of rows) if (v?.Name) sizes.set(v.Name, typeof v.Size === "number" ? v.Size : parseBytes(String(v.Size ?? "")));
  } catch {
    /* leave empty */
  }
  return sizes;
}

export function heaviest(rows: { Name: string; CPUPerc: string; MemUsage: string }[], n: number): { name: string; memBytes: number; cpu: number }[] {
  return rows
    .map((r) => ({ name: r.Name, memBytes: parseUsage(r.MemUsage).used, cpu: parsePercent(r.CPUPerc) }))
    .filter((r) => r.memBytes > 0)
    .sort((a, b) => b.memBytes - a.memBytes)
    .slice(0, n);
}

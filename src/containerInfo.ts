// Pure helpers for the container detail page: inspect + stats parsing and sparkline math.

type PortMap = Record<string, { HostIp?: string; HostPort: string }[] | null> | undefined;

// `NetworkSettings.Ports` from `docker inspect` -> sorted unique tcp host ports.
export function publishedPorts(ports: PortMap): number[] {
  return publishedPortPairs(ports).map((p) => p.host);
}

// The same, with the port inside the container, so the caller can tell a web port from a database port.
export function publishedPortPairs(ports: PortMap): { host: number; container: number }[] {
  const out = new Map<number, number>();
  for (const [key, bindings] of Object.entries(ports ?? {})) {
    if (!key.endsWith("/tcp") || !bindings) continue;
    for (const b of bindings) {
      const n = Number(b.HostPort);
      if (Number.isInteger(n) && n > 0 && !out.has(n)) out.set(n, Number.parseInt(key, 10));
    }
  }
  return [...out].map(([host, container]) => ({ host, container })).sort((a, b) => a.host - b.host);
}

// `docker ps` Ports text, like "0.0.0.0:8080->8080/tcp, [::]:8080->8080/tcp" -> one link for 8080.
// Only "host->container" entries are published; a bare "9092/tcp" is not reachable from the Mac.
// A range is one link to its first port, and a port bound to one specific address is skipped,
// because http://localhost would not reach it.
const PUBLISHED_TCP = /(?:^|,\s*)([^,\s]*?):(\d+)(?:-(\d+))?->(\d+)(?:-\d+)?\/tcp/g;
const REACHABLE_FROM_LOCALHOST = new Set(["", "0.0.0.0", "[::]", "::", "127.0.0.1", "[::1]", "::1"]);

export type PortLink = { port: number; label: string; containerPort: number };

export function portLinksFromPs(ports: string): PortLink[] {
  const out = new Map<string, PortLink>();
  for (const [, host, first, last, inside] of ports.matchAll(PUBLISHED_TCP)) {
    if (!REACHABLE_FROM_LOCALHOST.has(host)) continue;
    const label = last && last !== first ? `${first}-${last}` : first;
    out.set(label, { port: Number(first), label, containerPort: Number(inside) });
  }
  return [...out.values()].sort((a, b) => a.port - b.port);
}

export function parsePercent(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const UNITS: Record<string, number> = {
  B: 1,
  kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12,
  KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4,
};

export function parseBytes(s: string): number {
  const m = /^([\d.]+)\s*([A-Za-z]+)$/.exec(s.trim());
  if (!m || !(m[2] in UNITS)) return 0;
  return parseFloat(m[1]) * UNITS[m[2]];
}

// "12.5MiB / 7.7GiB" -> { used, limit } in bytes
export function parseUsage(s: string): { used: number; limit: number } {
  const [a, b] = s.split(" / ");
  return { used: parseBytes(a ?? ""), limit: parseBytes(b ?? "") };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`;
  const units = ["KiB", "MiB", "GiB", "TiB"];
  let v = n;
  let i = -1;
  do {
    v /= 1024;
    i++;
  } while (v >= 1024 && i < units.length - 1);
  return `${v.toFixed(1)} ${units[i]}`;
}

// Points for an SVG <polyline>; y grows downward, so larger values sit higher.
export function sparkPoints(values: number[], width: number, height: number, max: number): string {
  if (values.length < 2) return "";
  const step = width / (values.length - 1);
  return values
    .map((v, i) => {
      const y = max > 0 ? height - Math.min(v / max, 1) * height : height;
      return `${+(i * step).toFixed(1)},${+y.toFixed(1)}`;
    })
    .join(" ");
}

// The slice of `docker inspect` output the detail page reads.
export type Inspect = {
  Id: string;
  Name: string;
  Created: string;
  Path: string;
  Args: string[];
  State: { Status: string; Running: boolean; Paused: boolean };
  Config: { Image: string; Env: string[] | null };
  HostConfig: { RestartPolicy?: { Name: string } };
  NetworkSettings: { Ports?: PortMap; Networks?: Record<string, { IPAddress: string; Aliases?: string[] | null }> };
  Mounts: { Type: string; Name?: string; Source: string; Destination: string; RW: boolean }[];
};

// Generic guidance for the Run panel. Everything here comes from what an image declares about itself
// (docker image inspect) or from what is already running: no per-image rules.

export type ImageInfo = { arch: string; os: string; env: string[]; ports: string[]; volumes: string[]; labels: Record<string, string> };
export type Link = { url: string; host: string };
type Ctr = { Names: string; State: string; Ports: string };

// `docker image inspect <ref>` prints an array; any of these fields can be null.
export function parseImageInfo(json: string): ImageInfo | null {
  try {
    const data = JSON.parse(json);
    const img = Array.isArray(data) ? data[0] : data;
    if (!img || typeof img !== "object") return null;
    const cfg = img.Config ?? {};
    return {
      arch: img.Architecture ?? "",
      os: img.Os ?? "",
      env: cfg.Env ?? [],
      ports: Object.keys(cfg.ExposedPorts ?? {})
        .filter((k) => k.endsWith("/tcp"))
        .map((k) => k.split("/")[0])
        .sort((a, b) => Number(a) - Number(b)),
      volumes: Object.keys(cfg.Volumes ?? {}).sort(),
      labels: cfg.Labels ?? {},
    };
  } catch {
    return null;
  }
}

// Only plain https links to a real host may be shown and opened. Link text comes from the image, so it is untrusted.
export function safeLink(url: string | undefined): Link | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" || u.username || u.password || !u.hostname.includes(".") || url.length > 2048) return null;
    return { url: u.href, host: u.hostname };
  } catch {
    return null;
  }
}

function splitRef(ref: string): { path: string[]; tag: string | null; digest: boolean } {
  const noDigest = ref.split("@")[0];
  const digest = noDigest !== ref;
  const lastSlash = noDigest.lastIndexOf("/");
  const colon = noDigest.lastIndexOf(":");
  const hasTag = colon > lastSlash;
  const name = hasTag ? noDigest.slice(0, colon) : noDigest;
  return { path: name.split("/"), tag: hasTag ? noDigest.slice(colon + 1) : null, digest };
}

// Docker Hub page: /_/<name> for official images, /r/<namespace>/<name> otherwise. Null for other registries.
export function hubLink(ref: string): Link | null {
  let { path } = splitRef(ref);
  if (path[0] === "docker.io" || path[0] === "index.docker.io") path = path.slice(1);
  if (path.length > 1 && (path[0].includes(".") || path[0].includes(":") || path[0] === "localhost")) return null;
  if (path.length === 1) return safeLink(`https://hub.docker.com/_/${path[0]}`);
  if (path.length === 2) return safeLink(path[0] === "library" ? `https://hub.docker.com/_/${path[1]}` : `https://hub.docker.com/r/${path[0]}/${path[1]}`);
  return null;
}

// The image's own labels first (OCI keys, then the older label-schema keys), then the Hub page.
export function docsLinks(ref: string, labels: Record<string, string>): { docs: Link | null; source: Link | null; hub: Link | null } {
  const docs = safeLink(labels["org.opencontainers.image.documentation"] ?? labels["org.label-schema.usage"]);
  const url = safeLink(labels["org.opencontainers.image.url"] ?? labels["org.label-schema.url"]);
  const source = safeLink(labels["org.opencontainers.image.source"] ?? labels["org.label-schema.vcs-url"]);
  return { docs: docs ?? url, source, hub: hubLink(ref) };
}

export const suggestVolumes = (name: string, paths: string[]) =>
  paths.map((target, i) => ({ source: i === 0 ? `${name}-data` : `${name}-data${i + 1}`, target }));

export const hostArch = (colimaArch: string) => ({ aarch64: "arm64", x86_64: "amd64" } as Record<string, string>)[colimaArch] ?? colimaArch;

// Plain-language warnings about the image itself; none of them block a run.
export function checkImage(ref: string, info: ImageInfo, host: string): string[] {
  const out: string[] = [];
  if (info.arch && host && info.arch !== host) {
    out.push(`This image is built for ${info.arch} but your VM is ${host}. It may run slowly or not at all.`);
  }
  const { tag, digest } = splitRef(ref);
  if (!digest && (!tag || tag === "latest")) {
    out.push('No version is pinned, so "latest" can change later and break things. Add a tag like :1.4.');
  }
  return out;
}

// host port -> name of the running container that publishes it
export function usedHostPorts(containers: Ctr[]): Map<string, string> {
  const used = new Map<string, string>();
  for (const c of containers) {
    if (c.State !== "running") continue;
    for (const m of c.Ports.matchAll(/:(\d+)->\d+\/tcp/g)) if (!used.has(m[1])) used.set(m[1], c.Names);
  }
  return used;
}

// The number before "/tcp" is always the container side, published or not.
export const containerPorts = (ports: string): number[] =>
  [...new Set([...ports.matchAll(/(\d+)\/tcp/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);

export const portWarnings = (rows: { host: string }[], used: Map<string, string>): string[] =>
  rows.filter((r) => r.host && used.has(r.host)).map((r) => `Port ${r.host} on this Mac is already used by "${used.get(r.host)}". Pick another host port.`);

export const nameWarning = (name: string, containers: Ctr[]): string | null =>
  name && containers.some((c) => c.Names === name) ? `A container named "${name}" already exists.` : null;

export const peers = (containers: Ctr[]): { name: string; ports: number[] }[] =>
  containers.filter((c) => c.State === "running").map((c) => ({ name: c.Names, ports: containerPorts(c.Ports) }));

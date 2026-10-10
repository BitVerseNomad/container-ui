// Networks and the connection doctor: parse docker output and turn the facts into plain-language findings.

export type NetMember = { id: string; name: string; ip: string };
export type NetInfo = { name: string; driver: string; subnet: string; members: NetMember[] };

// `docker network inspect a b c` prints an array of networks.
export function parseNetworks(json: string): NetInfo[] {
  try {
    return (JSON.parse(json) as any[]).map((n) => ({
      name: n.Name,
      driver: n.Driver ?? "",
      subnet: n.IPAM?.Config?.[0]?.Subnet ?? "",
      members: Object.entries(n.Containers ?? {}).map(([id, c]: [string, any]) => ({ id, name: c.Name, ip: String(c.IPv4Address ?? "").split("/")[0] })),
    }));
  } catch {
    return [];
  }
}

export type ContainerNet = { network: string; ip: string; aliases: string[] };
export type ContainerFacts = { name: string; running: boolean; nets: ContainerNet[]; env: string[]; ports: number[] };

// `docker inspect <container>`
export function parseContainerFacts(json: string): ContainerFacts | null {
  try {
    const c = JSON.parse(json)[0];
    if (!c) return null;
    return {
      name: String(c.Name ?? "").replace(/^\//, ""),
      running: !!c.State?.Running,
      env: c.Config?.Env ?? [],
      ports: Object.keys(c.Config?.ExposedPorts ?? {}).filter((k) => k.endsWith("/tcp")).map((k) => Number(k.split("/")[0])).sort((a, b) => a - b),
      nets: Object.entries(c.NetworkSettings?.Networks ?? {}).map(([network, v]: [string, any]) => ({ network, ip: v.IPAddress ?? "", aliases: v.Aliases ?? [] })),
    };
  } catch {
    return null;
  }
}

const SPECIAL = new Set(["bridge", "host", "none"]);

// Names only resolve on a user-defined network; the default "bridge" doesn't do name lookup.
export function sharedNetworks(a: ContainerFacts, b: ContainerFacts): { named: string[]; onlyBridge: boolean } {
  const bn = new Set(b.nets.map((n) => n.network));
  const both = a.nets.map((n) => n.network).filter((n) => bn.has(n));
  const named = both.filter((n) => !SPECIAL.has(n));
  return { named, onlyBridge: named.length === 0 && both.includes("bridge") };
}

const IGNORED_KEYS = new Set(["NO_PROXY", "no_proxy", "HOSTNAME", "PATH", "HOME", "PWD"]);

// Inside a container, "localhost" is the container itself. Flag settings that point at it on the target's port.
export function localhostSettings(env: string[], target: string, ports: number[]): { key: string; value: string; fixed: string }[] {
  const out: { key: string; value: string; fixed: string }[] = [];
  for (const entry of env) {
    const eq = entry.indexOf("=");
    if (eq < 1) continue;
    const key = entry.slice(0, eq);
    const value = entry.slice(eq + 1);
    if (IGNORED_KEYS.has(key)) continue;
    let hit = false;
    const fixedValue = value.replace(/(localhost|127\.0\.0\.1):(\d+)/g, (m, _host, port) => {
      if (!ports.includes(Number(port))) return m;
      hit = true;
      return `${target}:${port}`;
    });
    if (hit) out.push({ key, value, fixed: `${key}=${fixedValue}` });
  }
  return out;
}

// nslookup prints the DNS server's own address (with #53) first; the answer is the Address line without it.
export function parseNslookup(out: string): string | null {
  for (const line of out.split("\n")) {
    const m = /^Address:?\s+([0-9.]+)\s*$/.exec(line.trim());
    if (m) return m[1];
  }
  return null;
}

export type ProbeResult = { dns: { ok: boolean; ip: string | null }; tcp: { ok: boolean } };

// The helper container prints "::dns-exit=<code>" and "::tcp-exit=<code>" after each check.
export function parseProbe(out: string): ProbeResult {
  const code = (name: string) => {
    const m = new RegExp(`::${name}-exit=(\\d+)`).exec(out);
    return m ? Number(m[1]) : null;
  };
  const dnsOk = code("dns") === 0;
  return { dns: { ok: dnsOk, ip: dnsOk ? parseNslookup(out) : null }, tcp: { ok: code("tcp") === 0 } };
}

export type Fix =
  | { kind: "connect"; network: string; containers: string[] }
  | { kind: "copy"; label: string; text: string };
export type Finding = { id: "running" | "network" | "dns" | "port" | "localhost" | "summary"; status: "ok" | "warn" | "fail" | "info"; title: string; detail: string; fix?: Fix };
export type Facts = { from: ContainerFacts; to: ContainerFacts; port: number; probe: ProbeResult | null };

export function diagnose({ from, to, port, probe }: Facts): Finding[] {
  const out: Finding[] = [];
  const stopped = [from, to].filter((c) => !c.running);
  if (stopped.length) {
    for (const c of stopped) out.push({ id: "running", status: "fail", title: `${c.name} isn't running`, detail: `Start ${c.name} first, then check again.` });
    return out;
  }

  const shared = sharedNetworks(from, to);
  if (shared.named.length === 0) {
    const target = to.nets.map((n) => n.network).find((n) => !SPECIAL.has(n)) ?? "devnet";
    const needs = [from, to].filter((c) => !c.nets.some((n) => n.network === target)).map((c) => c.name);
    out.push({
      id: "network",
      status: "fail",
      title: "They don't share a network",
      detail: shared.onlyBridge
        ? `Both are only on the default network, where containers can't find each other by name. Put them on a network of your own.`
        : `${from.name} is on ${from.nets.map((n) => n.network).join(", ") || "no network"} and ${to.name} is on ${to.nets.map((n) => n.network).join(", ") || "no network"}. Containers find each other by name only on a network they both belong to.${[from, to].some((c) => c.nets.some((n) => n.network === "bridge")) ? " The default network (bridge) doesn't do name lookup." : ""}`,
      fix: { kind: "connect", network: target, containers: needs },
    });
  } else {
    out.push({ id: "network", status: "ok", title: "They share a network", detail: `Both are on ${shared.named.join(", ")}.` });
    if (probe) {
      if (!probe.dns.ok) {
        out.push({ id: "dns", status: "fail", title: `The name doesn't resolve from ${from.name}`, detail: `${from.name} can't find "${to.name}". Use the container's name or one of its network aliases.` });
      } else {
        out.push({ id: "dns", status: "ok", title: "The name resolves", detail: `From ${from.name}, ${to.name} is ${probe.dns.ip ?? "found"}.` });
        out.push(
          probe.tcp.ok
            ? { id: "port", status: "ok", title: "The port accepts connections", detail: `${to.name}:${port} answered.` }
            : {
                id: "port",
                status: "fail",
                title: `Nothing answered on ${to.name}:${port}`,
                detail: `${to.name} may not be listening on that port, may only listen on its own localhost, or may still be starting.${to.ports.length ? ` It declares ports ${to.ports.join(", ")}.` : ""}`,
              },
        );
      }
    }
  }

  for (const s of localhostSettings(from.env, to.name, [port, ...to.ports])) {
    out.push({
      id: "localhost",
      status: "warn",
      title: `A setting in ${from.name} points at localhost`,
      detail: `${s.key}=${s.value}. Inside a container, localhost means the container itself. Use ${to.name} instead.`,
      fix: { kind: "copy", label: "Copy corrected setting", text: s.fixed },
    });
  }

  if (out.every((f) => f.status === "ok")) {
    out.push({
      id: "summary",
      status: "info",
      title: "The network checks passed",
      detail: "If the app still fails, some services hand clients a different address after the first connection. Read the image's own setup notes for an advertised or external address setting.",
    });
  }
  return out;
}

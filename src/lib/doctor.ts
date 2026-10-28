// The Doctor: one list of checks over what Docker already tells us (container and image inspect, disk use, the
// VM's size). Each check is a pure function, so it is tested on recorded inspect output and never runs anything.
// Findings carry the evidence they found ("DATABASE_URL is localhost:5432"), not only a rule name, so a wrong one
// is easy to spot. Facts: Docker docs (default bridge has no name lookup; exit codes 125-127), the postgres and mysql
// image docs (required password settings, data folders), Colima's FAQ and README (2 GB default VM, home folder share).
import { APACHE_KAFKA, DEFAULT_NETS, IMAGE_ENV, KAFKA_UI, appProblems, fixFor, owner, toApp } from "./apps.ts";
import type { App, Env, Inspect } from "./apps.ts";
import { parseState, problemsFor } from "./health.ts";
import type { Problem } from "./health.ts";
import type { DiskRow } from "./disk.ts";
import { shellQuote } from "./composeScan.ts";

export type Area = "Setup" | "Containers" | "Network" | "Images" | "Storage" | "VM";
// action: something is broken or about to be. know: works, but costs you later.
export type Severity = "action" | "know";
// key is stable across runs (profile, check, container, and the setting when there is one), so a finding can be
// muted without also hiding a different problem in the same container later.
export type Finding = Problem & { key: string; area: Area; severity: Severity; subject?: string; health?: boolean };
export type Facts = {
  containers: unknown[];
  ctx: string;
  images?: unknown[]; // `docker image inspect` of the images in use
  hostArch?: string; // arm64 or amd64
  vmMemory?: number; // bytes
  disk?: DiskRow[];
};
// byContainer has every finding about a container; extra leaves out crash and health ones, which the
// container page already works out from its own state.
export type Report = { findings: Finding[]; byContainer: Map<string, Finding[]>; extra: Map<string, Finding[]>; passed: string[] };

// needs: the facts a check reads. When they didn't arrive, the check is left out rather than counted as passed.
type Check = { id: string; area: Area; passed: string; needs?: (f: Ctx) => boolean; run: (f: Ctx) => Finding[] };
type Ctx = Facts & { apps: App[]; running: App[]; raw: Inspect[] };

const GB = 1e9;
const GIB = 1024 ** 3;
const ANON_VOLUME = /^[0-9a-f]{64}$/;
const HOST_PORT = /(?:^|[^\w.-])(localhost|127\.0\.0\.1|\[::1\]):(\d{2,5})(?!\d)/g;
// Addresses a browser uses (CORS, callbacks, public URLs) or the app listens on: localhost is right for those.
// Matched from the start of a word in the name, so DATABASE_URL is not read as BASE_URL.
const NOT_A_CLIENT = /(^|_)(CORS|ORIGINS?|CALLBACK|REDIRECT|PUBLIC|BASE_URL|APP_URL|SITE_URL|NEXTAUTH|LISTEN|BIND)/i;
// Setting names whose plain value is a host (REDIS_HOST=cache). Other plain values (SESSION_DRIVER=redis) are not.
const HOSTISH = /HOST|SERVER|ADDR|URL|URI|DSN|ENDPOINT|BROKER|BOOTSTRAP|NODES/i;
// Host networking or another container's network: localhost is shared, and names work as they do there.
const isolated = (a: App) => a.hostNet || a.sharedNs;
const dockerCmd = (ctx: string) => `docker --context ${shellQuote(ctx)}`;
const userNets = (a: App) => a.nets.filter((n) => !DEFAULT_NETS.has(n));
const shares = (a: App, b: App) => userNets(a).some((n) => b.nets.includes(n));
const envOf = (a: App): Env => [...a.env].filter(([k]) => !IMAGE_ENV.test(k));
const knownApp = (a: App) => KAFKA_UI.test(a.image) || APACHE_KAFKA.test(a.image);
const repo = (image: string) => image.replace(/^docker\.io\//, "").replace(/^library\//, "").replace(/[:@].*$/, "");
const level = (s: Severity): Problem["level"] => (s === "action" ? "bad" : "warn");

// A finding about one container also shows on that container's row and page.
function about(a: App, f: Omit<Finding, "key" | "subject" | "level"> & { level?: Problem["level"]; keyPart?: string }): Finding {
  const { keyPart, ...rest } = f;
  return { ...rest, level: f.level ?? level(f.severity), key: `${f.id}:${a.name}${keyPart ? `:${keyPart}` : ""}`, subject: a.name };
}

// Hosts a setting points at: the host part of a URL, host:port, or the whole value when the name says it is a host.
export function hostsIn(key: string, value: string): string[] {
  const out: string[] = [];
  for (const part of value.split(/[\s,;]+/)) {
    const url = /^[a-z][\w+.-]*:\/\/([^/?#]*)/i.exec(part);
    const hostPort = /^([\w.-]+):\d{2,5}$/.exec(part);
    const host = url ? url[1].slice(url[1].lastIndexOf("@") + 1).replace(/:\d+$/, "") : hostPort ? hostPort[1] : HOSTISH.test(key) ? part : "";
    if (/^[a-z0-9][\w.-]*$/i.test(host)) out.push(host);
  }
  return out;
}

// Where a database keeps its data, or null when nothing is mounted there that survives (no mount, unnamed, tmpfs).
function dataMount(a: App, dir: string) {
  return a.mounts.find((x) => x.dest === dir || x.dest.startsWith(`${dir}/`) || dir.startsWith(`${x.dest}/`));
}
const lasts = (m: App["mounts"][number] | undefined) => !!m && m.type !== "tmpfs" && !(m.type === "volume" && ANON_VOLUME.test(m.source));
const dataDir = (r: string) => (/^(postgres|postgis\/postgis)$/.test(r) ? "/var/lib/postgresql" : /^(mysql|mariadb)$/.test(r) ? "/var/lib/mysql" : /^mongo$/.test(r) ? "/data/db" : null);

// The network two containers should share: one the target is on, else a new one named for the target.
function joinFix(ctx: string, from: App, to: App): Problem["fix"] {
  const net = userNets(to)[0] ?? userNets(from)[0];
  const create = !net;
  const network = net ?? `${to.name}-net`;
  const containers = [from, to].filter((x) => !x.nets.includes(network)).map((x) => x.name);
  const d = dockerCmd(ctx);
  const text = [...(create ? [`${d} network create ${network}`] : []), ...containers.map((c) => `${d} network connect ${network} ${c}`)].join("\n");
  if (owner(from) === "compose" || owner(to) === "compose")
    return { label: "Share a network", text: `${text}\n\n# Compose recreates containers from its file: add the same network to both services there too.`, note: "Compose containers come back from their file, so put the network there too." };
  if (owner(from) === "kubernetes" || owner(to) === "kubernetes") return undefined;
  return { label: `Connect to ${network}`, text, connect: { network, create, containers } };
}

const CHECKS: Check[] = [
  {
    // A setting like DATABASE_URL=postgres://localhost:5432: inside a container that is the container itself.
    id: "localhost-target",
    area: "Network",
    passed: "No container looks for another one at localhost",
    run: ({ running, ctx }) =>
      running.flatMap((a) => {
        if (isolated(a) || knownApp(a)) return [];
        // Its own ports: a health URL or similar.
        const own = new Set([...a.exposed, ...a.ports.map(([, inner]) => Number(inner))]);
        for (const [key, value] of envOf(a)) {
          if (NOT_A_CLIENT.test(key)) continue;
          for (const m of value.matchAll(HOST_PORT)) {
            const port = Number(m[2]);
            if (own.has(port)) continue;
            const targets = running.filter((t) => t !== a && !isolated(t) && t.exposed.includes(port));
            if (!targets.length) continue;
            const sharing = targets.filter((x) => shares(a, x));
            // Only one container it can mean: then the app may change it. Otherwise it says what it saw and asks you.
            const sure = sharing.length === 1 || targets.length === 1;
            const t = sharing[0] ?? targets[0];
            const fixed = value.replace(`${m[1]}:${m[2]}`, `${t.name}:${port}`);
            const net = userNets(t).find((n) => a.nets.includes(n)) ?? userNets(t)[0] ?? null;
            const env = envOf(a).map(([k, v]): [string, string] => [k, k === key ? fixed : v]);
            const base = net ? fixFor(ctx, a, net, env, [[key, fixed]], [], [], net) : null;
            const fix = base?.fix && (sure ? { ...base.fix, confirm: base.fix.confirm && `${key} becomes ${fixed}. ${base.fix.confirm}` } : { ...base.fix, steps: undefined, confirm: undefined });
            const joinNote = net ? "" : ` ${t.name} is only on Docker's default network, so first put both on a network you create (docker network create, then docker network connect).`;
            const which = sure ? `${t.name} listens on ${port}, so the address should be ${t.name}:${port}.` : `${targets.map((x) => x.name).join(" and ")} all listen on ${port}, so check which one ${key} means. The commands assume ${t.name}.`;
            return [about(a, {
              id: "localhost-target",
              keyPart: key,
              area: "Network",
              severity: sure ? "action" : "know",
              title: sure ? `${a.name} looks for ${t.name} at localhost` : `${a.name} may look for another container at localhost`,
              short: sure ? `Can't reach ${t.name}` : "localhost in a setting",
              detail: `${key} is ${value}. Inside a container, localhost is the container itself, not your Mac or another container. ${which}${joinNote}${sure ? base?.tail ?? "" : ""}`,
              fix,
            })];
          }
        }
        return [];
      }),
  },
  {
    // Names only resolve on networks you create; on Docker's default bridge, or with no network in common, they don't.
    id: "no-shared-network",
    area: "Network",
    passed: "Containers that use each other's names share a network",
    run: ({ running, ctx }) =>
      running.flatMap((a) => {
        if (isolated(a) || knownApp(a)) return [];
        const hosts = new Set(envOf(a).flatMap(([k, v]) => hostsIn(k, v)));
        const t = running.filter((x) => x !== a && !isolated(x) && hosts.has(x.name)).find((x) => !shares(a, x));
        if (!t) return [];
        const both = a.nets.includes("bridge") && t.nets.includes("bridge") && !userNets(a).length && !userNets(t).length;
        const why = both
          ? `Both are on Docker's default network, where containers can't find each other by name.`
          : `They have no network in common, so the name ${t.name} doesn't resolve inside ${a.name}.`;
        return [about(a, { id: "no-shared-network", area: "Network", severity: "action", title: `${a.name} can't find ${t.name} by name`, short: `Can't find ${t.name}`, detail: `A setting in ${a.name} uses the name ${t.name}. ${why} Connecting both to one network fixes it and changes nothing else.`, fix: joinFix(ctx, a, t) })];
      }),
  },
  {
    // Fix renames a container to NAME-old and stops it while the new one starts. If the app quit or the VM stopped
    // in the middle, that copy is what's left. A running NAME-old was named that by hand, so it isn't one.
    id: "fix-leftover",
    area: "Containers",
    passed: "No container is left over from an unfinished Fix",
    run: ({ apps, ctx }) =>
      apps.flatMap((a) => {
        const base = /^(.+)-old$/.exec(a.name)?.[1];
        if (!base || a.running) return [];
        const d = dockerCmd(ctx);
        if (apps.some((x) => x.name === base))
          return [about(a, { id: "fix-leftover", area: "Containers", severity: "know", title: `${a.name} is the old copy a Fix kept`, short: "Old copy from a Fix", detail: `A Fix replaced ${base} and kept the old one aside as ${a.name}. Once ${base} works, remove ${a.name}.`, fix: { label: "Remove the old copy", text: `${d} rm ${a.name}` } })];
        return [about(a, { id: "fix-leftover", area: "Containers", severity: "action", title: `A Fix didn't finish: ${base} is still named ${a.name}`, short: "Fix didn't finish", detail: `${base} was renamed to ${a.name} to be replaced, and the new ${base} never started. Giving it its name back and starting it returns it. The Fix turned its restart policy off, so if it should start with the VM, set that again too (${d} update --restart unless-stopped ${base}).`, fix: { label: "Put it back", text: `${d} rename ${a.name} ${base} && ${d} start ${base}` } })];
      }),
  },
  {
    // A container that stopped because its host port was taken says so in State.Error.
    id: "port-taken",
    area: "Network",
    passed: "No container failed to start over a taken port",
    run: ({ apps }) =>
      apps.flatMap((a) => {
        if (a.running || !/port is already allocated|address already in use/i.test(a.error)) return [];
        const port = /:(\d+) failed|:(\d+): bind/.exec(a.error);
        const p = port?.[1] ?? port?.[2];
        const holder = p ? apps.find((x) => x !== a && x.running && x.ports.some(([h]) => h === p)) : undefined;
        const who = holder ? ` ${holder.name} is using it now.` : p ? ` Something on your Mac or in the VM is using it.` : "";
        return [about(a, { id: "port-taken", area: "Network", severity: "action", title: `${a.name} couldn't start: port ${p ?? ""} is taken`.replace("port  is", "its port is"), short: "Port taken", detail: `Docker couldn't publish the port.${who} Stop that one, or run ${a.name} with another host port.` })];
      }),
  },
  {
    // amd64 images on an arm64 Mac run under emulation: slower, and some programs don't start ("exec format error").
    id: "arch",
    area: "Images",
    passed: "Every image matches the VM's CPU",
    needs: (f) => !!f.hostArch && !!f.images,
    run: ({ apps, images = [], hostArch, ctx }) => {
      const archOf = new Map((images as { Id?: string; Architecture?: string }[]).map((i) => [i.Id ?? "", i.Architecture ?? ""]));
      return apps.flatMap((a) => {
        const arch = archOf.get(a.imageId);
        if (!arch || arch === hostArch) return [];
        // A plain stop (143) or kill (137) is not a failure. A real crash keeps its own "stopped with an error" line.
        const failed = !a.running && ![0, 137, 143].includes(a.exitCode);
        // An image named by digest or ID has no tag to pull another CPU's build of.
        const tagged = !/^sha256:|@/.test(a.image);
        return [about(a, {
          id: "arch",
          area: "Images",
          severity: "know",
          title: failed ? `${a.name} stopped, and its image is built for ${arch}` : `${a.name} runs an ${arch} image on your ${hostArch} VM`,
          short: `Built for ${arch}`,
          detail: `${a.image} is built for ${arch}. On a ${hostArch} VM it runs under emulation, which is slower, and some programs stop with "exec format error"${failed ? ", so that may be why it stopped" : ""}. If the image also comes in ${hostArch}, pull that one and run it again.`,
          fix: tagged ? { label: "Pull the matching image", text: `${dockerCmd(ctx)} pull --platform linux/${hostArch} ${shellQuote(a.image)}` } : undefined,
        })];
      });
    },
  },
  {
    // The official postgres and mysql images refuse to start a new database without a password setting.
    id: "db-password",
    area: "Containers",
    passed: "Databases have the settings their image needs",
    run: ({ apps }) =>
      apps.flatMap((a) => {
        if (a.running || a.exitCode === 0) return [];
        const r = repo(a.image);
        const need = /^(postgres|postgis\/postgis)$/.test(r)
          ? !a.env.has("POSTGRES_PASSWORD") && a.env.get("POSTGRES_HOST_AUTH_METHOD") !== "trust" && !a.env.has("POSTGRES_PASSWORD_FILE") ? "POSTGRES_PASSWORD" : null
          : /^(mysql|mariadb)$/.test(r)
            ? !["MYSQL_ROOT_PASSWORD", "MYSQL_ALLOW_EMPTY_PASSWORD", "MYSQL_RANDOM_ROOT_PASSWORD", "MARIADB_ROOT_PASSWORD", "MARIADB_ALLOW_EMPTY_ROOT_PASSWORD", "MARIADB_RANDOM_ROOT_PASSWORD", "MYSQL_ROOT_PASSWORD_FILE", "MARIADB_ROOT_PASSWORD_FILE"].some((k) => a.env.has(k)) ? (r === "mariadb" ? "MARIADB_ROOT_PASSWORD" : "MYSQL_ROOT_PASSWORD") : null
            : null;
        // A database that was set up before needs no password to start, so a stop there has another cause.
        if (!need || lasts(dataMount(a, dataDir(r)!))) return [];
        return [about(a, { id: "db-password", area: "Containers", severity: "action", title: `${a.name} stopped, probably because it has no ${need}`, short: `Needs ${need}`, detail: `The ${r} image won't set up a new database without ${need}, and this one has no saved data yet. Its logs say for sure. Run it again with -e ${need}=<a password you choose>. The password is yours to pick, so the app doesn't set one.` })];
      }),
  },
  {
    // A database whose data lives inside the container, or in an unnamed volume, loses it when recreated or cleaned up.
    id: "db-volume",
    area: "Storage",
    passed: "Databases keep their data in a named volume or folder",
    run: ({ apps }) =>
      apps.flatMap((a) => {
        const dir = dataDir(repo(a.image));
        if (!dir) return [];
        const m = dataMount(a, dir);
        if (lasts(m)) return [];
        const kind = m?.type === "tmpfs" ? "in memory (tmpfs)" : m ? "in an unnamed volume" : "inside the container";
        const where = m?.type === "tmpfs" ? "in memory, so every stop deletes the data" : m ? "in an unnamed volume, which a cleanup or docker rm -v deletes" : "inside the container, so removing or replacing it deletes the data";
        return [about(a, { id: "db-volume", area: "Storage", severity: "know", title: `${a.name} keeps its data ${kind}`, short: "Data not in a volume", detail: `${a.name}'s data folder ${m?.dest ?? dir} is ${where}. Next time you create it, add -v ${a.name}-data:${m?.dest ?? dir} so the data has a name and survives.` })];
      }),
  },
  {
    // Colima's VM has 2 GB of memory by default; these images need more and get killed or crawl.
    id: "vm-memory",
    area: "VM",
    passed: "The VM has enough memory for what runs on it",
    needs: (f) => !!f.vmMemory,
    run: ({ apps, vmMemory = 0 }) => {
      if (vmMemory > 2.5 * GIB) return [];
      const heavy = apps.filter((a) => (a.running || a.exitCode === 137) && /(^|\/)(elasticsearch|opensearch|kafka|cp-kafka|cp-server|sonarqube|clickhouse-server)(:|$)/.test(a.image));
      if (!heavy.length) return [];
      const names = heavy.map((a) => a.name).join(", ");
      return [{ id: "vm-memory", key: "vm-memory", area: "VM", severity: "know", level: "warn", title: `The VM has ${Math.round(vmMemory / GIB)} GiB of memory for ${names}`, detail: `${names} usually need 4 GiB or more. With less, they get stopped for running out of memory or slow everything down. Give the VM more memory in Profiles.`, fix: { label: "Open Profiles", text: "", go: "Profiles" } }];
    },
  },
  {
    // Old images and build cache fill the VM's disk without anyone noticing.
    id: "disk",
    area: "Storage",
    passed: "Little disk space is held by unused images and build cache",
    needs: (f) => !!f.disk?.some((d) => d.size !== null),
    run: ({ disk = [] }) => {
      const free = disk.filter((d) => d.kind === "images" || d.kind === "buildCache").reduce((n, d) => n + (d.reclaimable ?? 0), 0);
      if (free < 10 * GB) return [];
      return [{ id: "disk", key: "disk", area: "Storage", severity: "know", level: "warn", title: `About ${Math.round(free / GB)} GB can be freed`, detail: "Unused images and build cache take this much of the VM's disk. Images shows what each part is and clears it; volumes are never touched.", fix: { label: "Open Images to free it", text: "", go: "Images" } }];
    },
  },
];

// Crash and health titles are written for the container's own page ("Its health check is failing"). A page that
// lists every container needs the name in them.
export function named(name: string, title: string): string {
  if (title.startsWith("Its ")) return `${name}'s ${title.slice(4)}`;
  if (title.startsWith("It ")) return `${name} ${title.slice(3)}`;
  return `${name} ${title[0].toLowerCase()}${title.slice(1)}`;
}

// Checks that name why a container stopped. When one fires, the plain "stopped with an error" says less, so it goes.
const CAUSE = new Set(["db-password", "port-taken"]);

// Crashes, health and the known-app checks keep their own logic; they are listed here so the Doctor shows them too.
function containerProblems(f: Ctx): Finding[] {
  const out: Finding[] = [];
  for (const raw of f.raw) {
    const s = parseState(JSON.stringify([raw]));
    if (!s) continue;
    const a = f.apps.find((x) => x.name === s.name)!;
    // A crash, a failing health check or a restart loop all need action; level keeps the row's colour.
    for (const p of problemsFor(s)) out.push({ ...about(a, { ...p, title: named(a.name, p.title), short: p.short ?? p.title, area: "Containers", severity: "action" }), health: true });
  }
  for (const [name, list] of appProblems(f.raw, f.ctx)) {
    const a = f.apps.find((x) => x.name === name)!;
    for (const p of list) out.push(about(a, { ...p, area: "Network", severity: "action", level: p.level }));
  }
  return out;
}

export function doctor(facts: Facts, muted: ReadonlySet<string> = new Set()): Report {
  const raw = facts.containers as Inspect[];
  const apps = raw.map(toApp);
  const ctx: Ctx = { ...facts, raw, apps, running: apps.filter((a) => a.running) };
  const findings: Finding[] = [...containerProblems(ctx)];
  const passed: string[] = [];
  for (const c of CHECKS) {
    if (c.needs && !c.needs(ctx)) continue;
    const got = c.run(ctx);
    if (got.length) findings.push(...got);
    else passed.push(c.passed);
  }
  // Decided before the explained crash lines go, or Passed would claim nothing crashed.
  if (!findings.some((x) => x.health)) passed.unshift("No container crashed, ran out of memory or keeps restarting");
  const explained = new Set(findings.filter((x) => CAUSE.has(x.id)).map((x) => x.subject));
  const kept = findings.filter((x) => !(x.id === "crashed" && explained.has(x.subject))).map((x) => ({ ...x, key: `${facts.ctx}/${x.key}` }));
  const shown = kept.filter((x) => !muted.has(x.key));
  const byContainer = new Map<string, Finding[]>();
  const extra = new Map<string, Finding[]>();
  for (const x of shown) {
    if (!x.subject) continue;
    byContainer.set(x.subject, [...(byContainer.get(x.subject) ?? []), x]);
    if (!x.health) extra.set(x.subject, [...(extra.get(x.subject) ?? []), x]);
  }
  return { findings: kept.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "action" ? -1 : 1)), byContainer, extra, passed };
}

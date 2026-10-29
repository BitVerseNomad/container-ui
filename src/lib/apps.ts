// Known-app checks: setups that start fine but can't work, read from `docker inspect` over every container.
// Kafka facts are from the apache/kafka image docs (hub.docker.com/r/apache/kafka, docker/examples in apache/kafka)
// and its /etc/kafka/docker scripts: any KAFKA_ variable replaces all the defaults, the default config advertises
// localhost:9092, and CLUSTER_ID defaults to 5L6g3nShT-eMCtK--X86sw.
import type { Keep, Problem, Replace } from "./health.ts";
import { shellQuote } from "./composeScan.ts";

type Bind = { HostIp?: string; HostPort?: string }[] | null;
export type Inspect = {
  Id?: string;
  Name?: string;
  Image?: string;
  State?: { Running?: boolean; Status?: string; ExitCode?: number; Error?: string; OOMKilled?: boolean };
  Config?: { ExposedPorts?: Record<string, unknown> | null; Image?: string; Env?: string[] | null; Labels?: Record<string, string> | null; Cmd?: unknown; Entrypoint?: unknown; User?: string; WorkingDir?: string; Healthcheck?: unknown; Hostname?: string; Tty?: boolean };
  NetworkSettings?: { Ports?: Record<string, Bind> | null; Networks?: Record<string, { Aliases?: string[] | null; IPAMConfig?: { IPv4Address?: string } | null } | null> | null };
  HostConfig?: {
    PortBindings?: Record<string, Bind> | null;
    NetworkMode?: string;
    RestartPolicy?: { Name?: string; MaximumRetryCount?: number };
    Privileged?: boolean;
    CapAdd?: string[] | null;
    Devices?: unknown[] | null;
    Memory?: number;
    NanoCpus?: number;
    CpuShares?: number;
    ExtraHosts?: string[] | null;
    Dns?: string[] | null;
    ShmSize?: number;
    Ulimits?: unknown[] | null;
    Init?: boolean | null;
    SecurityOpt?: string[] | null;
    ReadonlyRootfs?: boolean;
    Links?: string[] | null;
    LogConfig?: { Type?: string; Config?: Record<string, string> | null };
    AutoRemove?: boolean;
    Tmpfs?: Record<string, string> | null;
    Sysctls?: Record<string, string> | null;
    PidMode?: string;
    IpcMode?: string;
    PublishAllPorts?: boolean;
    CapDrop?: string[] | null;
  };
  Mounts?: { Type?: string; Name?: string; Source?: string; Destination?: string; RW?: boolean }[] | null;
};

// mounts: where each is mounted, plus the flag that mounts it again (null for one that can't be, like tmpfs).
export type App = {
  name: string;
  id: string;
  imageId: string;
  // Ports the image says it listens on, inside the container.
  exposed: number[];
  exitCode: number;
  error: string;
  image: string;
  running: boolean;
  env: Map<string, string>;
  labels: Record<string, string>;
  nets: string[];
  hostNet: boolean;
  // Uses another container's network (--network container:x, a Kubernetes pod, a sidecar): localhost is shared.
  sharedNs: boolean;
  restart: string;
  // [host port, container port, host address when it is bound to one]
  ports: [string, string, string?][];
  mounts: { dest: string; spec: string | null; source: string; type: string }[];
  // Settings a Fix can't run again; any of these makes it copy-only.
  extras: string[];
  keep: Keep;
};
export type Env = [string, string][];

export const KAFKA_UI = /(^|\/)kafka-ui(:|$)/;
export const APACHE_KAFKA = /^(docker\.io\/)?apache\/kafka(-native)?(:|$)/;
export const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/;
export const DEFAULT_NETS = new Set(["bridge", "host", "none"]);
// Kafka UI reads its clusters from KAFKA_CLUSTERS_<n>_BOOTSTRAPSERVERS, or from a config file it is given.
const BOOTSTRAP_KEY = /^KAFKA_CLUSTERS_\d+_BOOTSTRAPSERVERS$/;
const CONFIG_FILE_KEY = /^SPRING_CONFIG_(ADDITIONAL[-_])?LOCATION$/;
// Set by the image itself, not by whoever ran it; left out when the container is run again.
export const IMAGE_ENV = /^(PATH|HOME|HOSTNAME|LANG|LANGUAGE|LC_ALL|JAVA_HOME|JAVA_VERSION)$/;
const DEFAULT_CLUSTER_ID = "5L6g3nShT-eMCtK--X86sw";
const DEFAULT_LOG_DIR = "/tmp/kraft-combined-logs";

export function toApp(c: Inspect): App {
  const env = new Map<string, string>();
  for (const line of c.Config?.Env ?? []) {
    const i = line.indexOf("=");
    if (i > 0) env.set(line.slice(0, i), line.slice(i + 1));
  }
  const bound = c.NetworkSettings?.Ports ?? c.HostConfig?.PortBindings ?? {};
  const ports: [string, string, string?][] = [];
  const extras: string[] = [];
  for (const [key, list] of Object.entries(bound ?? {})) {
    const b = list?.find((x) => x.HostPort);
    if (!b?.HostPort) continue;
    if (!key.endsWith("/tcp") && key.includes("/")) extras.push(`a ${key.split("/")[1].toUpperCase()} port`);
    // 127.0.0.1 is kept, so a port only your Mac could reach stays that way. 0.0.0.0 and :: are the default.
    const ip = b.HostIp && !/^(0\.0\.0\.0|::|)$/.test(b.HostIp) ? b.HostIp : undefined;
    if (ip && ip !== "127.0.0.1") extras.push(`a port bound to ${ip}`);
    if (!ports.some(([h]) => h === b.HostPort)) ports.push([b.HostPort, key.split("/")[0], ip]);
  }
  const netInfo = c.NetworkSettings?.Networks ?? {};
  const nets = Object.keys(netInfo);
  const name = String(c.Name ?? "").replace(/^\//, "");
  const id = String(c.Id ?? "");
  // Docker lists the container's own name and short ID as aliases; anything else was set by hand.
  for (const n of Object.values(netInfo)) {
    if ((n?.Aliases ?? []).some((a) => a !== name && !(a.length >= 12 && id.startsWith(a)))) extras.push("a network alias");
    if (n?.IPAMConfig?.IPv4Address) extras.push("a fixed IP address");
  }
  const h = c.HostConfig ?? {};
  const set: [boolean, string][] = [
    [!!h.Privileged, "privileged mode"],
    [!!h.CapAdd?.length, "extra capabilities"],
    [!!h.Devices?.length, "devices"],
    [!!h.Memory || !!h.NanoCpus || !!h.CpuShares, "memory or CPU limits"],
    [!!h.ExtraHosts?.length, "extra hosts"],
    [!!h.Dns?.length, "its own DNS servers"],
    [!!h.Ulimits?.length, "ulimits"],
    [!!h.Init, "an init process"],
    [!!h.ShmSize && h.ShmSize !== 67108864, "a shared memory size"],
    [!!h.SecurityOpt?.length, "security options"],
    [!!h.ReadonlyRootfs, "a read-only filesystem"],
    [!!h.Links?.length, "links to other containers"],
    [!!h.LogConfig?.Type && !["json-file", "local"].includes(h.LogConfig.Type), "its own log driver"],
    [Object.keys(h.LogConfig?.Config ?? {}).length > 0, "log options"],
    // Fix stops the old copy before starting the new one; with --rm Docker deletes it right then, so a failed Fix
    // would have nothing to put back.
    [!!h.AutoRemove, "being removed when it stops (--rm)"],
    [Object.keys(h.Tmpfs ?? {}).length > 0, "a tmpfs mount"],
    [Object.keys(h.Sysctls ?? {}).length > 0, "kernel settings (sysctls)"],
    // Docker's defaults are an empty PID mode and a private or shareable IPC mode.
    [!!h.PidMode || /^(host|container:)/.test(h.IpcMode ?? ""), "a shared process or IPC namespace"],
    [!!h.PublishAllPorts, "all ports published (-P)"],
    [!!h.CapDrop?.length, "dropped capabilities"],
    [!!c.Config?.Tty, "a terminal (-t)"],
    // Docker's default hostname is the short ID; anything else was set, and some apps (RabbitMQ) keep data under it.
    [!!c.Config?.Hostname && !id.startsWith(c.Config.Hostname), "its own hostname"],
    // Routing labels (Traefik, Caddy) can't be passed to docker run from the app.
    [Object.keys(c.Config?.Labels ?? {}).some((k) => /^(traefik|caddy)[._]/.test(k)), "routing labels"],
  ];
  for (const [on, what] of set) if (on) extras.push(what);
  return {
    name,
    id,
    imageId: String(c.Image ?? ""),
    exposed: Object.keys(c.Config?.ExposedPorts ?? {}).filter((k) => !k.includes("/") || k.endsWith("/tcp")).map((k) => Number(k.split("/")[0])).filter((n) => n > 0),
    exitCode: c.State?.ExitCode ?? 0,
    error: String(c.State?.Error ?? ""),
    image: String(c.Config?.Image ?? ""),
    running: c.State?.Running !== false,
    env,
    labels: c.Config?.Labels ?? {},
    nets,
    hostNet: c.HostConfig?.NetworkMode === "host" || nets.includes("host"),
    sharedNs: String(c.HostConfig?.NetworkMode ?? "").startsWith("container:"),
    restart: h.RestartPolicy?.Name === "on-failure" && h.RestartPolicy.MaximumRetryCount ? `on-failure:${h.RestartPolicy.MaximumRetryCount}` : h.RestartPolicy?.Name ?? "",
    ports,
    mounts: (c.Mounts ?? []).map((m) => {
      const dest = String(m.Destination ?? "");
      const from = m.Type === "volume" ? m.Name : m.Type === "bind" ? m.Source : null;
      return { dest, spec: from ? `${from}:${dest}${m.RW === false ? ":ro" : ""}` : null, source: String(from ?? ""), type: String(m.Type ?? "") };
    }),
    extras: [...new Set(extras)],
    keep: { image: String(c.Config?.Image ?? ""), imageId: c.Image, Cmd: c.Config?.Cmd, Entrypoint: c.Config?.Entrypoint, User: c.Config?.User, WorkingDir: c.Config?.WorkingDir, Healthcheck: c.Config?.Healthcheck },
  };
}

const hostOf = (addr: string) => addr.replace(/^[A-Z_]+:\/\//i, "").replace(/:\d+$/, "");
const portOf = (addr: string) => Number(/:(\d+)$/.exec(addr)?.[1] ?? 0);
const entries = (list = "") => list.split(",").map((s) => s.trim()).filter(Boolean);

// How other containers reach this broker: an address, or null when it hands out localhost only.
function brokerAddress(k: App): string | null {
  const adv = k.env.get("KAFKA_ADVERTISED_LISTENERS");
  // With no KAFKA_ variables the image's own config runs, and it advertises localhost:9092.
  if (!adv && ![...k.env.keys()].some((key) => key.startsWith("KAFKA_"))) return null;
  // Without advertised listeners Kafka hands out its listeners; an empty host means the container's own name.
  const list = entries(adv ?? k.env.get("KAFKA_LISTENERS")).filter((e) => !/^CONTROLLER:/i.test(e));
  const good = list.find((e) => !LOCAL_HOST.test(hostOf(e)));
  if (!good) return null;
  const host = hostOf(good);
  return `${host && host !== "0.0.0.0" ? host : k.name}:${portOf(good)}`;
}

// Containers made by compose or Kubernetes come back from their own files; replacing them by hand fights that.
export const owner = (a: App): "compose" | "kubernetes" | null =>
  a.labels["com.docker.compose.project"] ? "compose" : a.labels["io.kubernetes.pod.name"] || a.name.startsWith("k8s_") ? "kubernetes" : null;

// A user network both share, else the broker's own; names only resolve on networks you create.
function networkFor(k: App, ui?: App): string | null {
  const own = k.nets.filter((n) => !DEFAULT_NETS.has(n));
  return own.find((n) => ui?.nets.includes(n)) ?? own[0] ?? null;
}

// Replace a container without losing it if the new one fails: the old one is renamed and stopped, and removed
// only once the new one has started.
// createAs names the network to make when there is no shared one.
function replacement(a: App, net: string | null, env: Env, createAs = "kafka"): Replace {
  const useNet = net ?? createAs;
  const run = ["run", "-d", "--name", a.name, "--network", useNet];
  if (a.restart && a.restart !== "no") run.push("--restart", a.restart);
  for (const [h, i, ip] of a.ports) run.push("-p", ip ? `${ip}:${h}:${i}` : `${h}:${i}`);
  for (const m of a.mounts) if (m.spec) run.push("-v", m.spec);
  for (const [key, v] of env) run.push("-e", `${key}=${v}`);
  run.push(a.image);
  return { name: a.name, createNetwork: net ? undefined : createAs, run, connect: a.nets.filter((x) => !DEFAULT_NETS.has(x) && x !== useNet), keep: a.keep, restart: a.restart || undefined };
}

// The same steps as commands to paste. Every line names the context, since the terminal may point elsewhere.
export function replaceText(ctx: string, r: Replace): string {
  const d = `docker --context ${shellQuote(ctx)}`;
  const n = r.name;
  const pairs: string[] = [];
  const args = r.run.slice(2, -1);
  const show = (flag: string, v: string) => {
    if (/^(--name|-p|--restart)$/.test(flag)) return v;
    const eq = v.indexOf("=");
    return flag === "-e" ? `${v.slice(0, eq)}=${shellQuote(v.slice(eq + 1))}` : shellQuote(v);
  };
  for (let i = 0; i < args.length; i += 2) pairs.push(`${args[i]} ${show(args[i], args[i + 1])}`);
  const head = pairs.filter((p) => /^(--name|--network|--restart|-p) /.test(p)).join(" ");
  const body = pairs.filter((p) => /^(-v|-e) /.test(p)).map((p) => `  ${p} \\`);
  return [
    ...(r.createNetwork ? [`${d} network create ${r.createNetwork}`] : []),
    `${d} rename ${n} ${n}-old && ${r.restart && r.restart !== "no" ? `${d} update --restart no ${n}-old && ` : ""}${d} stop ${n}-old && \\`,
    `${d} run -d ${head} \\`,
    ...body,
    `  ${r.run[r.run.length - 1]} && \\`,
    ...r.connect.map((x) => `${d} network connect ${shellQuote(x)} ${n} && \\`),
    `${d} rm ${n}-old`,
  ].join("\n");
}

// What the app's backend accepts for a run it does itself: named volumes, or folders in the Mac home that are not
// hidden or in ~/Library (src-tauri run_source_ok). Anything else stays copy-only.
const VOLUME_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;
const homeFolder = (p: string) => /^\/Users\/[^/]+\/./.test(p) && p.split("/").slice(3).every((c) => c && !c.startsWith(".")) && !/^\/Users\/[^/]+\/library(\/|$)/i.test(p) && !p.includes(":");
const badMounts = (a: App) => a.mounts.some((m) => !m.spec || !(VOLUME_NAME.test(m.source) || homeFolder(m.source)));
const appCanRun = (a: App) => !badMounts(a) && a.extras.length === 0;
// Why the app leaves it to the commands, in the user's words.
const whyCopy = (a: App) =>
  a.extras.length ? ` ${a.name} also uses ${a.extras.join(", ")}, which Fix can't carry over, so run the commands and add ${a.extras.length > 1 ? "those" : "that"} back.` : badMounts(a) ? ` ${a.name} has a mount the app can't recreate, so use the commands.` : "";

const undo = (n: string) => `The old one is kept as ${n}-old until the new one starts. If it doesn't, rename ${n}-old back and start it.`;

const logDir = (k: App) => entries(k.env.get("KAFKA_LOG_DIRS"))[0] ?? DEFAULT_LOG_DIR;
const keepsTopics = (k: App) => k.mounts.some((m) => m.spec && (logDir(k) === m.dest || logDir(k).startsWith(`${m.dest}/`)));

// A full single-node setup: once any KAFKA_ variable is given, none of the image defaults apply.
// Settings the user added (heap, retention, TZ...) are kept; only the listener setup is replaced.
function brokerEnv(k: App, hostPort: string): Env {
  const id = k.env.get("KAFKA_NODE_ID") ?? "1";
  const setup: Env = [
    ["KAFKA_NODE_ID", id],
    ["CLUSTER_ID", k.env.get("CLUSTER_ID") ?? DEFAULT_CLUSTER_ID],
    ["KAFKA_PROCESS_ROLES", "broker,controller"],
    ["KAFKA_LISTENERS", "CONTROLLER://:9093,PLAINTEXT_HOST://:9092,PLAINTEXT://:19092"],
    ["KAFKA_ADVERTISED_LISTENERS", `PLAINTEXT_HOST://localhost:${hostPort},PLAINTEXT://${k.name}:19092`],
    ["KAFKA_LISTENER_SECURITY_PROTOCOL_MAP", "CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT"],
    ["KAFKA_CONTROLLER_QUORUM_VOTERS", `${id}@${k.name}:9093`],
    ["KAFKA_INTER_BROKER_LISTENER_NAME", "PLAINTEXT"],
    ["KAFKA_CONTROLLER_LISTENER_NAMES", "CONTROLLER"],
    ["KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR", "1"],
    ["KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR", "1"],
    ["KAFKA_TRANSACTION_STATE_LOG_MIN_ISR", "1"],
    ["KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS", "0"],
    ["KAFKA_LOG_DIRS", logDir(k)],
  ];
  const ours = new Set(setup.map(([key]) => key));
  return [...setup, ...[...k.env].filter(([key]) => !ours.has(key) && !IMAGE_ENV.test(key))];
}

// For compose: the lines for the service's `environment:` and the command that applies them.
function composeFix(a: App, env: Env): { label: string; text: string } {
  const service = a.labels["com.docker.compose.service"] ?? a.name;
  const dir = a.labels["com.docker.compose.project.working_dir"];
  return {
    label: `Change the ${service} service`,
    text: ["environment:", ...env.map(([key, v]) => `  ${key}: ${JSON.stringify(v)}`), "", `${dir ? `cd ${shellQuote(dir)} && ` : ""}docker compose up -d ${service}`].join("\n"),
  };
}

// The fix and its last sentence, by who owns the container. `before` are replacements that must happen first.
const confirmText = (names: string[], loses: string[]) =>
  `Replace ${names.join(" and ")}?${loses.length ? ` ${loses.join(" and ")} will start with no topics.` : ""}\n${names.length > 1 ? "Each is" : "It is"} stopped and started again with the fixed settings. If a new one doesn't stay up, the old one is put back. Files saved inside the container, not in a volume, don't carry over.`;

export function fixFor(ctx: string, a: App, net: string | null, env: Env, changed: Env, before: Replace[] | null = [], loses: string[] = [], createAs = "kafka"): { tail: string; fix?: Problem["fix"] } {
  const who = owner(a);
  if (who === "kubernetes") return { tail: " It belongs to a Kubernetes pod, so change the pod's settings rather than the container." };
  if (who === "compose") return { tail: " Set these in its service in the compose file, then apply it.", fix: composeFix(a, changed) };
  const r = replacement(a, net, env, createAs);
  // `before` is null when an earlier fix can't be done by the app; then this one is copy-only too.
  const steps = before && appCanRun(a) ? [...before, r] : undefined;
  const confirm = steps && confirmText(steps.map((x) => x.name), loses);
  const tail = appCanRun(a) ? " Fix replaces it with the same image, ports, volumes, networks, restart policy and environment." : whyCopy(a);
  return { tail, fix: { label: `Replace ${a.name}`, text: replaceText(ctx, r), note: undo(a.name), steps, confirm } };
}

// Problems keyed by container name, for running containers whose setup can't work.
export function appProblems(raw: unknown[], ctx = "colima"): Map<string, Problem[]> {
  const apps = raw.map((c) => toApp(c as Inspect)).filter((a) => a.running);
  const brokers = apps.filter((a) => APACHE_KAFKA.test(a.image));
  const uis = apps.filter((a) => KAFKA_UI.test(a.image));
  const out = new Map<string, Problem[]>();
  const add = (name: string, p: Problem) => out.set(name, [...(out.get(name) ?? []), p]);

  const brokerSteps = new Map<string, Replace[] | null>();
  const brokerLoses = new Set<string>();
  for (const k of brokers) {
    // Only a problem when something on a container network wants to use it.
    const clients = apps.some((a) => a !== k && !a.hostNet && (KAFKA_UI.test(a.image) || [...a.env.keys()].some((key) => /BOOTSTRAP/i.test(key))));
    if (!clients || k.hostNet || brokerAddress(k)) continue;
    // Published ports stay as they were; the Mac address is advertised either way, so publishing 9092 later just works.
    const hostPort = k.ports.find(([, i]) => i === "9092")?.[0] ?? "9092";
    const env = brokerEnv(k, hostPort);
    const loses = keepsTopics(k) ? [] : [k.name];
    const { tail, fix } = fixFor(ctx, k, networkFor(k, uis[0]), env, env, [], loses);
    brokerSteps.set(k.name, fix?.steps ?? null);
    if (loses.length) brokerLoses.add(k.name);
    const lost = loses.length ? " Its topics are stored inside the container, not in a volume, so the new one starts with no topics." : "";
    add(k.name, {
      id: "kafka-localhost",
      level: "warn",
      title: "Other containers can't use this Kafka",
      short: "Only reachable from your Mac",
      detail: `${k.name} tells every client to connect to \`localhost:${hostPort}\`. That works from your Mac, but inside another container localhost is that container. It needs a second address for containers, \`${k.name}:19092\`.${lost}${tail}`,
      fix,
    });
  }

  for (const ui of uis) {
    if (ui.hostNet) continue; // there, localhost is the VM, where the published ports are
    const clusters = [...ui.env].filter(([key]) => BOOTSTRAP_KEY.test(key));
    const fromFile = [...ui.env.keys()].some((key) => CONFIG_FILE_KEY.test(key)) || ui.mounts.some((m) => m.dest.startsWith("/etc/kafkaui"));
    const local = clusters.find(([, v]) => entries(v).some((s) => LOCAL_HOST.test(hostOf(s))));
    // With dynamic config on, clusters are added in Kafka UI's own page.
    const empty = clusters.length === 0 && !fromFile && ui.env.get("DYNAMIC_CONFIG_ENABLED") !== "true";
    if (!empty && !local) continue;

    const base = empty
      ? { id: "kafka-ui-empty" as const, title: "Kafka UI has no Kafka cluster set up", short: "No Kafka set up", what: `${ui.name} was started without \`KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS\`, so it shows "No clusters found".` }
      : { id: "kafka-ui-localhost" as const, title: "Kafka UI looks for Kafka inside its own container", short: "Can't reach Kafka", what: `\`${local![0]}\` is \`${local![1]}\`. Inside a container, localhost is the container itself, not your Mac or another container.` };
    const { what, ...head } = base;
    const k = brokers.find((b) => b.nets.some((n) => ui.nets.includes(n))) ?? brokers[0];
    if (!k) {
      // No Kafka container: it most likely runs on the Mac, which containers reach as host.docker.internal.
      add(ui.name, { ...head, level: "bad", detail: `${what} No Kafka container is running here. If Kafka runs on your Mac, point Kafka UI at host.docker.internal:9092.` });
      continue;
    }
    const bootstrap = brokerAddress(k) ?? `${k.name}:19092`;
    // Keep everything the user set; only the missing or broken cluster address changes.
    const key = local?.[0] ?? "KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS";
    const changed: Env = empty ? [["KAFKA_CLUSTERS_0_NAME", "local"], [key, bootstrap]] : [[key, bootstrap]];
    const env: Env = [...(empty ? changed : []), ...[...ui.env].filter(([k2]) => !IMAGE_ENV.test(k2)).map(([k2, v]): [string, string] => [k2, k2 === key ? bootstrap : v])];
    // Kafka UI can only reach a fixed broker, so its Fix does the broker first when that is needed.
    const before = brokerAddress(k) ? [] : brokerSteps.get(k.name) ?? null;
    const { tail, fix } = fixFor(ctx, ui, networkFor(k, ui), env, changed, before, before?.length && brokerLoses.has(k.name) ? [k.name] : []);
    const both = !brokerAddress(k) && fix?.steps && fix.steps.length > 1;
    const first = brokerAddress(k) || both ? "" : ` Fix ${k.name} first (see its page).`;
    const how = both ? ` Fix replaces ${k.name} first, then ${ui.name}, each with the same image, ports, volumes, networks, restart policy and environment.` : tail;
    add(ui.name, { ...head, level: "bad", detail: `${what} ${k.name} is the Kafka it should use, at \`${bootstrap}\`.${first}${how}`, fix: fix && both ? { ...fix, label: `Fix ${k.name} and ${ui.name}`, text: [...fix.steps!.map((r) => replaceText(ctx, r))].join("\n\n") } : fix });
  }
  return out;
}

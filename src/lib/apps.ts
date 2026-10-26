// Known-app checks: setups that start fine but can't work, read from `docker inspect` over every container.
// Kafka facts are from the apache/kafka image docs (hub.docker.com/r/apache/kafka, docker/examples in apache/kafka)
// and its /etc/kafka/docker scripts: any KAFKA_ variable replaces all the defaults, the default config advertises
// localhost:9092, and CLUSTER_ID defaults to 5L6g3nShT-eMCtK--X86sw.
import type { Problem } from "./health.ts";
import { shellQuote } from "./composeScan.ts";

type Bind = { HostIp?: string; HostPort?: string }[] | null;
type Inspect = {
  Name?: string;
  State?: { Running?: boolean };
  Config?: { Image?: string; Env?: string[] | null; Labels?: Record<string, string> | null };
  NetworkSettings?: { Ports?: Record<string, Bind> | null; Networks?: Record<string, unknown> | null };
  HostConfig?: { PortBindings?: Record<string, Bind> | null; NetworkMode?: string; RestartPolicy?: { Name?: string } };
  Mounts?: { Type?: string; Name?: string; Source?: string; Destination?: string; RW?: boolean }[] | null;
};

// mounts: where each is mounted, plus the flag that mounts it again (null for one that can't be, like tmpfs).
type App = {
  name: string;
  image: string;
  running: boolean;
  env: Map<string, string>;
  labels: Record<string, string>;
  nets: string[];
  hostNet: boolean;
  restart: string;
  ports: [string, string][];
  mounts: { dest: string; flag: string | null }[];
};
type Env = [string, string][];

const KAFKA_UI = /(^|\/)kafka-ui(:|$)/;
const APACHE_KAFKA = /^(docker\.io\/)?apache\/kafka(-native)?(:|$)/;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/;
const DEFAULT_NETS = new Set(["bridge", "host", "none"]);
// Kafka UI reads its clusters from KAFKA_CLUSTERS_<n>_BOOTSTRAPSERVERS, or from a config file it is given.
const BOOTSTRAP_KEY = /^KAFKA_CLUSTERS_\d+_BOOTSTRAPSERVERS$/;
const CONFIG_FILE_KEY = /^SPRING_CONFIG_(ADDITIONAL[-_])?LOCATION$/;
// Set by the image itself, not by whoever ran it; left out when the container is run again.
const IMAGE_ENV = /^(PATH|HOME|HOSTNAME|LANG|LANGUAGE|LC_ALL|JAVA_HOME|JAVA_VERSION)$/;
const DEFAULT_CLUSTER_ID = "5L6g3nShT-eMCtK--X86sw";
const DEFAULT_LOG_DIR = "/tmp/kraft-combined-logs";

function toApp(c: Inspect): App {
  const env = new Map<string, string>();
  for (const line of c.Config?.Env ?? []) {
    const i = line.indexOf("=");
    if (i > 0) env.set(line.slice(0, i), line.slice(i + 1));
  }
  const bound = c.NetworkSettings?.Ports ?? c.HostConfig?.PortBindings ?? {};
  const ports: [string, string][] = [];
  for (const [key, list] of Object.entries(bound ?? {})) {
    const host = list?.find((b) => b.HostPort)?.HostPort;
    if (host && !ports.some(([h]) => h === host)) ports.push([host, key.split("/")[0]]);
  }
  const nets = Object.keys(c.NetworkSettings?.Networks ?? {});
  return {
    name: String(c.Name ?? "").replace(/^\//, ""),
    image: String(c.Config?.Image ?? ""),
    running: c.State?.Running !== false,
    env,
    labels: c.Config?.Labels ?? {},
    nets,
    hostNet: c.HostConfig?.NetworkMode === "host" || nets.includes("host"),
    restart: c.HostConfig?.RestartPolicy?.Name ?? "",
    ports,
    mounts: (c.Mounts ?? []).map((m) => {
      const dest = String(m.Destination ?? "");
      const from = m.Type === "volume" ? m.Name : m.Type === "bind" ? m.Source : null;
      return { dest, flag: from ? `-v ${shellQuote(`${from}:${dest}${m.RW === false ? ":ro" : ""}`)}` : null };
    }),
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
const owner = (a: App): "compose" | "kubernetes" | null =>
  a.labels["com.docker.compose.project"] ? "compose" : a.labels["io.kubernetes.pod.name"] || a.name.startsWith("k8s_") ? "kubernetes" : null;

// A user network both share, else the broker's own; names only resolve on networks you create.
function networkFor(k: App, ui?: App): string | null {
  const own = k.nets.filter((n) => !DEFAULT_NETS.has(n));
  return own.find((n) => ui?.nets.includes(n)) ?? own[0] ?? null;
}

// Replace a container without losing it if the new one fails: the old one is renamed and stopped, and removed
// only once the new one has started. Every line names the context, since the terminal may point elsewhere.
function replace(ctx: string, a: App, net: string | null, env: Env): string {
  const d = `docker --context ${shellQuote(ctx)}`;
  const n = a.name;
  const useNet = net ?? "kafka";
  const extraNets = a.nets.filter((x) => !DEFAULT_NETS.has(x) && x !== useNet);
  const restart = a.restart && a.restart !== "no" ? ` --restart ${a.restart}` : "";
  return [
    ...(net ? [] : [`${d} network create kafka`]),
    `${d} rename ${n} ${n}-old && ${d} stop ${n}-old && \\`,
    `${d} run -d --name ${n} --network ${shellQuote(useNet)}${restart} ${a.ports.map(([h, i]) => `-p ${h}:${i}`).join(" ")} \\`,
    ...a.mounts.flatMap((m) => (m.flag ? [`  ${m.flag} \\`] : [])),
    ...env.map(([key, v]) => `  -e ${key}=${shellQuote(v)} \\`),
    `  ${a.image} && \\`,
    ...extraNets.map((x) => `${d} network connect ${shellQuote(x)} ${n} && \\`),
    `${d} rm ${n}-old`,
  ].join("\n");
}

const undo = (n: string) => `The old one is kept as ${n}-old until the new one starts. If it doesn't, rename ${n}-old back and start it.`;

const logDir = (k: App) => entries(k.env.get("KAFKA_LOG_DIRS"))[0] ?? DEFAULT_LOG_DIR;
const keepsTopics = (k: App) => k.mounts.some((m) => m.flag && (logDir(k) === m.dest || logDir(k).startsWith(`${m.dest}/`)));

// A full single-node setup: once any KAFKA_ variable is given, none of the image defaults apply.
function brokerEnv(k: App, hostPort: string): Env {
  const id = k.env.get("KAFKA_NODE_ID") ?? "1";
  return [
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

// The fix and its last sentence, by who owns the container.
function fixFor(ctx: string, a: App, net: string | null, env: Env, changed: Env): { tail: string; fix?: Problem["fix"] } {
  const who = owner(a);
  if (who === "kubernetes") return { tail: " It belongs to a Kubernetes pod, so change the pod's settings rather than the container." };
  if (who === "compose") return { tail: " Set these in its service in the compose file, then apply it.", fix: composeFix(a, changed) };
  return { tail: " These commands replace it with the same image, ports and volumes.", fix: { label: `Replace ${a.name}`, text: replace(ctx, a, net, env), note: undo(a.name) } };
}

// Problems keyed by container name, for running containers whose setup can't work.
export function appProblems(raw: unknown[], ctx = "colima"): Map<string, Problem[]> {
  const apps = raw.map((c) => toApp(c as Inspect)).filter((a) => a.running);
  const brokers = apps.filter((a) => APACHE_KAFKA.test(a.image));
  const uis = apps.filter((a) => KAFKA_UI.test(a.image));
  const out = new Map<string, Problem[]>();
  const add = (name: string, p: Problem) => out.set(name, [...(out.get(name) ?? []), p]);

  for (const k of brokers) {
    // Only a problem when something on a container network wants to use it.
    const clients = apps.some((a) => a !== k && !a.hostNet && (KAFKA_UI.test(a.image) || [...a.env.keys()].some((key) => /BOOTSTRAP/i.test(key))));
    if (!clients || k.hostNet || brokerAddress(k)) continue;
    const hostPort = k.ports.find(([, i]) => i === "9092")?.[0] ?? "9092";
    const withPort = k.ports.some(([, i]) => i === "9092") ? k : { ...k, ports: [[hostPort, "9092"], ...k.ports] as [string, string][] };
    const env = brokerEnv(k, hostPort);
    const { tail, fix } = fixFor(ctx, withPort, networkFor(k, uis[0]), env, env);
    const lost = keepsTopics(k) ? "" : " Its topics are stored inside the container, not in a volume, so the new one starts with no topics.";
    add(k.name, {
      id: "kafka-localhost",
      level: "warn",
      title: "Other containers can't use this Kafka",
      short: "Only reachable from your Mac",
      detail: `${k.name} tells every client to connect to localhost:${hostPort}. That works from your Mac, but inside another container localhost is that container. It needs a second address for containers, ${k.name}:19092.${lost}${tail}`,
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
      ? { id: "kafka-ui-empty" as const, title: "Kafka UI has no Kafka cluster set up", short: "No Kafka set up", what: `${ui.name} was started without KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS, so it shows "No clusters found".` }
      : { id: "kafka-ui-localhost" as const, title: "Kafka UI looks for Kafka inside its own container", short: "Can't reach Kafka", what: `${local![0]} is ${local![1]}. Inside a container, localhost is the container itself, not your Mac or another container.` };
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
    const { tail, fix } = fixFor(ctx, ui, networkFor(k, ui), env, changed);
    const first = brokerAddress(k) ? "" : ` Fix ${k.name} first (see its page).`;
    add(ui.name, { ...head, level: "bad", detail: `${what} ${k.name} is the Kafka it should use, at ${bootstrap}.${first}${tail}`, fix });
  }
  return out;
}

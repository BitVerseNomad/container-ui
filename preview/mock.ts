// Simulated backend for the browser preview. Same commands as the Rust side, fake data.
type Ev = { payload: unknown };
const listeners: Record<string, Set<(e: Ev) => void>> = {};
const emit = (name: string, payload: unknown) => listeners[name]?.forEach((cb) => cb({ payload }));
export const listen = async <T,>(name: string, cb: (e: { payload: T }) => void) => {
  (listeners[name] ??= new Set()).add(cb as never);
  return () => void listeners[name].delete(cb as never);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const GB = 1024 ** 3;

type Ctr = { endedAt?: number; ranMs?: number; restart?: string; error?: string; labels?: string; health?: string; healthOut?: string; streak?: number; restarts?: number; exitCode?: number; oom?: boolean; memLimit?: number; networks: string[]; exposed?: number[]; id: string; name: string; image: string; state: string; ports: [number, number][]; mounts: { Type: string; Name?: string; Source: string; Destination: string; RW: boolean }[]; env: string[]; born: number; cpu: number; mem: number };
const now = Date.now();
const db = {
  profiles: [{ name: "default", status: "Running", arch: "aarch64", cpus: 4, memory: 8 * GB, disk: 100 * GB, runtime: "docker", address: "192.168.5.2" }],
  images: [
    { Repository: "acme/orders-api", Tag: "1.4", Size: "210MB", ID: hex(12), CreatedSince: "1 week ago" },
    { Repository: "mysql", Tag: "8", Size: "586MB", ID: hex(12), CreatedSince: "3 weeks ago" },
    { Repository: "nginx", Tag: "latest", Size: "192MB", ID: hex(12), CreatedSince: "2 weeks ago" },
    { Repository: "redis", Tag: "7", Size: "117MB", ID: hex(12), CreatedSince: "5 weeks ago" },
    { Repository: "postgres", Tag: "16", Size: "456MB", ID: hex(12), CreatedSince: "6 weeks ago" },
  ],
  cacheMB: 3400,
  volumes: ["mysql-data", "redis-data", "pgdata-old", "a".repeat(64), "c".repeat(64)],
  networks: ["bridge", "host", "none", "devnet"],
  ctrs: [
    { health: "unhealthy", streak: 5, healthOut: "curl: (7) Failed to connect to localhost port 8080 after 0 ms: Connection refused", networks: ["devnet"], exposed: [8080], id: hex(64), name: "api", image: "acme/billing-api:3.1", state: "running", ports: [], mounts: [], env: [], born: now - 3 * 36e5, cpu: 0.6, mem: 150e6 },
    { restarts: 7, networks: ["devnet"], id: hex(64), name: "worker", image: "acme/worker:2.0", state: "running", ports: [], mounts: [], env: [], born: now - 6e5, cpu: 3.2, mem: 90e6 },
    // &limit=1: report-job has its own 256 MiB limit (mem_limit) and hit it, so a bigger VM is no help.
    { ...(typeof location !== "undefined" && new URLSearchParams(location.search).get("limit") === "1" ? { memLimit: 256 * 1024 ** 2 } : {}), exitCode: 137, oom: true, networks: ["devnet"], id: hex(64), name: "report-job", image: "acme/report:0.9", state: "exited", ports: [], mounts: [], env: [], born: now - 2 * 36e5, cpu: 0, mem: 0 },
    { networks: ["devnet"], exposed: [9092, 9093], id: hex(64), name: "kafka", image: "apache/kafka:latest", state: "running", ports: [], mounts: [], env: [], born: now - 5e6, cpu: 1.1, mem: 420e6 },
    { networks: ["bridge"], exposed: [8080], id: hex(64), name: "kafka-ui", image: "kafbat/kafka-ui:latest", state: "running", ports: [[8082, 8080]], mounts: [], env: ["KAFKA_CLUSTERS_0_NAME=local", "KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS=localhost:9092"], born: now - 4e6, cpu: 0.4, mem: 310e6 },
    { networks: ["devnet"], exposed: [6379], id: hex(64), name: "queue", image: "redis:7", state: "running", ports: [], mounts: [], env: [], born: now - 7e6, cpu: 0.2, mem: 9e6 },
    { health: "healthy", networks: ["devnet"], id: hex(64), name: "web", image: "nginx:latest", state: "running", ports: [[8080, 80]], mounts: [{ Type: "volume", Name: "c".repeat(64), Source: "/var/lib/docker/volumes/c/_data", Destination: "/cache", RW: true }], env: ["NGINX_VERSION=1.27.2"], born: now - 36e5, cpu: 0.3, mem: 11e6 },
    { networks: ["devnet"], exposed: [3306], id: hex(64), name: "db", image: "mysql:8", state: "running", ports: [[3306, 3306]], mounts: [{ Type: "volume", Name: "mysql-data", Source: "/var/lib/docker/volumes/mysql-data/_data", Destination: "/var/lib/mysql", RW: true }], env: ["MYSQL_ROOT_PASSWORD=dev"], born: now - 864e5, cpu: 1.8, mem: 380e6 },
    { networks: ["devnet"], exposed: [6379], id: hex(64), name: "cache", image: "redis:7", state: "exited", ports: [], mounts: [], env: [], born: now - 2 * 864e5, cpu: 0, mem: 0 },
  ] as Ctr[],
};
if (typeof location !== "undefined" && new URLSearchParams(location.search).get("scenario") === "two") {
  db.profiles.push({ name: "dev", status: "Stopped", arch: "aarch64", cpus: 2, memory: 2 * GB, disk: 60 * GB, runtime: "docker", address: "" });
}
const HUB = [
  ["nginx", "Official build of Nginx.", 21000, true], ["mysql", "MySQL is a widely used, open-source relational database management system.", 15700, true],
  ["postgres", "The PostgreSQL object-relational database system.", 13500, true], ["redis", "Redis is the world's fastest data platform for caching and vector search.", 12800, true],
  ["hello-world", "Hello World! (an example of minimal Dockerization)", 2400, true], ["bitnami/mysql", "Bitnami container image for MySQL", 120, false],
] as const;

const scenario = typeof location !== "undefined" ? new URLSearchParams(location.search).get("scenario") ?? "running" : "running";
const k8sMode = typeof location !== "undefined" ? new URLSearchParams(location.search).get("k8s") ?? "on" : "on";
let k8sOn = k8sMode === "on" || k8sMode === "nokubectl";
const env: Record<string, any> = {
  kubectl: k8sMode === "nokubectl" ? null : { path: "/opt/homebrew/bin/kubectl", version: "" },
  k9s: { path: "/opt/homebrew/bin/k9s", version: "" },
  brew: scenario === "nobrew" ? null : { path: "/opt/homebrew/bin/brew", version: "4.4.2" },
  colima: ["missing", "partial", "nobrew"].includes(scenario) ? null : { path: "/opt/homebrew/bin/colima", version: "0.8.1" },
  docker: ["missing", "nobrew"].includes(scenario) ? null : { path: "/opt/homebrew/bin/docker", version: "27.3.1" },
};
// Containers started by `docker compose up` in ~/code/shop; kafka and kafka-ui were run by hand.
const SHOP = new Set(["api", "worker", "report-job", "web", "db", "queue", "cache"]);
// What Compose v2 writes on each container: api needs a healthy db, worker needs queue, web needs api.
const labelsOf = (c: Ctr) => c.labels ?? (SHOP.has(c.name) ? `com.docker.compose.project=shop,com.docker.compose.project.working_dir=/Users/me/code/shop,com.docker.compose.project.config_files=/Users/me/code/shop/compose.yaml,com.docker.compose.service=${c.name}${SHOP_DEPS[c.name] ? `,com.docker.compose.depends_on=${SHOP_DEPS[c.name]}` : ""}` : "");
const labelObject = (c: Ctr) => Object.fromEntries(labelsOf(c).split(",").filter(Boolean).map((kv) => [kv.slice(0, kv.indexOf("=")), kv.slice(kv.indexOf("=") + 1)]));
// When the last run ended: a stop records it; an exited container that came that way ended an hour ago (cache: a Redis
// that ran two days and was stopped by hand). A running one has docker's "never" time.
const finishedAt = (c: Ctr) => (c.state !== "exited" ? "0001-01-01T00:00:00Z" : new Date(c.endedAt ?? (c.ranMs !== undefined ? c.born + c.ranMs : Date.now() - 36e5)).toISOString());
const SHOP_DEPS: Record<string, string> = { api: "db:service_healthy:false", worker: "queue:service_started:false", web: "api:service_started:false" };
// Setup check: healthy by default; "desktop" is what a Mac looks like right after Docker Desktop is removed.
const BREW_PLUGINS = "/opt/homebrew/lib/docker/cli-plugins";
const deadLink = (name: string) => ({ name, target: `/Applications/Docker.app/Contents/Resources/cli-plugins/${name}`, broken: true });
const setup = scenario === "desktop"
  ? { plugins: [deadLink("docker-buildx"), deadLink("docker-compose"), deadLink("docker-scout")], brew_plugin_dir: BREW_PLUGINS, brew_plugins: ["docker-compose"], extra_dirs: [] as string[], creds_store: "desktop" as string | null, creds_helper_found: false, contexts: [{ name: "colima", current: false }, { name: "desktop-linux", current: true }], autostart: "none", testcontainers_host: "unix:///Users/me/.docker/run/docker.sock" as string | null, testcontainers_override: false, shell_profile: "~/.zshrc", docker_desktop_installed: false, docker_desktop_data: true }
  : { plugins: [] as { name: string; target: string; broken: boolean }[], brew_plugin_dir: BREW_PLUGINS, brew_plugins: ["docker-buildx", "docker-compose"], extra_dirs: [BREW_PLUGINS], creds_store: null as string | null, creds_helper_found: true, contexts: [{ name: "colima", current: true }], autostart: "started", testcontainers_host: null as string | null, testcontainers_override: true, shell_profile: "~/.zshrc", docker_desktop_installed: false, docker_desktop_data: false };
// Right after Docker Desktop, the VM is still Colima's default size, and Compose gave db and queue a restart setting.
// resize=fail: the bigger size doesn't fit in the Mac's free memory, so the restart fails and leaves the VM stopped.
const resize = typeof location !== "undefined" ? new URLSearchParams(location.search).get("resize") : null;
let startFail = typeof location !== "undefined" && new URLSearchParams(location.search).get("start") === "fail";
if (scenario === "desktop") {
  Object.assign(db.profiles[0], { cpus: 2, memory: 2 * GB });
  const policy: Record<string, string> = { db: "unless-stopped", queue: "always", worker: "on-failure" };
  db.ctrs.forEach((c) => { c.restart = policy[c.name]; });
  // pods=1: Kubernetes runs a pod too; it comes back on its own after a restart.
  if (new URLSearchParams(location.search).get("pods") === "1") db.ctrs.push({ restart: "always", labels: "io.kubernetes.pod.name=coredns-6799fbcd5-xk2p8,io.kubernetes.pod.namespace=kube-system", networks: [], id: hex(64), name: "k8s_coredns_coredns-6799fbcd5-xk2p8_kube-system_0", image: "rancher/mirrored-coredns-coredns:1.11.3", state: "running", ports: [], mounts: [], env: [], born: now - 36e5, cpu: 0.1, mem: 20e6 });
}
if (scenario === "mismatch") setup.contexts = [{ name: "colima", current: false }, { name: "colima-work", current: true }];
// Kubernetes on the docker runtime: each pod shows up as k8s_ containers that the cluster owns.
if (scenario === "k8spods") {
  const podLabels = "io.kubernetes.pod.name=coredns-6799fbcd5-xk2p8,io.kubernetes.pod.namespace=kube-system";
  db.ctrs.push(
    { labels: podLabels, networks: [], id: hex(64), name: "k8s_coredns_coredns-6799fbcd5-xk2p8_kube-system_0", image: "rancher/mirrored-coredns-coredns:1.11.3", state: "running", ports: [], mounts: [], env: [], born: now - 36e5, cpu: 0.1, mem: 20e6 },
    { labels: podLabels, networks: [], id: hex(64), name: "k8s_POD_coredns-6799fbcd5-xk2p8_kube-system_0", image: "rancher/mirrored-pause:3.6", state: "running", ports: [], mounts: [], env: [], born: now - 36e5, cpu: 0, mem: 1e6 },
  );
}
if (scenario === "doctor") db.ctrs.push(
  { networks: ["devnet"], exposed: [8080], id: hex(64), name: "orders", image: "acme/orders-api:1.4", state: "running", ports: [], mounts: [], env: ["DATABASE_URL=mysql://root@localhost:3306/orders"], born: now - 9e5, cpu: 0.7, mem: 120e6 },
  { networks: ["bridge"], id: hex(64), name: "billing", image: "acme/billing:2.0", state: "running", ports: [], mounts: [], env: ["REDIS_HOST=sessions"], born: now - 8e5, cpu: 0.3, mem: 60e6 },
  { networks: ["bridge"], exposed: [6379], id: hex(64), name: "sessions", image: "redis:7", state: "running", ports: [], mounts: [], env: [], born: now - 8e5, cpu: 0.1, mem: 8e6 },
  { networks: ["devnet"], exposed: [5432], exitCode: 1, id: hex(64), name: "pg", image: "postgres:16", state: "exited", ports: [], mounts: [], env: [], born: now - 7e5, cpu: 0, mem: 0 },
);
// Mounts and network (round 35). Flags, each its own picture:
// &unshared=1: the profile shares only ~/work, and web binds ~/code/web (an empty folder in the VM).
// &rofs=1: the profile shares ~/code read-only, and importer writes to ~/code/docs.
// &bind=1: web binds ~/code/web, which the default profile shares (home). &flowmounts=1: colima.yaml lists its folders in a
// style the app doesn't read. &sshfs=1: folders are shared with sshfs on a vz VM. &dns=1 / &vpn=1: the VM can't look up names (vpn: a tunnel is up).
// &missing=1: that folder is on a disk the Mac no longer has, so the backend refuses before it stops anything.
// &proxy=1: the Mac has a system proxy the VM doesn't. &pullfail=1: an image pull times out (the proxy line shows only after one).
// &vmfail=1: a start with a folder the profile did not have fails (the new list stays saved, as Colima does); starting
// with the folders it had works. &stuckdns=1 (with &dns=1): a restart does not fix the name lookup.
const flag = (k: string) => typeof location !== "undefined" && new URLSearchParams(location.search).get(k) === "1";
const cfgMock = { mountType: flag("sshfs") ? "sshfs" : "virtiofs", mounts: [] as { path: string; writable: boolean }[], env: {} as Record<string, string> };
let dnsBroken = flag("dns") || flag("vpn");

if (flag("unshared")) {
  cfgMock.mounts = [{ path: "/Users/me/work", writable: true }];
  const web = db.ctrs.find((c) => c.name === "web")!;
  web.mounts = [...web.mounts, { Type: "bind", Source: flag("missing") ? "/Volumes/missing" : "/Users/me/code/web", Destination: "/usr/share/nginx/html", RW: true }];
}
if (flag("bind")) {
  const web = db.ctrs.find((c) => c.name === "web")!;
  web.mounts = [...web.mounts, { Type: "bind", Source: "/Users/me/code/web", Destination: "/usr/share/nginx/html", RW: true }];
}
if (flag("rofs")) {
  cfgMock.mounts = [{ path: "/Users/me/code", writable: false }];
  db.ctrs.push({ networks: ["devnet"], id: hex(64), name: "importer", image: "acme/importer:1.0", state: "running", ports: [], mounts: [{ Type: "bind", Source: "/Users/me/code/docs", Destination: "/out", RW: true }], env: [], born: now - 6e5, cpu: 0.1, mem: 30e6, restart: "always" });
}
// The folders the profile had when the page loaded: a start with these works even when `vmfail` is on.
const startedWith = JSON.stringify(cfgMock.mounts);
if (scenario === "nonet") { db.networks = ["bridge", "host", "none"]; db.ctrs.forEach((c) => { c.networks = ["bridge"]; }); }
// empty=1: no containers yet, as on the first day after switching (with scenario=desktop: Docker Desktop's data is still there).
// brought=1: an earlier run already brought the data over.
if (typeof location !== "undefined" && new URLSearchParams(location.search).get("empty") === "1") db.ctrs = [];
if (typeof location !== "undefined" && new URLSearchParams(location.search).get("brought") === "1") { try { localStorage.setItem("colima-ui.broughtOver", "1"); } catch { /* the preview just shows the offer */ } }
if (["stopped", "failed", "stuck"].includes(scenario)) db.profiles[0].status = "Stopped";
if (["none", "missing", "partial", "nobrew"].includes(scenario)) db.profiles = [];
const ipOf = (c: Ctr, net: string) => `172.${net === "bridge" ? 17 : 18 + Math.max(0, db.networks.indexOf(net) - 3)}.0.${2 + db.ctrs.indexOf(c)}`;
// A check can make the next `docker run` of one container fail, to see Fix put the old one back.
let failRun: string | null = null;
// A name wins over an id prefix: a random hex id can start with "db" (that made the resize check flaky).
const find = (id: string) => db.ctrs.find((c) => c.name === id) ?? db.ctrs.find((c) => c.id.startsWith(id));
const lines = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join("\n");
const fmtPorts = (c: Ctr) => c.state === "running" ? [...c.ports.map(([h, p]) => `0.0.0.0:${h}->${p}/tcp`), ...(c.exposed ?? []).filter((e) => !c.ports.some(([, p]) => p === e)).map((e) => `${e}/tcp`)].join(", ") : "";
const status = (c: Ctr) => (c.state === "running" ? `Up 2 hours${c.health ? ` (${c.health === "starting" ? "health: starting" : c.health})` : ""}` : c.state === "paused" ? "Up 2 hours (Paused)" : `Exited (${c.exitCode ?? 0}) 3 hours ago`);
// worker crash-loops (7 restarts), so its logs say why; the rest look healthy.
const logLines = (c: Ctr) => c.name === "importer" && flag("rofs")
  ? ["importer 1.0 starting", "reading /out/queue.csv", "ERROR write /out/report.csv: Read-only file system", "retrying in 5s"]
  : c.image.startsWith("acme/worker")
  ? ["worker 2.0 starting, queue=redis://queue:6379", "connected to queue, waiting for jobs", "job 4182 picked up: resize-images", "ERROR job 4182 failed: open /data/in/4182.png: no such file or directory", "fatal: too many failed jobs in a row, exiting with code 1"]
  : c.image.startsWith("mysql")
  ? ["[Server] /usr/sbin/mysqld (mysqld 8.4.3) starting as process 1", "[Server] InnoDB initialization has started", "[Server] InnoDB initialization has ended", "[Server] X Plugin ready for connections. Bind-address: '::' port: 33060", "[Server] ready for connections. Version: '8.4.3'  port: 3306"]
  : ["/docker-entrypoint.sh: Configuration complete; ready for start up", `${c.image}: listening on 0.0.0.0:${c.ports[0]?.[1] ?? 80}`, "GET / 200 612 \"curl/8.4.0\"", "GET /favicon.ico 404 153 \"Mozilla/5.0\""];

// `docker system df` rows, computed from the mock state so prune commands lower the numbers.
function dfLines(): string {
  const mb = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}GB` : `${Math.round(n)}MB`);
  const imgMB = (i: { Size: string }) => parseFloat(i.Size);
  const inUse = (i: { Repository: string }) => db.ctrs.some((c) => c.image.startsWith(i.Repository));
  const total = db.images.reduce((n, i) => n + imgMB(i), 0);
  const free = db.images.filter((i) => !inUse(i)).reduce((n, i) => n + imgMB(i), 0);
  const stopped = db.ctrs.filter((c) => c.state === "exited").length;
  return lines([
    { Type: "Images", TotalCount: String(db.images.length), Active: String(db.images.filter(inUse).length), Size: mb(total), Reclaimable: `${mb(free)} (${Math.round((free / (total || 1)) * 100)}%)` },
    { Type: "Containers", TotalCount: String(db.ctrs.length), Active: String(db.ctrs.length - stopped), Size: `${stopped * 12 + 40}MB`, Reclaimable: `${stopped * 12}MB (${Math.round((stopped / (db.ctrs.length || 1)) * 100)}%)` },
    { Type: "Local Volumes", TotalCount: String(db.volumes.length), Active: "1", Size: "1.6GB", Reclaimable: "1.2GB (75%)" },
    { Type: "Build Cache", TotalCount: db.cacheMB ? "87" : "0", Active: "0", Size: mb(db.cacheMB), Reclaimable: mb(db.cacheMB) },
  ]);
}

function dockerCmd(args: string[]): string {
  const [cmd, sub] = args;
  switch (cmd) {
    case "ps": { if (args.includes("-q")) return db.ctrs.map((c) => c.id.slice(0, 12)).join("\n"); const f = args.find((a) => a.startsWith("network="))?.slice(8); return lines(db.ctrs.filter((c) => !f || c.networks.includes(f)).map((c) => ({ ID: c.id.slice(0, 12), Names: c.name, Image: c.image, State: c.state, Status: status(c), Ports: fmtPorts(c), Mounts: c.mounts.map((m) => m.Name ?? m.Source).join(","), Labels: labelsOf(c) }))) }
    case "images": return lines(db.images);
    case "events": {
      const t = Math.floor(Date.now() / 1000);
      const mk = (action: string, name: string, secsAgo: number, attrs: object = {}) => JSON.stringify({ Type: "container", Action: action, Actor: { ID: "x", Attributes: { name, image: "img", ...attrs } }, time: t - secsAgo, timeNano: (t - secsAgo) * 1e9 });
      const all = [mk("start", "kafka", 5 * 3600), mk("start", "web", 3 * 3600), mk("start", "api", 3 * 3600), mk("health_status: unhealthy", "api", 20 * 60), mk("die", "worker", 9 * 60 + 5, { exitCode: "1" }), mk("start", "worker", 9 * 60), mk("restart", "worker", 4 * 60), mk("oom", "report-job", 3610), mk("die", "report-job", 3600, { exitCode: "137" }), mk("create", "web", 3 * 3600 + 2)];
      const only = args.find((a) => a.startsWith("container="))?.slice(10);
      return all.filter((l) => !only || JSON.parse(l).Actor.Attributes.name === only).join("\n");
    }
    case "network":
      if (sub === "ls") return lines(db.networks.map((Name) => ({ ID: hex(12), Name, Driver: Name === "host" || Name === "none" ? Name : "bridge", Scope: "local" })));
      if (sub === "create") { db.networks.push(args[2]); return hex(64); }
      if (sub === "inspect") return JSON.stringify(args.slice(2).map((name) => ({ Name: name, Driver: name === "host" || name === "none" ? name : "bridge", IPAM: { Config: name === "bridge" || db.networks.indexOf(name) > 2 ? [{ Subnet: name === "bridge" ? "172.17.0.0/16" : `172.${18 + db.networks.indexOf(name) - 3}.0.0/16` }] : [] }, Containers: Object.fromEntries(db.ctrs.filter((c) => c.state === "running" && c.networks.includes(name)).map((c) => [c.id, { Name: c.name, IPv4Address: `${ipOf(c, name)}/16` }])) })));
      if (sub === "connect") { const c = find(args[3]); if (!c) throw `Error response from daemon: No such container: ${args[3]}`; if (!c.networks.includes(args[2])) c.networks.push(args[2]); return ""; }
      if (sub === "disconnect") { const c = find(args[3])!; c.networks = c.networks.filter((n) => n !== args[2]); return ""; }
      if (sub === "rm") { if (db.ctrs.some((c) => c.networks.includes(args[2]))) throw `Error response from daemon: error while removing network: network ${args[2]} has active endpoints`; db.networks = db.networks.filter((n) => n !== args[2]); return args[2]; }
      throw `mock: unsupported docker network command`;
    case "volume":
      if (sub === "ls") return lines(db.volumes.map((Name) => ({ Name, Driver: "local" })));
      if (sub === "rm") { db.volumes = db.volumes.filter((v) => !args.slice(2).includes(v)); return args.slice(2).join("\n"); }
      db.volumes = db.volumes.filter((v) => db.ctrs.some((c) => c.mounts.some((m) => m.Name === v))); return "Total reclaimed space: 0B";
    case "builder": db.cacheMB = 0; return "Total:\t3.4GB";
    case "container": db.ctrs = db.ctrs.filter((c) => c.state !== "exited"); return "Total reclaimed space: 12MB";
    case "search": return lines(HUB.filter((h) => h[0].includes(args[args.length - 4] ?? "") || h[0].includes(args[3] ?? "")).map(([Name, Description, s, o]) => ({ Name, Description, StarCount: String(s), IsOfficial: o ? "[OK]" : "" })));
    case "image":
      if (sub === "inspect" && !args.includes("--format")) {
        const ref = args[args.length - 1]; const known: Record<string, object> = {
          "acme/orders-api:1.4": { Architecture: "amd64", Config: { Env: ["APP_ENV=production", "PORT=8080"], ExposedPorts: { "8080/tcp": {} }, Volumes: { "/data": {} }, Labels: { "org.opencontainers.image.documentation": "https://acme.example/docs/orders", "org.opencontainers.image.source": "https://github.com/acme/orders-api" } } },
          "mysql:8": { Architecture: "arm64", Config: { Env: ["MYSQL_MAJOR=8.4"], ExposedPorts: { "3306/tcp": {}, "33060/tcp": {} }, Volumes: { "/var/lib/mysql": {} }, Labels: null } },
          "redis:7": { Architecture: "arm64", Config: { Env: null, ExposedPorts: { "6379/tcp": {} }, Volumes: { "/data": {} }, Labels: {} } },
          "nginx:latest": { Architecture: "arm64", Config: { Env: ["NGINX_VERSION=1.27.2"], ExposedPorts: { "80/tcp": {} }, Volumes: null, Labels: { maintainer: "NGINX Docker Maintainers" } } },
        };
        const refs = args.slice(2).filter((a) => !a.startsWith("-"));
        return JSON.stringify((refs.length ? refs : [ref]).map((r) => { const tag = r.replace(/^sha256:/, ""); return { Id: `sha256:${tag}`, Os: "linux", ...(known[tag] ?? { Architecture: "arm64", Config: { Env: null, ExposedPorts: null, Volumes: null, Labels: {} } }) }; }));
      }
      if (sub === "inspect") return /mysql/.test(args[args.length - 1]) ? '{"3306/tcp":{},"33060/tcp":{}}' : /nginx/.test(args[args.length - 1]) ? '{"80/tcp":{}}' : "null";
      { const kept = db.images.filter((i) => db.ctrs.some((c) => c.image.startsWith(i.Repository))); const freed = db.images.filter((i) => !kept.includes(i)).reduce((n, i) => n + parseFloat(i.Size), 0); db.images = kept; return `Total reclaimed space: ${Math.round(freed)}MB`; }
    case "rmi": {
      const img = db.images.find((i) => `${i.Repository}:${i.Tag}` === args[1] || i.ID === args[1]);
      const user = img && db.ctrs.find((c) => c.image.startsWith(img.Repository));
      if (user) throw `Error response from daemon: conflict: unable to remove repository reference "${args[1]}" (must force) - container ${user.id.slice(0, 12)} is using its referenced image`;
      db.images = db.images.filter((i) => i !== img); return `Untagged: ${args[1]}`;
    }
    case "logs": { if (args.includes("--since") && !args.includes("--until")) return "" as T; const c = find(args[args.length - 1])!; const t = new Date().toISOString(); const base = logLines(c); return Array.from({ length: 160 }, (_, i) => `${t.slice(0, 17)}${String(i % 60).padStart(2, "0")}Z ${base[i % base.length]}`).join("\n") + "\n"; }
    case "rename": { const c = find(args[1]); if (!c) throw `Error response from daemon: No such container: ${args[1]}`; c.name = args[2]; return ""; }
    // &bind=1: Colima's shop_db is a folder on the Mac (a local volume with o=bind), which is never replaced.
    case "inspect": if (args[1] === "--type" && args[2] === "volume") { const bind = ddParam("bind"); return JSON.stringify(args.slice(3).filter((n) => db.volumes.includes(n)).map((Name) => ({ Name, Driver: "local", Labels: {}, Options: bind && Name === "shop_db" ? { device: "/Users/me/code/shop/data", o: "bind", type: "none" } : null }))); }
      if (args.includes("--format")) { const ref = args[args.length - 1]; const c = find(ref); if (!c) throw `Error: No such object: ${ref}`; return args[args.indexOf("--format") + 1] === "{{.Name}}" ? `/${c.name}\n` : `${c.state === "running"} ${c.restarts ?? 0} \n`; }
    { const many = args.slice(1).map((i) => find(i)!).filter(Boolean); return JSON.stringify(many.map((c) => ({ Id: c.id, Image: `sha256:${c.image}`, Name: `/${c.name}`, Created: new Date(c.born).toISOString(), Path: c.image.startsWith("mysql") ? "docker-entrypoint.sh" : "/docker-entrypoint.sh", Args: ["mysqld"], State: { Status: c.state, Running: c.state !== "exited", Paused: c.state === "paused", ExitCode: c.exitCode ?? 0, Error: c.error ?? "", OOMKilled: !!c.oom, StartedAt: new Date(c.born).toISOString(), FinishedAt: finishedAt(c), ...(c.health ? { Health: { Status: c.health, FailingStreak: c.streak ?? 0, Log: c.healthOut ? [{ ExitCode: 1, Output: c.healthOut }] : [] } } : {}) }, RestartCount: c.restarts ?? 0, Config: { ...(c.health ? { Healthcheck: { Test: ["CMD-SHELL", "curl -f localhost"] } } : {}), Labels: labelObject(c), Image: c.image, Env: c.env, ExposedPorts: Object.fromEntries([...c.ports.map(([, p]) => p), ...(c.exposed ?? [])].map((p) => [`${p}/tcp`, {}])) }, HostConfig: { Memory: c.memLimit ?? 0, NetworkMode: c.networks[0] ?? "bridge", RestartPolicy: { Name: c.restart ?? "no" }, PortBindings: Object.fromEntries(c.ports.map(([h, p]) => [`${p}/tcp`, [{ HostIp: "", HostPort: String(h) }]])) }, NetworkSettings: { Ports: Object.fromEntries(c.ports.map(([h, p]) => [`${p}/tcp`, [{ HostIp: "0.0.0.0", HostPort: String(h) }]])), Networks: Object.fromEntries(c.networks.map((n) => [n, { IPAddress: ipOf(c, n), Aliases: n === "bridge" ? null : [c.name, c.id.slice(0, 12)] }])) }, Mounts: c.mounts }))); }
    case "system": if (args.includes("-v")) { if (++colimaDfReads > growAfter) colimaSizes.shop_db = "315MB"; const sz: Record<string, string> = { "mysql-data": "412MB", "redis-data": "18MB", "pgdata-old": "1.2GB", ...colimaSizes }; return JSON.stringify({ Images: [], Containers: [], BuildCache: [], Volumes: db.volumes.map((Name) => ({ Name, Links: db.ctrs.filter((c) => c.mounts.some((x) => x.Name === Name)).length, Size: sz[Name] ?? (Name.startsWith("a") ? "36B" : "4kB") })) }); } return dfLines();
    case "stats": {
      if (args[args.length - 1] === "--no-stream") return lines(db.ctrs.filter((c) => c.state === "running").map((c) => ({ Name: c.name, CPUPerc: `${c.cpu.toFixed(2)}%`, MemUsage: `${(c.mem / 2 ** 20).toFixed(1)}MiB / 7.7GiB` }))); const c = find(args[args.length - 1])!; c.cpu = Math.max(0.1, c.cpu + (Math.random() - 0.45)); return lines([{ CPUPerc: `${c.cpu.toFixed(2)}%`, MemUsage: `${(c.mem / 2 ** 20).toFixed(1)}MiB / 7.7GiB`, NetIO: "1.2kB / 648B", BlockIO: "0B / 4.1kB", PIDs: "29" }]); }
    case "start": case "stop": case "restart": case "pause": case "unpause": {
      if (cmd === "start") { ((window as any).__dockerStarted ??= []).push(args.slice(1)); ((window as any).__dbHealthAtStart ??= []).push(db.ctrs.find((c) => c.name === "db")?.health ?? null); }
      // &oomfail=1: report-job won't start even on the bigger VM.
      // In a wave with others, docker starts the others and names report-job on its last line.
      const noMem = cmd === "start" && !!ddParam("oomfail") && args.includes("report-job");
      // start=fail: web's port is taken, once. docker starts the others and names the one it couldn't on its last line.
      const blocked = cmd === "start" && startFail && args.includes("web");
      const cs = args.slice(1).map((x) => find(x)!).filter((c) => !(blocked && c.name === "web") && !(noMem && c.name === "report-job"));
      for (const c of cs) { c.state = cmd === "stop" ? "exited" : cmd === "pause" ? "paused" : "running"; if (cmd === "stop") c.endedAt = Date.now(); else if (cmd !== "pause") { c.born = Date.now(); c.endedAt = undefined; c.oom = false; c.exitCode = 0; } }
      // db has a health check: it reports healthy a moment after it starts.
      if (cmd === "start") cs.filter((c) => c.name === "db").forEach((c) => { c.health = "starting"; setTimeout(() => { c.health = "healthy"; }, 700); });
      if (blocked) { startFail = false; throw "Error response from daemon: driver failed programming external connectivity on endpoint shop-web-1: Bind for 0.0.0.0:8080 failed: port is already allocated\nError: failed to start containers: web"; }
      if (noMem) throw "Error response from daemon: failed to create task for container: failed to create shim task: OCI runtime create failed: runc create failed: unable to start container process: error during container init: cannot allocate memory\nError: failed to start containers: report-job";
      return cs.map((c) => c.id).join("\n"); }
    case "rm": { const gone = args.slice(1).filter((a) => !a.startsWith("-")).map((x) => find(x)); db.ctrs = db.ctrs.filter((c) => !gone.includes(c)); return args.slice(1).filter((a) => !a.startsWith("-")).join("\n"); }
    case "run": {
      const name = args[args.indexOf("--name") + 1]; const image = args[args.length - 1];
      if (failRun === name) { failRun = null; throw `docker: Error response from daemon: failed to create task for container ${name}: simulated`; }
      const net = args[args.indexOf("--network") + 1]; if (args.includes("--network") && !db.networks.includes(net)) throw `docker: Error response from daemon: network ${net} not found`;
      const ports = args.flatMap((a, i) => (args[i - 1] === "-p" ? [a] : [])).map((p) => { const parts = p.split(":"); const cp = Number(parts.pop()); const hp = parts.length ? Number(parts.pop()) : undefined; return [hp ?? NaN, cp]; }) as number[][];
      for (const [h] of ports) if (ports.length && db.ctrs.some((c) => c.state === "running" && c.ports.some(([x]) => x === h))) throw `docker: Error response from daemon: driver failed programming external connectivity: Bind for 0.0.0.0:${h} failed: port is already allocated`;
      const c: Ctr = { networks: args.includes("--network") ? [net] : ["bridge"], id: hex(64), name, image: image.includes(":") ? image : `${image}:latest`, state: "running", ports: ports.filter(([h]) => !Number.isNaN(h)).map(([h, p]) => [h, p]), mounts: args.flatMap((a, i) => (args[i - 1] === "-v" ? [{ Type: "bind", Source: a.split(":")[0], Destination: a.split(":")[1], RW: a.split(":")[2] !== "ro" }] : [])), env: args.flatMap((a, i) => (args[i - 1] === "-e" ? [a] : [])), born: Date.now(), cpu: 0.5, mem: 24e6 };
      db.ctrs.push(c); return c.id + "\n";
    }
  }
  throw `mock: unsupported docker command: ${args.join(" ")}`;
}

// Docker Desktop for "Bring them over": ?dd=closed (installed, not open), ?dd=gone (removed, disk left), ?dd=fail (uploads fails), else running.
// ?dd=replace: `compose up` already ran in Colima, so Colima's shop_db is a 12 MB empty one that shop-db-1 runs on.
// ?dd=replacefail: the same, and the copy into it fails midway, so Colima's copy is put back from the backup.
// ?dd=replacebig: Colima's shop_db is 90 MB, bigger than a fresh one, so it is listed but not picked.
// ?dd=morning: the first morning. The same 12 MB shop_db, and shop-db-1 is the shop project's own pg service.
// &grow=1: shop_db fills to 315 MB right after home's read, before the panel reads (a stale "Bring it over…").
// &grow=2: it fills after the panel's list, before the read just ahead of the confirm.
// &later=1: Docker Desktop is closed when the app opens; __mock.openDesktop() opens it.
const dd = typeof location !== "undefined" ? new URLSearchParams(location.search).get("dd") ?? "running" : "running";
const ddParam = (k: string) => typeof location !== "undefined" && new URLSearchParams(location.search).get(k) === "1";
const desktop = { installed: dd !== "gone", running: ["running", "fail", "replace", "replacefail", "replacebig", "morning"].includes(dd) && !ddParam("later"), disk_bytes: 30 * GB };
let colimaDfReads = 0;
const growAfter = typeof location !== "undefined" ? Number(new URLSearchParams(location.search).get("grow") ?? "Infinity") : Infinity;
const colimaSizes: Record<string, string> = {};
if (dd.startsWith("replace") || dd === "morning") {
  db.volumes.push("shop_db");
  colimaSizes.shop_db = dd === "replacebig" ? "90MB" : "12MB";
  const shopPg = dd === "morning" ? { labels: "com.docker.compose.project=shop,com.docker.compose.project.working_dir=/Users/me/code/shop,com.docker.compose.project.config_files=/Users/me/code/shop/compose.yaml,com.docker.compose.service=pg" } : {};
  db.ctrs.push({ ...shopPg, networks: ["bridge"], id: hex(64), name: "shop-db-1", image: "postgres:16", state: "running", ports: [], mounts: [{ Type: "volume", Name: "shop_db", Source: "/var/lib/docker/volumes/shop_db/_data", Destination: "/var/lib/postgresql/data", RW: true }], env: ["POSTGRES_PASSWORD=dev"], born: now - 6e5, cpu: 0.4, mem: 40e6 });
}
// &down2=1: db was stopped too (mysql exits 0 on a stop), so shop has two services that are simply down.
if (ddParam("down2")) db.ctrs.filter((c) => c.name === "db").forEach((c) => { c.state = "exited"; c.endedAt = now - 6e5; });
const ddVolumes: [string, string][] = [["shop_db", "412MB"], ["redis-data", "18MB"], ["uploads", "2.1GB"], ["b".repeat(64), "36B"]];
const ddImages = [{ Repository: "acme/api", Tag: "dev", Size: "1.2GB" }, { Repository: "postgres", Tag: "16", Size: "438MB" }, { Repository: "<none>", Tag: "<none>", Size: "90MB" }];
let stopCopy = false;
const MB = (s: string) => parseFloat(s) * (s.endsWith("GB") ? 1e9 : 1e6);

async function progress(event: string, steps: [string, number][]) { for (const [l, ms] of steps) { await sleep(ms); emit(event, l); } }

export async function invoke<T>(cmd: string, a: Record<string, any> = {}): Promise<T> {
  ((window as any).__calls ??= []).push(cmd);
  (window as any).__mock = { setStatus: (s: string) => { db.profiles[0].status = s; }, state: () => JSON.parse(JSON.stringify(db)), failRunOnce: (name: string) => { failRun = name; }, openDesktop: () => { desktop.running = true; } };
  await sleep(60);
  switch (cmd) {
    case "list_profiles": return db.profiles.map((p) => ({ ...p })) as T; // fresh objects per call, like the real IPC
    case "docker": { const args: string[] = a.args.filter((x: string) => x !== "--format" && x !== "{{json .}}"); const i = a.args.indexOf("--format"); return dockerCmd(i > 0 && (a.args[0] === "image" || (a.args[0] === "inspect" && a.args[i + 1] !== "{{json .}}")) ? a.args : args) as T; }
    case "docker_check": return undefined as T;
    case "desktop_state": return { ...desktop } as T;
    case "open_docker_desktop": if (!desktop.installed) throw "Docker Desktop isn't installed"; setTimeout(() => { desktop.running = true; }, 2500); return undefined as T;
    // &upl=1: a Docker Desktop container also writes to uploads, so picking it asks to stop that container first.
    case "desktop_docker": if (a.args[0] === "ps") return [JSON.stringify({ Names: "shop-db-1", Mounts: "shop_db" }), ...(ddParam("upl") ? [JSON.stringify({ Names: "files-1", Mounts: "uploads" })] : [])].join("\n") as T; return (a.args[0] === "system" ? JSON.stringify({ Images: [], Containers: [], BuildCache: [], Volumes: ddVolumes.map(([Name, Size]) => ({ Name, Size })) }) : ddImages.map((r) => JSON.stringify(r)).join("\n")) as T;
    case "desktop_start": ((window as any).__started ??= []).push(...a.names.map((n: string) => (a.context ? `${a.context}/${n}` : n))); return undefined as T;
    case "desktop_replace": {
      ((window as any).__replaced ??= []).push({ ...a });
      const users = db.ctrs.filter((c) => c.state === "running" && c.mounts.some((m) => m.Name === a.name));
      users.forEach((c) => { c.state = "exited"; });
      const size = MB(ddVolumes.find(([n]) => n === a.name)![1]);
      const back = { backup: a.backup, not_started: [] as string[] };
      let stoppedNow = false;
      const step = async (s: string) => { emit("desktop-step", { name: a.name, step: s }); await sleep(250); };
      await step("backup");
      await step("empty");
      emit("desktop-step", { name: a.name, step: "copy" });
      for (let f = 0.2; f < 1; f += 0.2) {
        await sleep(250);
        if (stopCopy) { stoppedNow = true; break; }
        if (dd === "replacefail" && f > 0.5) break;
        emit("desktop-progress", { name: a.name, bytes: Math.round(size * f) });
      }
      await step(stoppedNow || dd === "replacefail" ? "restore" : "check");
      // Starting a database takes a moment; long enough for the step to be seen.
      if (users.length) { emit("desktop-step", { name: a.name, step: "start" }); await sleep(1500); }
      users.forEach((c) => { c.state = "running"; c.born = Date.now(); });
      if (stoppedNow) return { ...back, ok: false, bytes: 0, colima: "restored", why: "Stopped." } as T;
      if (dd === "replacefail") { db.volumes.push(a.backup); colimaSizes[a.backup] = colimaSizes[a.name]; }
      if (dd === "replacefail") return { ...back, ok: false, bytes: 0, colima: "restored", why: "docker: Error response from daemon: write /to/base/16384/2619: input/output error" } as T;
      db.volumes.push(a.backup);
      colimaSizes[a.backup] = colimaSizes[a.name];
      colimaSizes[a.name] = ddVolumes.find(([n]) => n === a.name)![1];
      return { ...back, ok: true, bytes: size, colima: "replaced", why: "" } as T;
    }
    case "desktop_copy_stop": stopCopy = a.stop; return undefined as T;
    case "desktop_copy": {
      if (a.kind === "volume" && db.volumes.includes(a.name)) throw `Colima already has a volume called ${a.name}, so it was left alone.`;
      if (a.name === "uploads" && dd === "fail") throw "docker: Error response from daemon: no space left on device";
      const size = MB(a.kind === "volume" ? ddVolumes.find(([n]) => n === a.name)![1] : ddImages.find((r) => `${r.Repository}:${r.Tag}` === a.name)!.Size);
      for (let f = 0.2; f < 1; f += 0.2) { await sleep(250); if (stopCopy) throw "Stopped."; emit("desktop-progress", { name: a.name, bytes: Math.round(size * f) }); }
      if (a.kind === "volume") { db.volumes.push(a.name); colimaSizes[a.name] = ddVolumes.find(([n]) => n === a.name)![1]; } else { const [repo, tag] = a.name.split(":"); db.images.unshift({ Repository: repo, Tag: tag, Size: "142MB", ID: hex(12), CreatedSince: "1 second ago" }); }
      return size as T;
    }
    case "docker_pull": {
      if (flag("pullfail")) { await progress("pull-progress", [["Using default tag: latest", 150]]); throw `Error response from daemon: Get "https://registry-1.docker.io/v2/": net/http: request canceled while waiting for connection (Client.Timeout exceeded)`; }
      if (a.image === "ghcr.io/acme/private:1") {
        await progress("pull-progress", [["1: Pulling from acme/private", 200]]);
        throw `Error response from daemon: Head "https://ghcr.io/v2/acme/private/manifests/1": unauthorized`;
      }
      const cut = a.image.lastIndexOf(":");
      const [repo, tag] = cut > a.image.lastIndexOf("/") ? [a.image.slice(0, cut), a.image.slice(cut + 1)] : [a.image, "latest"];
      await progress("pull-progress", [[`Using default tag: ${tag}`, 150], [`${tag}: Pulling from library/${repo}`, 400], ["a2318d6c47ec: Pulling fs layer", 200], ["a2318d6c47ec: Download complete", 700], ["a2318d6c47ec: Pull complete", 300], [`Status: Downloaded newer image for ${repo}:${tag}`, 200]]);
      if (!db.images.some((i) => i.Repository === repo && i.Tag === tag)) db.images.unshift({ Repository: repo, Tag: tag, Size: "142MB", ID: hex(12), CreatedSince: "2 days ago" });
      return undefined as T;
    }
    case "network_probe": {
      const from = find(a.from), to = find(a.target);
      const shared = !!from && !!to && from.networks.some((n) => n !== "bridge" && n !== "host" && n !== "none" && to.networks.includes(n));
      const declared = [...(to?.exposed ?? []), ...(to?.ports.map(([, p]) => p) ?? [])];
      await sleep(400);
      const dns = shared ? `Server:\t\t127.0.0.11\nAddress:\t127.0.0.11#53\n\nNon-authoritative answer:\nName:\t${a.target}\nAddress: ${ipOf(to!, to!.networks.find((n) => from!.networks.includes(n))!)}\n` : `** server can't find ${a.target}: NXDOMAIN\n`;
      const tcp = shared && declared.includes(a.port) ? `Connection to ${a.target} (${ipOf(to!, "devnet")}) ${a.port} port [tcp/*] succeeded!\n` : `nc: connect to ${a.target} port ${a.port} (tcp) failed: Connection refused\n`;
      return `${dns}::dns-exit=${shared ? 0 : 1}\n${tcp}::tcp-exit=${shared && declared.includes(a.port) ? 0 : 1}\n` as T;
    }
    case "open_terminal": ((window as any).__terminal ??= []).push({ kind: a.kind, context: a.context, target: a.target }); return undefined as T;
    case "kubectl": {
      const args: string[] = a.args;
      if (args[0] === "config") return (k8sOn ? "colima\n" : "") as T;
      if (!k8sOn) throw "The connection to the server was refused";
      const now = Date.now(), iso = (agoMs: number) => new Date(now - agoMs).toISOString();
      const pod = (ns: string, name: string, status: object, agoMs = 3.6e6, containers = [{ name: "app" }]) => ({ metadata: { name, namespace: ns, creationTimestamp: iso(agoMs) }, spec: { nodeName: "colima", containers }, status });
      const cs = (state: object, restartCount = 0, ready = false, lastState?: object) => ({ name: "app", ready, restartCount, state, ...(lastState ? { lastState } : {}) });
      const podsAll = [
        pod("kube-system", "coredns-5f9c", { phase: "Running", containerStatuses: [cs({ running: {} }, 0, true)] }, 9e6),
        pod("shop", "web-7d9f", { phase: "Running", containerStatuses: [cs({ running: {} }, 0, true)] }),
        pod("shop", "api-5c4d", { phase: "Running", containerStatuses: [cs({ waiting: { reason: "CrashLoopBackOff" } }, 9, false, { terminated: { reason: "Error", exitCode: 1 } })] }),
        pod("shop", "worker-6f2a", { phase: "Pending", containerStatuses: [cs({ waiting: { reason: "ImagePullBackOff" } })] }),
        pod("shop", "report-8a1b", { phase: "Pending", conditions: [{ type: "PodScheduled", status: "False", reason: "Unschedulable", message: "0/1 nodes are available: 1 Insufficient memory." }] }),
        pod("shop", "cache-1b3c", { phase: "Running", containerStatuses: [cs({ running: {} }, 2, true, { terminated: { reason: "OOMKilled", exitCode: 137 } })] }),
      ];
      if (args[0] === "logs") {
        const name = args[1];
        return (name.startsWith("api-") ? Array.from({ length: 30 }, (_, i) => i % 3 === 0 ? "2026-10-10T12:00:0" + (i % 10) + "Z ERROR: connection refused (db:5432)" : "2026-10-10T12:00:0" + (i % 10) + "Z starting api server on :8080").join("\n") : "2026-10-10T12:00:00Z ready to serve\n") as T;
      }
      const res = args[1];
      const list = (items: object[]) => JSON.stringify({ items }) as T;
      if (res === "nodes") return list([{ metadata: { name: "colima" }, status: { nodeInfo: { kubeletVersion: "v1.30.2+k3s1" }, conditions: [{ type: "Ready", status: "True" }] } }]);
      if (res === "namespaces") return list(["default", "kube-system", "shop"].map((name) => ({ metadata: { name } })));
      if (res === "pods") return list(podsAll);
      if (res === "deployments") return list([["web", 1, 1], ["api", 1, 0], ["worker", 1, 0]].map(([name, want, have]) => ({ metadata: { name, namespace: "shop" }, spec: { replicas: want }, status: { readyReplicas: have } })));
      if (res === "services") return list([{ metadata: { name: "web", namespace: "shop" }, spec: { type: "ClusterIP", clusterIP: "10.43.0.5", ports: [{ port: 80, targetPort: 8080, protocol: "TCP" }] } }, { metadata: { name: "kubernetes", namespace: "default" }, spec: { type: "ClusterIP", clusterIP: "10.43.0.1", ports: [{ port: 443, targetPort: 6443, protocol: "TCP" }] } }]);
      if (res === "events") return list([
        { type: "Warning", reason: "BackOff", message: "Back-off restarting failed container app in pod api-5c4d", involvedObject: { kind: "Pod", name: "api-5c4d", namespace: "shop" }, count: 12, lastTimestamp: iso(2 * 60e3) },
        { type: "Warning", reason: "Failed", message: "Failed to pull image: pull access denied", involvedObject: { kind: "Pod", name: "worker-6f2a", namespace: "shop" }, count: 4, lastTimestamp: iso(5 * 60e3) },
        { type: "Warning", reason: "FailedScheduling", message: "0/1 nodes are available: 1 Insufficient memory.", involvedObject: { kind: "Pod", name: "report-8a1b", namespace: "shop" }, count: 2, lastTimestamp: iso(9 * 60e3) },
        { type: "Normal", reason: "Pulled", message: "Successfully pulled image", involvedObject: { kind: "Pod", name: "web-7d9f", namespace: "shop" }, count: 1, lastTimestamp: iso(60 * 60e3) },
      ]);
      throw `mock: unsupported kubectl command ${args.join(" ")}`;
    }
    case "host_resources": return { cpus: 12, memory: 32 * GB } as T;
    case "vm_log_tail": return (scenario === "stuck" ? 'level=info msg="hostagent starting"\nlevel=fatal msg="instance \\"colima\\" is already running (hostagent pid 812)"' : scenario === "failed" ? 'level=info msg="booting"\nlevel=error msg="vz: the virtual machine stopped unexpectedly"\nlevel=info msg="cleanup"' : "") as T;
    case "setup_report": return structuredClone(setup) as T;
    case "setup_fix": {
      await new Promise((r) => setTimeout(r, 300));
      if (a.id === "plugins") { setup.plugins = setup.plugins.filter((p) => !p.broken); if (!setup.extra_dirs.includes(BREW_PLUGINS)) setup.extra_dirs.push(BREW_PLUGINS); }
      else if (a.id === "creds_store") setup.creds_store = null;
      else if (a.id === "testcontainers") { setup.testcontainers_host = `unix:///Users/me/.colima/${a.profile ?? "default"}/docker.sock`; setup.testcontainers_override = true; }
      else if (a.id === "use_colima_context") { const want = !a.profile || a.profile === "default" ? "colima" : `colima-${a.profile}`; setup.contexts = setup.contexts.map((c) => ({ ...c, current: c.name === want })); }
      else if (a.id === "autostart_on" || a.id === "autostart_restart") setup.autostart = "started";
      else if (a.id === "autostart_off") setup.autostart = "none";
      else throw `unknown fix ${a.id}`;
      // The same kind of sentence the real fix returns, so the page shows where each backup went.
      const said: Record<string, string> = { plugins: "Removed 2 broken Docker Desktop links. Added /opt/homebrew/lib/docker/cli-plugins to /Users/me/.docker/config.json. Backup: /Users/me/.docker/config.json.bak-1-0.", creds_store: 'Removed "credsStore": "desktop" from /Users/me/.docker/config.json. Backup: /Users/me/.docker/config.json.bak-1-1.', testcontainers: "Testcontainers now uses Colima. Backup: /Users/me/.testcontainers.properties.bak-1-2. Added TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE to /Users/me/.zshrc. Backup: /Users/me/.zshrc.bak-1-3.", use_colima_context: "docker now uses Colima." };
      return (said[a.id as string] ?? "Done.") as T;
    }
    case "env_check": return { ...env } as T; // a fresh object per call, like the real IPC
    case "install_tools": {
      for (const n of a.names as string[]) {
        await progress("brew-progress", [[`==> Fetching ${n}`, 200], [(env as any)[n] ? `Warning: ${n} is already installed and up-to-date.` : `==> Pouring ${n}--1.0.arm64.bottle.tar.gz`, 400]]);
        (env as any)[n] = { path: `/opt/homebrew/bin/${n}`, version: "1.0.0" };
        if (n.startsWith("docker-") && !setup.brew_plugins.includes(n)) setup.brew_plugins.push(n);
      }
      await progress("brew-progress", [["==> Summary", 150]]);
      return undefined as T;
    }
    case "colima_config": return { home: "/Users/me", yaml: flag("flowmounts") ? `vmType: vz\nmountType: ${cfgMock.mountType}\nmounts: [{location: ~/work, writable: true}]\nenv: {}\n` : `vmType: vz\nmountType: ${cfgMock.mountType}\nmounts: ${cfgMock.mounts.length ? "" : "[]"}\n${cfgMock.mounts.map((m) => `  - location: ${m.path}\n    writable: ${m.writable}\n`).join("")}env: ${Object.keys(cfgMock.env).length ? "" : "{}"}\n${Object.entries(cfgMock.env).map(([k, v]) => `  ${k}: ${v}\n`).join("")}` } as T;
    case "network_facts": return {
      proxy: flag("proxy") ? "<dictionary> {\n  HTTPEnable : 1\n  HTTPPort : 8080\n  HTTPProxy : proxy.corp\n  HTTPSEnable : 1\n  HTTPSPort : 8080\n  HTTPSProxy : proxy.corp\n}\n" : "<dictionary> {\n}\n",
      interfaces: `lo0: flags=8049<UP> mtu 16384\n\tinet 127.0.0.1 netmask 0xff000000\nutun0: flags=8051<UP> mtu 1500\n\tinet6 fe80::1%utun0 prefixlen 64\n${flag("vpn") ? "utun4: flags=8051<UP> mtu 1380\n\tinet 10.8.0.6 --> 10.8.0.6 netmask 0xffffffff\n" : ""}en0: flags=8863<UP> mtu 1500\n\tinet 192.168.1.20 netmask 0xffffff00\n`,
    } as T;
    case "vm_dns_probe": return (dnsBroken ? "failed" : "resolved") as T;
    case "reveal_vm_log": (window as any).__revealedLog = a.name; return undefined as T;
    // The folder, proxy and plain-restart changes: the VM stops, starts with the new setting, and Docker brings back only
    // the containers whose restart setting says so. The backend refuses a folder that isn't on the Mac before it stops anything.
    case "apply_mounts": case "apply_env": {
      const p = db.profiles.find((x) => x.name === a.name)!;
      if (cmd === "apply_mounts" && (a.mounts as { path: string }[]).some((m) => m.path === "/Volumes/missing")) throw `Nothing changed: /Volumes/missing is not a folder on this Mac, so it can't be shared.`;
      // restart: false is a VM that is already stopped (after a failed start): it is only started.
      const stopFirst = a.restart !== false || a.force === true;
      if (stopFirst) await progress("colima-progress", [[`INFO[0000] stopping colima [profile=${p.name}]`, 300], ["INFO[0004] done", 200]]);
      p.status = "Stopped";
      const wasUp = db.ctrs.filter((c) => c.state === "running");
      wasUp.forEach((c) => { c.state = "exited"; });
      await progress("colima-progress", [[`INFO[0000] starting colima [profile=${p.name}]`, 300], ["INFO[0001] starting ...   context=vm", 500]]);
      // Colima saves the new setting before it starts the VM, so it stays saved when the start fails.
      if (cmd === "apply_mounts") cfgMock.mounts = a.mounts; else cfgMock.env = Object.fromEntries(a.env as [string, string][]);
      if (flag("vmfail") && JSON.stringify(cfgMock.mounts) !== startedWith) throw 'INFO[0001] starting ...   context=vm\nFATA[0009] error starting vm: exit status 1';
      await progress("colima-progress", [["INFO[0016] done", 200]]);
      p.status = "Running";
      wasUp.forEach((c) => { if (c.restart === "always" || c.restart === "unless-stopped") c.state = "running"; });
      (window as any).__vmChange = { cmd, args: JSON.parse(JSON.stringify(a)) };
      return undefined as T;
    }
    case "start_profile": case "apply_resources": {
      // A restart for a new size stops the VM first, as the real command does; Docker then brings back only the
      // containers whose restart setting says so.
      if (cmd === "apply_resources") {
        const p = db.profiles.find((x) => x.name === a.opts.name)!;
        if (a.restart) {
          await progress("colima-progress", [[`INFO[0000] stopping colima [profile=${p.name}]`, 300], ["INFO[0001] stopping ...   context=docker", 300], ["INFO[0003] stopping ...   context=vm", 300], ["INFO[0004] done", 200]]);
          p.status = "Stopped";
        }
        const wasUp = a.restart ? db.ctrs.filter((c) => c.state === "running") : [];
        wasUp.forEach((c) => { c.state = "exited"; });
        await progress("colima-progress", [[`INFO[0000] starting colima [profile=${p.name}]`, 300], ["INFO[0000] runtime: docker", 200], ["INFO[0001] starting ...   context=vm", 500]]);
        // 8 GiB and more don't fit in this Mac's free memory; one step down does.
        if (resize === "fail" && (a.opts.memory ?? 0) >= 8) throw `INFO[0001] starting ...   context=vm\nFATA[0009] error starting vm: error at 'starting': exit status 1: not enough memory to allocate ${a.opts.memory}GiB`;
        await progress("colima-progress", [["INFO[0012] provisioning ...   context=docker", 400], ["INFO[0014] starting ...   context=docker", 300], ["INFO[0016] done", 200]]);
        Object.assign(p, { status: "Running" });
        if (a.opts.cpus) p.cpus = a.opts.cpus;
        if (a.opts.memory) p.memory = a.opts.memory * GB;
        if (a.opts.kubernetes) k8sOn = true;
        // Docker starts again only the containers whose restart setting says so.
        wasUp.forEach((c) => { if (c.restart === "always" || c.restart === "unless-stopped") c.state = "running"; });
        return undefined as T;
      }
      if (scenario === "failed" || scenario === "stuck") {
        await progress("colima-progress", [['time="2026-10-04T12:00:00Z" level=info msg="starting colima"', 200], ["INFO[0002] provisioning ...   context=docker", 400]]);
        throw 'time="2026-10-04T12:00:00Z" level=info msg="starting colima"\nINFO[0002] provisioning ...   context=docker\nFATA[0009] error starting vm: exit status 1';
      }
      await progress("colima-progress", [['time="2026-10-04T12:00:00Z" level=info msg="starting colima [profile=default]"', 150], ["\x1b[32mINFO\x1b[0m[0001] runtime: docker", 200], ["> Downloading the image (ubuntu-24.04)", 200], ["Downloading 12%", 200], ["\rDownloading 45%", 300], ["\rDownloading 100%", 300], ['level=warning msg="disk is slow"', 200]]);
      const o = a.opts; const p = db.profiles.find((x) => x.name === o.name);
      await progress("colima-progress", [[`INFO[0004] creating and starting ...   context=vm`, 400], ['level=info msg="done"', 300]]);
      if (o.kubernetes) k8sOn = true;
      if (p) { Object.assign(p, { status: "Running" }); if (o.cpus) p.cpus = o.cpus; if (o.memory) p.memory = o.memory * GB; if (o.disk) p.disk = o.disk * GB; }
      else db.profiles.push({ name: o.name, status: "Running", arch: "aarch64", cpus: o.cpus ?? 2, memory: (o.memory ?? 2) * GB, disk: (o.disk ?? 100) * GB, runtime: o.runtime ?? "docker", address: "" });
      return undefined as T;
    }
    case "cancel_vm_op": return true as T;
    case "find_compose_files": await sleep(150); return (scenario === "nocompose" ? [] : ["/Users/me/code/blog/docker-compose.yml", "/Users/me/code/shop/compose.yaml", "/Users/me/My Apps/orders-api/compose.yaml", "/Users/me/Dev/global-search-service/docker-compose.yml", "/Users/me/Dev/service-search-service/docker-compose.yml"]) as T;
    case "reveal_compose": ((window as any).__revealed ??= []).push(a.path); return undefined as T;
    // &textedit=1: no editor is registered for YAML, so TextEdit opens it. &openfail=1: macOS refuses to open it in Cursor.
    // &app=Cursor: the app Open names. A check sets window.__editorApp to change it, as a new default in Finder would.
    case "compose_editor": {
      const app = (window as any).__editorApp ?? (ddParam("textedit") ? "TextEdit" : new URLSearchParams(location.search).get("app"));
      return { how: app === "TextEdit" ? "textedit" : "editor", app: app ?? null } as T;
    }
    case "open_compose":
      if (ddParam("openfail")) throw "OPEN_FAILED:Cursor\nThe application can't be opened";
      // &openslow=1: open takes 3 s (an app starting up), so the Opening… state can be seen.
      if (ddParam("openslow")) await new Promise((r) => setTimeout(r, 3000));
      ((window as any).__opened ??= []).push(a.path); return (ddParam("textedit") ? "textedit" : "editor") as T;
    // shop's compose.yaml as `docker compose config --format json` gives it. report-job's mem_limit is 256 MiB, or
    // 1 GiB with &raised=1; a check sets window.__shopLimit to "save the file". &needdb=1: report-job needs db.
    case "compose_config": {
      // &badconfig=1: the file has a mistake, so Compose can't read it.
      if (!String(a.file).endsWith("/shop/compose.yaml") || ddParam("badconfig")) throw "yaml: line 12: did not find expected key";
      const dep = (v: string) => Object.fromEntries(v.split(",").map((x) => x.split(":")).map(([svc, cond]) => [svc, { condition: cond }]));
      const limit = (window as any).__shopLimit ?? (ddParam("raised") ? 1024 ** 3 : 256 * 1024 ** 2);
      const services = Object.fromEntries([...SHOP].map((n) => [n, {
        ...(n === "report-job" ? { mem_limit: String(limit), ...(ddParam("needdb") ? { depends_on: { db: { condition: "service_healthy" } } } : {}) } : {}),
        ...(SHOP_DEPS[n] ? { depends_on: dep(SHOP_DEPS[n]) } : {}),
      }]));
      return JSON.stringify({ name: "shop", services }) as T;
    }
    case "compose_action": {
      ((window as any).__composed ??= []).push({ file: a.file, action: a.action, context: a.context, ...(a.service ? { service: a.service } : {}) });
      // One service, recreated with the file's settings (as the real backend does after checking the name): a new
      // container, running, with whatever limit the file has now (the preview's file raised it).
      if (a.service) {
        await progress("compose-progress", [[` ✔ Container shop-${a.service}-1  Recreated`, 200], [` ✔ Container shop-${a.service}-1  Started`, 200]]);
        const c = db.ctrs.find((x) => x.name === a.service);
        if (c) { c.id = hex(64); c.state = "running"; c.born = Date.now(); c.endedAt = undefined; c.oom = false; c.exitCode = 0; c.memLimit = 1024 ** 3; }
        return undefined as T;
      }
      const dir: string = a.file.slice(0, a.file.lastIndexOf("/"));
      const project = dir.slice(dir.lastIndexOf("/") + 1);
      await progress("compose-progress", [[`[+] Running 2/2 (${a.action})`, 150], [` ✔ Network ${project}_default  Created`, 200]]);
      // blog's web port is taken, so its start fails the way docker compose reports it.
      if (project === "blog" && a.action !== "stop" && a.action !== "down" && db.ctrs.some((c) => c.name === "web" && c.state === "running")) throw "Error response from daemon: driver failed programming external connectivity on endpoint blog-web-1: Bind for 0.0.0.0:8080 failed: port is already allocated";
      const labels = (svc: string) => `com.docker.compose.project=${project},com.docker.compose.project.working_dir=${dir},com.docker.compose.service=${svc}`;
      const shopLabel = (c: Ctr) => (SHOP.has(c.name) ? "com.docker.compose.project=shop," : "");
      const mine = db.ctrs.filter((c) => (c.labels ?? shopLabel(c)).includes(`com.docker.compose.project=${project},`));
      if (a.action === "down") db.ctrs = db.ctrs.filter((c) => !mine.includes(c));
      else if (a.action === "stop") mine.forEach((c) => (c.state = "exited"));
      else if (mine.length) mine.forEach((c) => (c.state = "running"));
      else db.ctrs.push({ ...structuredClone(db.ctrs[0]), id: `${project}0000000000000000`, name: `${project}-web-1`, state: "running", labels: labels("web") });
      emit("compose-progress", ` ✔ Container ${project}-web-1  Started`);
      return undefined as T;
    }
    case "cancel_compose": return false as T;
    case "compose_logs": {
      const dir: string = a.file.slice(0, a.file.lastIndexOf("/"));
      const project = dir.slice(dir.lastIndexOf("/") + 1);
      const t = (ms: number) => new Date(Date.now() - ms).toISOString();
      // Polled with since: one new line each time, so the view can be seen following.
      if (a.since) return `${project === "shop" ? "web" : `${project}-web-1`}  | ${t(0)} GET /health 200\n` as T;
      // Every container of the project, by its own name as compose prints it.
      const mine = db.ctrs.filter((c) => (c.labels ?? (SHOP.has(c.name) ? "com.docker.compose.project=shop," : "")).includes(`com.docker.compose.project=${project},`)).map((c) => c.name);
      return (mine.length ? mine : [`${project}-web-1`]).flatMap((n, i) => [`${n}  | ${t(9000 - i)} ${n} starting`, `${n}  | ${t(8000 - i)} ${n} ready`]).join("\n") as T;
    }
    case "compose_in_folder": {
      if (/\/\./.test(a.dir)) throw "Choose a folder inside your home folder. Hidden folders and ~/Library can't be added.";
      if (/empty$/.test(a.dir)) throw `No compose.yaml or docker-compose.yml in ${a.dir.split("/").pop()}`;
      return [`${a.dir.replace(/\/+$/, "")}/compose.yaml`] as T;
    }
    // worker's image is minimal (no shell), mysql has bash, the rest have sh.
    case "container_shell": { const c = find(a.name); return (c?.image.startsWith("acme/worker") ? "none" : c?.image.startsWith("mysql") ? "bash" : "sh") as T; }
    case "pick_folder": return ((window as any).__pickFolder ?? "/Users/you/code/app") as T; // the native chooser; null means cancelled
    case "force_stop_profile": { await progress("colima-progress", [['level=info msg="stopping colima (forced)"', 300]]); db.profiles.find((x) => x.name === a.name)!.status = "Stopped"; return undefined as T; }
    case "force_restart_profile": { await progress("colima-progress", [['level=info msg="stopping colima (forced)"', 300], ['level=info msg="done"', 300]]); db.profiles.find((x) => x.name === a.name)!.status = "Running"; return undefined as T; }
    case "stop_profile": case "restart_profile": {
      if (scenario === "stopfail" && cmd === "stop_profile") throw "FATA[0003] could not stop the VM: timeout"; await progress("colima-progress", [[`level=info msg="stopping colima"`, 300], ['level=info msg="done"', 500]]); db.profiles.find((x) => x.name === a.name)!.status = cmd === "stop_profile" ? "Stopped" : "Running"; if (cmd === "restart_profile") { if (!flag("stuckdns")) dnsBroken = false; (window as any).__vmChange = { cmd, args: JSON.parse(JSON.stringify(a)) }; } return undefined as T; }
    case "delete_profile": db.profiles = db.profiles.filter((x) => x.name !== a.name); return undefined as T;
    case "open_url": { if (/^https:\/\//.test(a.url)) { ((window as any).__opened ??= []).push(a.url); return undefined as T; } throw "Preview only: localhost links don't open here."; }
  }
  throw `mock: unsupported command ${cmd}`;
}

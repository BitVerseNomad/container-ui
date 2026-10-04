// Simulated backend for the browser preview. Same commands as the Rust side, fake data.
type Ev = { payload: string };
const listeners: Record<string, Set<(e: Ev) => void>> = {};
const emit = (name: string, payload: string) => listeners[name]?.forEach((cb) => cb({ payload }));
export const listen = async <T,>(name: string, cb: (e: { payload: T }) => void) => {
  (listeners[name] ??= new Set()).add(cb as never);
  return () => void listeners[name].delete(cb as never);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hex = (n: number) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const GB = 1024 ** 3;

type Ctr = { id: string; name: string; image: string; state: string; ports: [number, number][]; mounts: { Type: string; Name?: string; Source: string; Destination: string; RW: boolean }[]; env: string[]; born: number; cpu: number; mem: number };
const now = Date.now();
const db = {
  profiles: [{ name: "default", status: "Running", arch: "aarch64", cpus: 4, memory: 8 * GB, disk: 100 * GB, runtime: "docker", address: "192.168.5.2" }],
  images: [
    { Repository: "mysql", Tag: "8", Size: "586MB", ID: hex(12), CreatedSince: "3 weeks ago" },
    { Repository: "nginx", Tag: "latest", Size: "192MB", ID: hex(12), CreatedSince: "2 weeks ago" },
    { Repository: "redis", Tag: "7", Size: "117MB", ID: hex(12), CreatedSince: "5 weeks ago" },
    { Repository: "postgres", Tag: "16", Size: "456MB", ID: hex(12), CreatedSince: "6 weeks ago" },
  ],
  volumes: ["mysql-data", "redis-data", "pgdata-old"],
  ctrs: [
    { id: hex(64), name: "web", image: "nginx:latest", state: "running", ports: [[8080, 80]], mounts: [], env: ["NGINX_VERSION=1.27.2"], born: now - 36e5, cpu: 0.3, mem: 11e6 },
    { id: hex(64), name: "db", image: "mysql:8", state: "running", ports: [[3306, 3306]], mounts: [{ Type: "volume", Name: "mysql-data", Source: "/var/lib/docker/volumes/mysql-data/_data", Destination: "/var/lib/mysql", RW: true }], env: ["MYSQL_ROOT_PASSWORD=dev"], born: now - 864e5, cpu: 1.8, mem: 380e6 },
    { id: hex(64), name: "cache", image: "redis:7", state: "exited", ports: [], mounts: [], env: [], born: now - 2 * 864e5, cpu: 0, mem: 0 },
  ] as Ctr[],
};
const HUB = [
  ["nginx", "Official build of Nginx.", 21000, true], ["mysql", "MySQL is a widely used, open-source relational database management system.", 15700, true],
  ["postgres", "The PostgreSQL object-relational database system.", 13500, true], ["redis", "Redis is the world's fastest data platform for caching and vector search.", 12800, true],
  ["hello-world", "Hello World! (an example of minimal Dockerization)", 2400, true], ["bitnami/mysql", "Bitnami container image for MySQL", 120, false],
] as const;

const find = (id: string) => db.ctrs.find((c) => c.id.startsWith(id) || c.name === id);
const lines = (rows: object[]) => rows.map((r) => JSON.stringify(r)).join("\n");
const fmtPorts = (c: Ctr) => c.state === "running" ? c.ports.map(([h, p]) => `0.0.0.0:${h}->${p}/tcp`).join(", ") : "";
const status = (c: Ctr) => (c.state === "running" ? "Up 2 hours" : c.state === "paused" ? "Up 2 hours (Paused)" : "Exited (0) 3 hours ago");
const logLines = (c: Ctr) => c.image.startsWith("mysql")
  ? ["[Server] /usr/sbin/mysqld (mysqld 8.4.3) starting as process 1", "[Server] InnoDB initialization has started", "[Server] InnoDB initialization has ended", "[Server] X Plugin ready for connections. Bind-address: '::' port: 33060", "[Server] ready for connections. Version: '8.4.3'  port: 3306"]
  : ["/docker-entrypoint.sh: Configuration complete; ready for start up", `${c.image}: listening on 0.0.0.0:${c.ports[0]?.[1] ?? 80}`, "GET / 200 612 \"curl/8.4.0\"", "GET /favicon.ico 404 153 \"Mozilla/5.0\""];

function dockerCmd(args: string[]): string {
  const [cmd, sub] = args;
  switch (cmd) {
    case "ps": return lines(db.ctrs.map((c) => ({ ID: c.id.slice(0, 12), Names: c.name, Image: c.image, State: c.state, Status: status(c), Ports: fmtPorts(c) })));
    case "images": return lines(db.images);
    case "volume":
      if (sub === "ls") return lines(db.volumes.map((Name) => ({ Name, Driver: "local" })));
      if (sub === "rm") { db.volumes = db.volumes.filter((v) => v !== args[2]); return args[2]; }
      db.volumes = db.volumes.filter((v) => db.ctrs.some((c) => c.mounts.some((m) => m.Name === v))); return "Total reclaimed space: 0B";
    case "search": return lines(HUB.filter((h) => h[0].includes(args[args.length - 4] ?? "") || h[0].includes(args[3] ?? "")).map(([Name, Description, s, o]) => ({ Name, Description, StarCount: String(s), IsOfficial: String(o) })));
    case "image":
      if (sub === "inspect") return /mysql/.test(args[args.length - 1]) ? '{"3306/tcp":{},"33060/tcp":{}}' : /nginx/.test(args[args.length - 1]) ? '{"80/tcp":{}}' : "null";
      db.images = db.images.filter((i) => db.ctrs.some((c) => c.image.startsWith(i.Repository))); return "Total reclaimed space: 0B";
    case "rmi": {
      const img = db.images.find((i) => `${i.Repository}:${i.Tag}` === args[1] || i.ID === args[1]);
      const user = img && db.ctrs.find((c) => c.image.startsWith(img.Repository));
      if (user) throw `Error response from daemon: conflict: unable to remove repository reference "${args[1]}" (must force) - container ${user.id.slice(0, 12)} is using its referenced image`;
      db.images = db.images.filter((i) => i !== img); return `Untagged: ${args[1]}`;
    }
    case "logs": { const c = find(args[args.length - 1])!; const t = new Date().toISOString(); return logLines(c).map((l, i) => `${t.slice(0, 17)}${String(10 + i).padStart(2, "0")}Z ${l}`).join("\n") + "\n"; }
    case "inspect": { const c = find(args[1])!; return JSON.stringify([{ Id: c.id, Name: `/${c.name}`, Created: new Date(c.born).toISOString(), Path: c.image.startsWith("mysql") ? "docker-entrypoint.sh" : "/docker-entrypoint.sh", Args: ["mysqld"], State: { Status: c.state, Running: c.state !== "exited", Paused: c.state === "paused" }, Config: { Image: c.image, Env: c.env }, HostConfig: { RestartPolicy: { Name: "no" } }, NetworkSettings: { Ports: Object.fromEntries(c.ports.map(([h, p]) => [`${p}/tcp`, [{ HostIp: "0.0.0.0", HostPort: String(h) }]])), Networks: { bridge: { IPAddress: "172.17.0.2" } } }, Mounts: c.mounts }]); }
    case "stats": { const c = find(args[args.length - 1])!; c.cpu = Math.max(0.1, c.cpu + (Math.random() - 0.45)); return lines([{ CPUPerc: `${c.cpu.toFixed(2)}%`, MemUsage: `${(c.mem / 2 ** 20).toFixed(1)}MiB / 7.7GiB`, NetIO: "1.2kB / 648B", BlockIO: "0B / 4.1kB", PIDs: "29" }]); }
    case "start": case "stop": case "restart": case "pause": case "unpause": { const c = find(args[1])!; c.state = cmd === "stop" ? "exited" : cmd === "pause" ? "paused" : "running"; return c.id; }
    case "rm": db.ctrs = db.ctrs.filter((c) => c !== find(args[args.length - 1])); return args[args.length - 1];
    case "run": {
      const name = args[args.indexOf("--name") + 1]; const image = args[args.length - 1];
      const ports = args.flatMap((a, i) => (args[i - 1] === "-p" ? [a] : [])).map((p) => p.split(":").map(Number)) as number[][];
      for (const [h] of ports) if (ports.length && db.ctrs.some((c) => c.state === "running" && c.ports.some(([x]) => x === h))) throw `docker: Error response from daemon: driver failed programming external connectivity: Bind for 0.0.0.0:${h} failed: port is already allocated`;
      const c: Ctr = { id: hex(64), name, image: image.includes(":") ? image : `${image}:latest`, state: "running", ports: ports.map(([h, p]) => [h, p ?? h]), mounts: args.flatMap((a, i) => (args[i - 1] === "-v" ? [{ Type: "bind", Source: a.split(":")[0], Destination: a.split(":")[1], RW: true }] : [])), env: args.flatMap((a, i) => (args[i - 1] === "-e" ? [a] : [])), born: Date.now(), cpu: 0.5, mem: 24e6 };
      db.ctrs.push(c); return c.id + "\n";
    }
  }
  throw `mock: unsupported docker command: ${args.join(" ")}`;
}

async function progress(event: string, steps: [string, number][]) { for (const [l, ms] of steps) { await sleep(ms); emit(event, l); } }

export async function invoke<T>(cmd: string, a: Record<string, any> = {}): Promise<T> {
  await sleep(60);
  switch (cmd) {
    case "list_profiles": return db.profiles as T;
    case "docker": { const args: string[] = a.args.filter((x: string) => x !== "--format" && x !== "{{json .}}"); const i = a.args.indexOf("--format"); return dockerCmd(i > 0 && a.args[0] === "image" ? a.args : args) as T; }
    case "docker_pull": {
      const [repo, tag = "latest"] = a.image.split(":");
      await progress("pull-progress", [[`Using default tag: ${tag}`, 150], [`${tag}: Pulling from library/${repo}`, 400], ["a2318d6c47ec: Pulling fs layer", 200], ["a2318d6c47ec: Download complete", 700], ["a2318d6c47ec: Pull complete", 300], [`Status: Downloaded newer image for ${repo}:${tag}`, 200]]);
      if (!db.images.some((i) => i.Repository === repo && i.Tag === tag)) db.images.unshift({ Repository: repo, Tag: tag, Size: "142MB", ID: hex(12), CreatedSince: "2 days ago" });
      return undefined as T;
    }
    case "start_profile": case "apply_resources": {
      const o = a.opts; const p = db.profiles.find((x) => x.name === o.name);
      const steps: [string, number][] = [[`level=info msg="starting colima [profile=${o.name}]"`, 200], ['level=info msg="creating and starting ..." context=vm', 900], ['level=info msg="provisioning ..." context=docker', 900], ['level=info msg="done"', 300]];
      await progress("colima-progress", steps);
      if (p) { Object.assign(p, { status: "Running" }); if (o.cpus) p.cpus = o.cpus; if (o.memory) p.memory = o.memory * GB; if (o.disk) p.disk = o.disk * GB; }
      else db.profiles.push({ name: o.name, status: "Running", arch: "aarch64", cpus: o.cpus ?? 2, memory: (o.memory ?? 2) * GB, disk: (o.disk ?? 100) * GB, runtime: o.runtime ?? "docker", address: "" });
      return undefined as T;
    }
    case "stop_profile": case "restart_profile": { await progress("colima-progress", [[`level=info msg="stopping colima"`, 300], ['level=info msg="done"', 500]]); db.profiles.find((x) => x.name === a.name)!.status = cmd === "stop_profile" ? "Stopped" : "Running"; return undefined as T; }
    case "delete_profile": db.profiles = db.profiles.filter((x) => x.name !== a.name); return undefined as T;
    case "open_url": throw "Preview only: localhost links don't open here.";
  }
  throw `mock: unsupported command ${cmd}`;
}

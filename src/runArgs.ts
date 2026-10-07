// Pure helpers for the "Run image" panel: validate form input and build `docker run` arguments.

export type PortRow = { host: string; container: string };
export type VolRow = { source: string; target: string };
export type RunSpec = { image: string; name: string; ports: PortRow[]; volumes: VolRow[]; env: string; exposeAll?: boolean; network?: string };
export type RunResult = { ok: true; args: string[] } | { ok: false; errors: string[] };

const NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/;
const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;
const validPort = (s: string) => /^\d{1,5}$/.test(s) && Number(s) >= 1 && Number(s) <= 65535;

export function parseEnv(text: string): { vars: string[]; errors: string[] } {
  const vars: string[] = [];
  const errors: string[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = raw.replace(/\r$/, "");
    if (!line.trim() || line.trim().startsWith("#")) return;
    const eq = line.indexOf("=");
    const key = eq === -1 ? "" : line.slice(0, eq).trim();
    if (!KEY.test(key)) {
      errors.push(`Environment line ${i + 1} should look like KEY=value.`);
      return;
    }
    vars.push(`${key}=${line.slice(eq + 1)}`);
  });
  return { vars, errors };
}

// `docker image inspect --format '{{json .Config.ExposedPorts}}'` -> ["3306", "33060"]
export function parseExposedPorts(json: string): string[] {
  try {
    const obj = JSON.parse(json);
    if (!obj || typeof obj !== "object") return [];
    return Object.keys(obj)
      .filter((k) => k.endsWith("/tcp"))
      .map((k) => k.split("/")[0])
      .sort((a, b) => Number(a) - Number(b));
  } catch {
    return [];
  }
}

function repoName(image: string): string {
  const noDigest = image.split("@")[0];
  const last = noDigest.split("/").pop() ?? noDigest;
  return last.split(":")[0];
}

const ENV_PRESETS: Record<string, string> = {
  mysql: "MYSQL_ROOT_PASSWORD=dev",
  mariadb: "MARIADB_ROOT_PASSWORD=dev",
  postgres: "POSTGRES_PASSWORD=dev",
};

export const presetEnv = (image: string) => ENV_PRESETS[repoName(image)] ?? "";

export const defaultName = (image: string, suffix: string) => `${repoName(image)}-${suffix}`;

export function buildRunArgs(spec: RunSpec): RunResult {
  const errors: string[] = [];
  const args = ["run", "-d"];

  const image = spec.image.trim();
  if (!image || image.startsWith("-")) errors.push("Choose an image to run.");

  const name = spec.name.trim();
  if (name && !NAME.test(name)) {
    errors.push("Container names use letters, numbers, dots, dashes and underscores, and can't start with a symbol.");
  }
  if (name) args.push("--name", name);

  const network = (spec.network ?? "").trim();
  if (network) {
    // Host networking removes the container's isolation, so the app doesn't offer it.
    if (network === "host" || network === "none" || !NAME.test(network)) errors.push(`"${network}" can't be used as a network name here.`);
    else args.push("--network", network);
  }

  for (const p of spec.ports) {
    const host = p.host.trim();
    const container = p.container.trim();
    if (!host && !container) continue;
    if (!validPort(container)) {
      errors.push(`Container port "${container}" must be a number from 1 to 65535.`);
    } else if (host && !validPort(host)) {
      errors.push(`Host port "${host}" must be a number from 1 to 65535.`);
    } else {
      // Published ports are reachable from other devices on the network unless bound to loopback.
      const mapping = host ? `${host}:${container}` : container;
      args.push("-p", spec.exposeAll ? mapping : host ? `127.0.0.1:${mapping}` : `127.0.0.1::${container}`);
    }
  }

  for (const v of spec.volumes) {
    const source = v.source.trim();
    const target = v.target.trim();
    if (!source && !target) continue;
    const sourceOk = NAME.test(source) || (source.startsWith("/") && !source.includes(":"));
    if (!sourceOk) {
      errors.push(`Volume source "${source}" must be a volume name or an absolute path.`);
    } else if (!target.startsWith("/") || target.includes(":")) {
      errors.push(`Volume path "${target}" inside the container must be absolute, like /data.`);
    } else {
      args.push("-v", `${source}:${target}`);
    }
  }

  const env = parseEnv(spec.env);
  errors.push(...env.errors);
  env.vars.forEach((v) => args.push("-e", v));

  return errors.length ? { ok: false, errors } : { ok: true, args: [...args, image] };
}

// A failed `docker run` can leave a "Created" container behind; remove it unless the name clash
// is the failure (then the container with that name belongs to someone else).
export const shouldCleanup = (err: string) => !/already in use/i.test(err);

export function hintFor(err: string): string | null {
  if (/port is already allocated|address already in use/i.test(err)) {
    return "That host port is taken. Pick a different host port, or stop the container using it.";
  }
  if (/no matching manifest|platform.*does not match/i.test(err)) {
    return "This image has no build for your CPU (Apple Silicon needs arm64). It may only exist as amd64.";
  }
  return null;
}

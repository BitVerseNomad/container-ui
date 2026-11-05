// Pulling from a private registry: build the full image reference, check it before it reaches docker,
// and recognise a "sign in first" failure. Pure functions only; the app never touches Docker's login config.

export type RefInput = { host: string; path: string; tag: string };
export type RefCheck = { ok: true; ref: string } | { ok: false; reason: string };

export type Preset = { id: string; label: string; host: string; pathExample: string };

// The two cloud hosts are templates: the user fills in the <> parts, and checkRef refuses them until they do.
export const PRESETS: Preset[] = [
  { id: "ghcr", label: "GitHub (ghcr.io)", host: "ghcr.io", pathExample: "acme/api" },
  { id: "ecr-public", label: "AWS public (public.ecr.aws)", host: "public.ecr.aws", pathExample: "acme/api" },
  { id: "ecr", label: "AWS ECR", host: "<account>.dkr.ecr.<region>.amazonaws.com", pathExample: "my-repo" },
  { id: "gar", label: "Google Artifact Registry", host: "<region>-docker.pkg.dev", pathExample: "my-project/my-repo/api" },
];

export function presetFor(host: string): Preset | undefined {
  const h = host.trim().toLowerCase();
  if (/^(\d{12}|<account>)\.dkr\.ecr\.[^.]+\.amazonaws\.com(\.cn)?$/.test(h)) return PRESETS.find((p) => p.id === "ecr");
  if (/^[^.]+-docker\.pkg\.dev$/.test(h)) return PRESETS.find((p) => p.id === "gar");
  return PRESETS.find((p) => p.host === h);
}

const trim = (s: string) => s.trim();
const trimPath = (s: string) => trim(s).replace(/^\/+|\/+$/g, "");

export const buildRef = ({ host, path, tag }: RefInput): string => `${trim(host)}/${trimPath(path)}:${trim(tag) || "latest"}`;

const HOST = /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?(:\d{1,5})?$/i;
const PATH_PART = /^[a-z0-9]+(?:(?:[._]|__|-+)[a-z0-9]+)*$/;
const TAG = /^\w[\w.-]{0,127}$/;

// Docker's own rule: the first part of a name is a registry only with a dot, a port, or exactly "localhost".
// Anything else is pulled from Docker Hub, where someone else may own that account.
const isRegistryHost = (h: string) => HOST.test(h) && (h.includes(".") || h.includes(":") || h.toLowerCase() === "localhost");

export function checkRef(input: RefInput): RefCheck {
  const host = trim(input.host);
  const path = trimPath(input.path);
  const tag = trim(input.tag) || "latest";
  if (!host) return { ok: false, reason: "Enter the registry host, like ghcr.io." };
  if (/^[a-z]+:\/\//i.test(host)) return { ok: false, reason: "Write the host without https://, like ghcr.io." };
  if (host.includes("<")) return { ok: false, reason: host.includes("<account>") ? "Replace <account> and <region> with your own." : "Replace <region> with your own." };
  if (!HOST.test(host)) return { ok: false, reason: "The host should look like ghcr.io or harbor.example.com:8443, with no slash or spaces." };
  if (!isRegistryHost(host)) return { ok: false, reason: `Docker reads "${host}" as a Docker Hub account, not a registry. Use the full host, like ${host}.example.com or ${host}:5000.` };
  if (!path) return { ok: false, reason: "Enter the image path, like acme/api." };
  if (/[:@]/.test(path)) return { ok: false, reason: "Put the version in the Tag box, not in the path." };
  if (!path.split("/").every((part) => PATH_PART.test(part))) return { ok: false, reason: "The path can use lowercase letters, numbers, . _ - and / between names." };
  if (!TAG.test(tag)) return { ok: false, reason: "The tag can use letters, numbers, . _ - and is at most 128 characters." };
  return { ok: true, ref: buildRef({ host, path, tag }) };
}

// Registries word an authentication failure differently; these are the phrases docker prints.
// A bare "denied" would also match the "permission denied" docker prints when its own socket is unreachable.
const AUTH_FAILURE = /unauthorized|access[^\n]*denied|denied:|no basic auth credentials|authentication required/i;
export const isAuthError = (text: string): boolean => AUTH_FAILURE.test(text);

// ECR has no fixed password: the AWS CLI makes a 12-hour token and pipes it to docker login.
const ECR_HOST = /^\d{12}\.dkr\.ecr\.([a-z0-9-]+)\.amazonaws\.com$/;

// Null when the host is not a registry name, so nothing a user pasted from elsewhere becomes a copied command.
export function loginCommand(host: string): string | null {
  const h = trim(host);
  if (!isRegistryHost(h)) return null;
  const ecr = ECR_HOST.exec(h);
  if (ecr) return `aws ecr get-login-password --region ${ecr[1]} | docker login --username AWS --password-stdin ${h}`;
  // Public ECR tokens are only issued in us-east-1.
  if (h === "public.ecr.aws") return `aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin ${h}`;
  return `docker login ${h}`;
}

// The public ECR gallery serves anyone; every other registry here can hold private images.
export const needsLogin = (host: string): boolean => trim(host).toLowerCase() !== "public.ecr.aws";

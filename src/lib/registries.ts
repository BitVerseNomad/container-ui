// The private registries the owner pulls from, saved once so Compose and Run can sign in without asking.
// Only Amazon ECR needs this today: the sign-in is `aws ecr get-login-password | docker login`.
import { invoke } from "@tauri-apps/api/core";

export type Registry = { registry: string; region: string; profile?: string };
export type LoginError = { kind: "aws-session" | "no-aws" | "login"; message: string };
export type SignInStep = "login" | "aws";

const LIST_KEY = "container-ui:registries";
export const PROFILE_KEY = "container-ui:awsProfile";

const ECR_HOST = /^[0-9]{12}\.dkr\.ecr(?:-fips)?\.([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?$/;

// A bare host or a full image reference ("<host>/team/app:1.0") in, the ECR host and its region out. Anything else gives null.
export function parseEcrHost(input: string): { registry: string; region: string } | null {
  const host = input.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  const m = ECR_HOST.exec(host);
  return m ? { registry: host, region: m[1] } : null;
}

const isRegistry = (r: unknown): r is Registry =>
  !!r && typeof r === "object" && typeof (r as Registry).registry === "string" && typeof (r as Registry).region === "string"
  && ((r as Registry).profile === undefined || typeof (r as Registry).profile === "string");

export function loadRegistries(): Registry[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(LIST_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter(isRegistry) : [];
  } catch { return []; }
}
export function saveRegistries(list: Registry[]): void {
  try { localStorage.setItem(LIST_KEY, JSON.stringify(list)); } catch { /* the list just isn't kept */ }
}
// Adding a host that is already there replaces it (the new profile wins).
export const withRegistry = (list: Registry[], r: Registry): Registry[] => [...list.filter((x) => x.registry !== r.registry), r];
export const withoutRegistry = (list: Registry[], host: string): Registry[] => list.filter((x) => x.registry !== host);
export const addRegistry = (r: Registry): Registry[] => { const next = withRegistry(loadRegistries(), r); saveRegistries(next); return next; };
export const removeRegistry = (host: string): Registry[] => { const next = withoutRegistry(loadRegistries(), host); saveRegistries(next); return next; };
export const savedRegistry = (host: string): Registry | undefined => loadRegistries().find((x) => x.registry === host);

export const rememberedProfile = (): string | null => { try { return localStorage.getItem(PROFILE_KEY); } catch { return null; } };
export const rememberProfile = (p: string): void => { try { localStorage.setItem(PROFILE_KEY, p); } catch { /* the choice just isn't kept */ } };

export const asLoginError = (e: unknown): LoginError =>
  e && typeof e === "object" && "kind" in e ? (e as LoginError) : { kind: "login", message: String(e) };

// When each registry was signed in this run. Memory only: Docker owns the real login.
const signedInAt = new Map<string, number>();
export const signedInSince = (host: string): number | undefined => signedInAt.get(host);

// One click: registry login; if AWS says the session ran out, AWS sign-in in the browser, then registry login again.
// Throws what the backend threw (see asLoginError). The hook tells the screen which step is running.
export async function signInToRegistry(r: Registry, onStep?: (step: SignInStep) => void): Promise<void> {
  onStep?.("login");
  try {
    await invoke<void>("registry_login", { registry: r.registry, profile: r.profile });
  } catch (e) {
    if (asLoginError(e).kind !== "aws-session") throw e;
    onStep?.("aws");
    await invoke<void>("aws_sso_login", { profile: r.profile });
    onStep?.("login");
    await invoke<void>("registry_login", { registry: r.registry, profile: r.profile });
  }
  signedInAt.set(r.registry, Date.now());
  setDockerAwsProfile(r.profile ?? null);
}

// The backend runs every docker command with this AWS profile (the ecr-login credential helper reads it).
export const setDockerAwsProfile = (profile: string | null): Promise<void> =>
  invoke<void>("set_docker_aws_profile", { profile }).catch(() => {});

// Tries the profile of the registry, then the other profiles of the same account, while AWS answers "not allowed"
// (a profile can sign in to the account and still lack ecr:GetAuthorizationToken). Returns the profile that worked.
export async function signInTrying(r: Registry, others: string[], onStep?: (step: SignInStep) => void): Promise<string | undefined> {
  const tries = [r.profile, ...others.filter((p) => p !== r.profile)];
  for (let i = 0; i < tries.length; i++) {
    try {
      await signInToRegistry({ ...r, profile: tries[i] }, onStep);
      return tries[i];
    } catch (e) {
      const denied = /AccessDenied|not authorized/i.test(asLoginError(e).message);
      if (!denied || i === tries.length - 1) throw e;
    }
  }
}

export const cancelAwsSignIn = (): Promise<boolean> => invoke<boolean>("aws_sso_cancel").catch(() => false);

export type AwsProfile = { name: string; account: string | null };
export type FoundRegistry = { registry: string; region: string; project: string };
// The AWS profiles of the account named in a registry host (its first 12 digits), in the order of the AWS config.
// No name is trusted to mean read access: signInTrying finds out by trying.
export const profilesFor = (host: string, all: AwsProfile[]): string[] =>
  all.filter((p) => p.account === host.split(".")[0]).map((p) => p.name);

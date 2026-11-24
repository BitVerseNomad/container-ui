// Spots "this registry needs a sign-in" in a failed pull or start, for Amazon ECR, so the app can offer the fix.
const DENIED = /pull access denied|no basic auth credentials|authorization failed|denied:/i;
// The host ends at the next character that cannot be part of a host name, so "<host>.evil.com" never matches.
const ECR_HOST = /(?<![\w.-])([0-9]{12}\.dkr\.ecr(?:-fips)?\.([a-z0-9-]+)\.amazonaws\.com)(?![\w.-])/;

export type RegistryAuth = { registry: string; region: string };

export function detectRegistryAuth(text: string): RegistryAuth | null {
  if (!DENIED.test(text)) return null;
  const m = ECR_HOST.exec(text);
  return m ? { registry: m[1], region: m[2] } : null;
}

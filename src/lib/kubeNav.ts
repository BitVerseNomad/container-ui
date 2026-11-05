// Whether a Colima profile runs Kubernetes: Colima adds a kubectl context named after the profile when it is on.
export const contextNames = (out: string): string[] => out.split("\n").map((l) => l.trim()).filter(Boolean);

// null while the contexts are not known yet, so the caller can tell "not answered" from "off".
export const kubernetesOn = (ctx: string, contexts: string[] | null): boolean | null => (contexts === null ? null : contexts.includes(ctx));

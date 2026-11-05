// Groups `docker ps` rows by their Compose project, read from the labels Compose sets on every container.

const PROJECT = "com.docker.compose.project";
const WORKDIR = "com.docker.compose.project.working_dir";

// `docker ps --format json` joins labels with commas, and some values (config_files) contain commas too,
// so a piece without "=" belongs to the value before it.
export function parseLabels(s: string): Map<string, string> {
  const out = new Map<string, string>();
  let last: string | null = null;
  for (const part of s ? s.split(",") : []) {
    const eq = part.indexOf("=");
    if (eq > 0) {
      last = part.slice(0, eq);
      out.set(last, part.slice(eq + 1));
    } else if (last) out.set(last, `${out.get(last)},${part}`);
  }
  return out;
}

// Kubernetes on the docker runtime runs each pod as docker containers named k8s_<container>_<pod>_...
// and labelled with the pod. The cluster restarts them, so stopping or removing one by hand only breaks the pod.
const KUBE_POD = "io.kubernetes.pod.name";
const KUBE_NAME = /^k8s_/;

export function isKubeOwned(r: { Names: string; Labels?: string }): boolean {
  return KUBE_NAME.test(r.Names) || parseLabels(r.Labels ?? "").has(KUBE_POD);
}

// "k8s_<container>_<pod>_<namespace>_<uid>_<attempt>" is unreadable; people know pods by name and namespace.
// "POD" is the pause container that holds each pod's network.
export function kubeName(r: { Names: string; Labels?: string }): string {
  const l = parseLabels(r.Labels ?? "");
  const [, ctr, pod, ns] = r.Names.split("_");
  const parts = [l.get("io.kubernetes.container.name") ?? ctr, l.get(KUBE_POD) ?? pod, l.get("io.kubernetes.pod.namespace") ?? ns];
  return parts.filter(Boolean).map((p) => (p === "POD" ? "pause" : p)).join(" · ") || r.Names;
}

export type Group<T> = { kind: "compose" | "loose" | "kubernetes"; project: string | null; dir: string | null; rows: T[] };

export function groupByProject<T extends { Names: string; Labels?: string }>(rows: T[]): Group<T>[] {
  const groups = new Map<string, Group<T>>();
  const loose: T[] = [];
  const kube: T[] = [];
  for (const r of rows) {
    if (isKubeOwned(r)) {
      kube.push(r);
      continue;
    }
    const l = parseLabels(r.Labels ?? "");
    const p = l.get(PROJECT);
    if (!p) {
      loose.push(r);
      continue;
    }
    const g = groups.get(p) ?? { kind: "compose" as const, project: p, dir: l.get(WORKDIR) ?? null, rows: [] };
    g.rows.push(r);
    groups.set(p, g);
  }
  const out = [...groups.values()].sort((a, b) => a.project!.localeCompare(b.project!));
  if (loose.length) out.push({ kind: "loose", project: null, dir: null, rows: loose });
  if (kube.length) out.push({ kind: "kubernetes", project: null, dir: null, rows: kube });
  return out;
}

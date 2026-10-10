// Kubernetes objects from `kubectl get ... -o json`, and pod problems in plain words.
// Problem reasons and suggested actions are from docs/research/2026-10-10-kubernetes.md.

export type Pod = {
  namespace: string; name: string; node: string; phase: string; status: string; ready: string; restarts: number; ageMs: number;
  waiting: string; lastTerminated: { reason: string; exitCode: number } | null; terminated: { reason: string; exitCode: number } | null;
  notReady: boolean; unschedulable: string | null;
};
export type K8sProblem = { id: "crashloop" | "image" | "config" | "oom" | "unschedulable" | "stuck" | "failed" | "notready"; level: "bad" | "warn"; title: string; detail: string };

const items = (json: string): any[] => {
  try {
    const d = JSON.parse(json);
    return Array.isArray(d?.items) ? d.items : [];
  } catch {
    return [];
  }
};

export function parsePods(json: string, now: number): Pod[] {
  return items(json).map((p) => {
    const cs: any[] = p.status?.containerStatuses ?? [];
    const waiting = cs.map((c) => c.state?.waiting?.reason).find(Boolean) ?? "";
    const terminated = cs.map((c) => c.state?.terminated).find(Boolean) ?? null;
    const last = cs.map((c) => c.lastState?.terminated).find(Boolean) ?? null;
    const specCount = (p.spec?.containers ?? []).length;
    const sched = (p.status?.conditions ?? []).find((c: any) => c.type === "PodScheduled" && c.status === "False" && c.reason === "Unschedulable");
    const phase = p.status?.phase ?? "";
    const status = p.metadata?.deletionTimestamp ? "Terminating" : waiting || (terminated && phase !== "Succeeded" ? terminated.reason : "") || phase;
    return {
      namespace: p.metadata?.namespace ?? "", name: p.metadata?.name ?? "", node: p.spec?.nodeName ?? "", phase, status,
      ready: `${cs.filter((c) => c.ready).length}/${specCount}`,
      restarts: cs.reduce((n, c) => n + Number(c.restartCount ?? 0), 0),
      ageMs: Math.max(0, now - Date.parse(p.metadata?.creationTimestamp ?? "")),
      waiting,
      terminated: terminated ? { reason: String(terminated.reason ?? ""), exitCode: Number(terminated.exitCode ?? 0) } : null,
      lastTerminated: last ? { reason: String(last.reason ?? ""), exitCode: Number(last.exitCode ?? 0) } : null,
      notReady: phase === "Running" && cs.some((c) => !c.ready),
      unschedulable: sched ? String(sched.message ?? "") : null,
    };
  });
}

const FIVE_MIN = 5 * 60_000;

export function podProblems(p: Pod, now: number): K8sProblem[] {
  void now;
  const out: K8sProblem[] = [];
  const oom = p.terminated?.reason === "OOMKilled" || p.lastTerminated?.reason === "OOMKilled";
  if (oom) {
    out.push({ id: "oom", level: "bad", title: "Ran out of memory", detail: "It used more memory than its memory limit and was killed. Raise the memory limit in the deployment, or reduce what the app uses." });
  }
  if (p.waiting === "CrashLoopBackOff") {
    const why = p.lastTerminated && !oom ? ` Its last exit was ${p.lastTerminated.reason || "an error"} (exit code ${p.lastTerminated.exitCode}).` : "";
    out.push({ id: "crashloop", level: "bad", title: "Keeps crashing and restarting", detail: `Kubernetes waits longer between restarts each time (up to 5 minutes). Read the logs for the error it hits.${why}` });
  }
  if (["ImagePullBackOff", "ErrImagePull", "InvalidImageName"].includes(p.waiting)) {
    out.push({ id: "image", level: "bad", title: "Can't download its image", detail: "Check the image name and tag, and that the cluster can reach and sign in to the registry (a pull secret)." });
  }
  if (["CreateContainerConfigError", "CreateContainerError"].includes(p.waiting)) {
    out.push({ id: "config", level: "bad", title: "Couldn't create the container", detail: "Something it refers to is missing or wrong, such as a ConfigMap or Secret. The pod's events say which." });
  }
  if (p.unschedulable !== null) {
    out.push({ id: "unschedulable", level: "bad", title: "Can't be placed on a node", detail: `${p.unschedulable} Check the node's free CPU and memory, and any taints or node selectors.`.trim() });
  }
  if (["ContainerCreating", "PodInitializing"].includes(p.waiting) && p.ageMs > FIVE_MIN) {
    out.push({ id: "stuck", level: "warn", title: "Stuck starting", detail: `It has been "${p.waiting}" for over 5 minutes. The pod's events usually say what it is waiting for.` });
  }
  if (!oom && !p.waiting && (p.status === "Error" || p.status === "Evicted" || p.status === "Failed" || p.status === "ContainerCannotRun" || p.status === "DeadlineExceeded")) {
    out.push({ id: "failed", level: "bad", title: "Stopped with an error", detail: `Its status is ${p.status}. The logs and events say why.` });
  }
  if (p.notReady && out.length === 0) {
    out.push({ id: "notready", level: "warn", title: "Running but not ready", detail: "Its readiness check hasn't passed, so Services won't send it traffic yet." });
  }
  return out;
}

export type Deployment = { namespace: string; name: string; ready: string; healthy: boolean };
export function parseDeployments(json: string): Deployment[] {
  return items(json).map((d) => {
    const want = Number(d.spec?.replicas ?? 1);
    const have = Number(d.status?.readyReplicas ?? 0);
    return { namespace: d.metadata?.namespace ?? "", name: d.metadata?.name ?? "", ready: `${have}/${want}`, healthy: have >= want };
  });
}

export type Service = { namespace: string; name: string; type: string; address: string; ports: string };
export function parseServices(json: string): Service[] {
  return items(json).map((s) => ({
    namespace: s.metadata?.namespace ?? "", name: s.metadata?.name ?? "", type: s.spec?.type ?? "", address: s.spec?.clusterIP ?? "",
    ports: (s.spec?.ports ?? []).map((p: any) => `${p.port}→${p.targetPort ?? p.port}/${p.protocol ?? "TCP"}${p.nodePort ? ` (node port ${p.nodePort})` : ""}`).join(", "),
  }));
}

export type Node = { name: string; ready: boolean; version: string };
export function parseNodes(json: string): Node[] {
  return items(json).map((n) => ({
    name: n.metadata?.name ?? "",
    ready: (n.status?.conditions ?? []).some((c: any) => c.type === "Ready" && c.status === "True"),
    version: n.status?.nodeInfo?.kubeletVersion ?? "",
  }));
}

export type K8sEvent = { namespace: string; object: string; reason: string; message: string; warning: boolean; count: number; time: number };
export function parseK8sEvents(json: string): K8sEvent[] {
  return items(json)
    .map((e) => ({
      namespace: e.involvedObject?.namespace ?? e.metadata?.namespace ?? "",
      object: `${String(e.involvedObject?.kind ?? "").toLowerCase()}/${e.involvedObject?.name ?? ""}`,
      reason: e.reason ?? "", message: e.message ?? "", warning: e.type === "Warning", count: Number(e.count ?? 1),
      time: Date.parse(e.lastTimestamp ?? e.eventTime ?? e.metadata?.creationTimestamp ?? "") || 0,
    }))
    .sort((a, b) => b.time - a.time);
}

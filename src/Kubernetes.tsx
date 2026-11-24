import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor } from "./api";
import { usePoll } from "./hooks";
import InstallTool from "./InstallTool";
import PodDrawer from "./PodDrawer";
import { K8sEvent, Pod, parseDeployments, parseK8sEvents, parseNamespaces, parseNodes, parsePods, parseServices, podProblems } from "./lib/k8s";
import { ago } from "./lib/events";
import { Banner } from "./ui";
import { Button, Select, TabPanel, Tabs } from "./ui/op";
import Card from "./ui/Card";
import { Badge } from "@ui/components/Badge";
import OutputLog from "./ui/OutputLog";
import { useEnv } from "./useEnv";

const VIEWS = ["Pods", "Deployments", "Services", "Events"] as const;
const kubectl = (context: string | null, args: string[]) => invoke<string>("kubectl", { context, args });
const age = (ms: number) => ago(Date.now() - ms, Date.now()).replace(" ago", "");
const badge = (status: string) =>
  ["Running", "Succeeded", "Completed"].includes(status) ? "healthy" : ["Pending", "ContainerCreating", "PodInitializing", "Terminating"].includes(status) ? "starting" : "unhealthy";
const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = { healthy: "success", starting: "warning", unhealthy: "destructive" };

export default function Kubernetes({ profile, ctx }: { profile: Profile; ctx: string }) {
  void ctx;
  const { env, recheck } = useEnv();
  const [contexts, setContexts] = useState<string[] | null>(null);
  const [view, setView] = useState<(typeof VIEWS)[number]>("Pods");
  const [ns, setNs] = useState("");
  const [open, setOpen] = useState<Pod | null>(null);
  const [enabling, setEnabling] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wanted = ctxFor(profile.name);
  const kctx = contexts?.includes(wanted) ? wanted : null;

  useEffect(() => {
    if (!env?.kubectl || contexts !== null) return;
    kubectl(null, ["config", "get-contexts", "-o", "name"]).then((o) => setContexts(o.split("\n").map((l) => l.trim()).filter(Boolean))).catch(() => setContexts([]));
  }, [env?.kubectl, contexts]);

  const get = (res: string, flags: string[] = ["-A"]) => kubectl(kctx, ["get", res, ...flags, "-o", "json"]);
  const nodes = usePoll(async () => (kctx ? parseNodes(await get("nodes", [])) : []), [kctx], 8000);
  const spaces = usePoll(async () => (kctx ? parseNamespaces(await get("namespaces", [])) : []), [kctx], 15000);
  const pods = usePoll(async () => (kctx ? parsePods(await get("pods"), Date.now()) : []), [kctx], 5000);
  const deployments = usePoll(async () => (kctx ? parseDeployments(await get("deployments")) : []), [kctx], 8000);
  const services = usePoll(async () => (kctx ? parseServices(await get("services")) : []), [kctx], 15000);
  const events = usePoll<K8sEvent[]>(async () => (kctx ? parseK8sEvents(await get("events")) : []), [kctx], 8000);

  const inNs = <T extends { namespace: string }>(rows: T[] | null) => (rows ?? []).filter((r) => !ns || r.namespace === ns);
  const sick = useMemo(
    () => (pods.data ?? []).map((p) => ({ p, problems: podProblems(p, Date.now()) })).filter((x) => x.problems.length > 0),
    [pods.data],
  );

  async function enable() {
    setEnabling(true);
    setFailure(null);
    try {
      await invoke("apply_resources", { opts: { name: profile.name, kubernetes: true }, restart: profile.status === "Running" });
      setContexts(null);
    } catch (e) {
      setFailure(String(e));
    } finally {
      setEnabling(false);
    }
  }

  if (!env) return <p className="hint">Checking your setup…</p>;
  if (!env.kubectl) return <Card className="flex flex-col gap-3 p-4"><InstallTool title="kubectl isn't installed" name="kubectl" hasBrew={!!env.brew} onDone={recheck} /></Card>;
  if (contexts === null) return <p className="hint">Looking for your cluster…</p>;
  if (!kctx) {
    return (
      <Card className="flex flex-col gap-3 p-4">
        <h2>Kubernetes isn't turned on for {profile.name}</h2>
        <p className="hint">Colima can run a small Kubernetes cluster (K3s) inside the VM. Turning it on restarts the VM, so running containers stop for a minute and start again.</p>
        <div className="actions-inline">
          <button className="primary" disabled={enabling} onClick={enable}>{enabling ? "Turning on…" : "Turn on Kubernetes"}</button>
        </div>
        <OutputLog event="colima-progress" active={enabling} failure={failure} />
      </Card>
    );
  }

  const ready = (nodes.data ?? []).filter((n) => n.ready).length;
  const running = (pods.data ?? []).filter((p) => p.status === "Running").length;

  return (
    <section className="flex min-h-0 flex-col gap-4">
      <div className="vm-strip k8s-summary">
        <span className={`sdot ${nodes.error ? "bad" : ready ? "on" : ""}`} aria-hidden="true" />
        <b>{ready} node{ready === 1 ? "" : "s"} ready</b>
        <span className="hint">{nodes.error ? "The cluster isn't answering yet" : (nodes.data ?? []).map((n) => n.version).filter(Boolean)[0] ?? ""}</span>
        <span className="text-meta text-fg-muted"><span>{running} of {(pods.data ?? []).length} pods running</span>{sick.length > 0 && <><span aria-hidden="true"> · </span><span className="font-medium text-bad">{sick.length} need attention</span></>}</span>
      </div>

      {sick.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg-raised p-3">
          <h2>Needs attention</h2>
          <ul>
            {sick.map(({ p, problems }) => (
              <li key={`${p.namespace}/${p.name}`} className="problem">
                <div>
                  <b>{p.name}</b> <span className="hint">{p.namespace}</span> <span className={problems[0].level === "bad" ? "font-medium text-bad" : "font-medium text-warn"}>{problems[0].title}</span>
                </div>
                <Button size="xs" aria-label={`Open ${p.name}`} onClick={() => setOpen(p)}>Open</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-meta">
        <div className="flex items-center gap-1.5 text-meta text-fg-muted">
          <span>Namespace</span>
          <Select aria-label="Namespace" value={ns || "all"} onChange={(v) => setNs(v === "all" ? "" : v)} options={[{ value: "all", label: "All namespaces" }, ...(spaces.data ?? []).map((n) => ({ value: n, label: n }))]} />
        </div>
        <span className="flex items-center gap-2">
          {env.k9s ? (
            <Button size="sm" variant="default" icon="cluster" onClick={() => invoke("open_terminal", { kind: "k9s", context: kctx }).catch((e) => setError(String(e)))}>Open in k9s</Button>
          ) : (
            <span className="hint">Want a terminal UI? <code>brew install k9s</code></span>
          )}
        </span>
      </div>
      <Banner error={error ?? pods.error} onClose={() => setError(null)} />

      <Tabs value={view} onChange={(v) => setView(v as (typeof VIEWS)[number])} items={VIEWS.map((v) => ({ value: v, label: v }))} aria-label="Kubernetes resources">
      <TabPanel value="Pods">
        <table>
          <thead><tr><th scope="col">Name</th><th scope="col">Namespace</th><th scope="col">Ready</th><th scope="col">Status</th><th scope="col">Restarts</th><th scope="col">Age</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {inNs(pods.data)
              .sort((a, b) => Number(podProblems(b, 0).length > 0) - Number(podProblems(a, 0).length > 0) || a.name.localeCompare(b.name))
              .map((p) => (
                <tr key={`${p.namespace}/${p.name}`}>
                  <td><b>{p.name}</b></td>
                  <td>{p.namespace}</td>
                  <td className="font-mono">{p.ready}</td>
                  <td><Badge variant={STATUS_VARIANT[badge(p.status)]}>{p.status}</Badge></td>
                  <td className="font-mono">{p.restarts}</td>
                  <td>{age(p.ageMs)}</td>
                  <td className="text-right"><Button size="xs" aria-label={`Open ${p.name}`} onClick={() => setOpen(p)}>Open</Button></td>
                </tr>
              ))}
          </tbody>
        </table>
      </TabPanel>
      <TabPanel value="Deployments">
        <table>
          <thead><tr><th scope="col">Name</th><th scope="col">Namespace</th><th scope="col">Ready</th></tr></thead>
          <tbody>
            {inNs(deployments.data).map((d) => (
              <tr key={`${d.namespace}/${d.name}`}>
                <td>{d.name}</td>
                <td>{d.namespace}</td>
                <td className={d.healthy ? "mono" : "mono in-use"}>{d.ready}{!d.healthy && " (fewer than wanted)"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabPanel>
      <TabPanel value="Services">
        <table>
          <thead><tr><th scope="col">Name</th><th scope="col">Namespace</th><th scope="col">Type</th><th scope="col">Address</th><th scope="col">Ports</th></tr></thead>
          <tbody>
            {inNs(services.data).map((s) => (
              <tr key={`${s.namespace}/${s.name}`}>
                <td>{s.name}</td><td>{s.namespace}</td><td>{s.type}</td><td className="font-mono">{s.address}</td><td className="font-mono">{s.ports}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabPanel>
      <TabPanel value="Events">
        <table>
          <thead><tr><th scope="col">When</th><th scope="col">Object</th><th scope="col">Reason</th><th scope="col">Message</th></tr></thead>
          <tbody>
            {inNs(events.data).slice(0, 80).map((e, i) => (
              <tr key={i}>
                <td>{ago(e.time, Date.now())}</td><td className="font-mono">{e.object}</td>
                <td><span className={`inline-flex rounded-xs px-1.5 text-micro ${e.warning ? "bg-bad-fill text-bad" : "bg-ok-fill text-ok"}`}>{e.reason}</span></td>
                <td>{e.message}{e.count > 1 ? ` (${e.count}×)` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabPanel>
      </Tabs>

      {open && <PodDrawer kctx={kctx} pod={open} problems={podProblems(open, Date.now())} events={events.data ?? []} onClose={() => setOpen(null)} />}
    </section>
  );
}

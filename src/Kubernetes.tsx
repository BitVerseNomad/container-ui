import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, ctxFor } from "./api";
import { usePoll } from "./hooks";
import InstallTool from "./InstallTool";
import PodDrawer from "./PodDrawer";
import { K8sEvent, Pod, parseDeployments, parseK8sEvents, parseNamespaces, parseNodes, parsePods, parseServices, podProblems } from "./lib/k8s";
import { ago } from "./lib/events";
import { Banner } from "./ui";
import Card from "./ui/Card";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";
import { useEnv } from "./useEnv";

const VIEWS = ["Pods", "Deployments", "Services", "Events"] as const;
const kubectl = (context: string | null, args: string[]) => invoke<string>("kubectl", { context, args });
const age = (ms: number) => ago(Date.now() - ms, Date.now()).replace(" ago", "");
const badge = (status: string) =>
  ["Running", "Succeeded", "Completed"].includes(status) ? "healthy" : ["Pending", "ContainerCreating", "PodInitializing", "Terminating"].includes(status) ? "starting" : "unhealthy";

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
  if (!env.kubectl) return <Card className="install-card"><InstallTool title="kubectl isn't installed" name="kubectl" hasBrew={!!env.brew} onDone={recheck} /></Card>;
  if (contexts === null) return <p className="hint">Looking for your cluster…</p>;
  if (!kctx) {
    return (
      <Card className="install-card">
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
    <section className="k8s">
      <div className="k8s-summary">
        <Card><b>{ready} node{ready === 1 ? "" : "s"} ready</b><span className="hint">{nodes.error ? "The cluster isn't answering yet" : (nodes.data ?? []).map((n) => n.version).filter(Boolean)[0] ?? ""}</span></Card>
        <Card><b>{running} pods running</b><span className="hint">of {(pods.data ?? []).length}</span></Card>
        <Card><b>{sick.length} need attention</b><span className="hint">{sick.length ? "see below" : "all good"}</span></Card>
      </div>

      {sick.length > 0 && (
        <div className="problems panel k8s-problems">
          <h2>Needs attention</h2>
          <ul>
            {sick.map(({ p, problems }) => (
              <li key={`${p.namespace}/${p.name}`} className="problem">
                <div>
                  <b>{p.name}</b> <span className="hint">{p.namespace}</span> <span className={`plevel ${problems[0].level}`}>{problems[0].title}</span>
                </div>
                <button onClick={() => setOpen(p)}>Open {p.name}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="k8s-bar">
        <label className="sort">
          Namespace
          <select aria-label="Namespace" value={ns} onChange={(e) => setNs(e.target.value)}>
            <option value="">All namespaces</option>
            {(spaces.data ?? []).map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <span className="k8s-tools">
          {env.k9s ? (
            <button onClick={() => invoke("open_terminal", { kind: "k9s", context: kctx }).catch((e) => setError(String(e)))}><Icon name="cluster" size={14} /> Open in k9s</button>
          ) : (
            <span className="hint">Want a terminal UI? <code>brew install k9s</code></span>
          )}
        </span>
      </div>
      <Banner error={error ?? pods.error} onClose={() => setError(null)} />

      <div className="tabs" role="tablist" aria-label="Kubernetes resources">
        {VIEWS.map((v) => (
          <button key={v} role="tab" aria-selected={v === view} className={v === view ? "tab active" : "tab"} onClick={() => setView(v)}>{v}</button>
        ))}
      </div>

      {view === "Pods" && (
        <table>
          <thead><tr><th scope="col">Name</th><th scope="col">Namespace</th><th scope="col">Ready</th><th scope="col">Status</th><th scope="col">Restarts</th><th scope="col">Age</th></tr></thead>
          <tbody>
            {inNs(pods.data)
              .sort((a, b) => Number(podProblems(b, 0).length > 0) - Number(podProblems(a, 0).length > 0) || a.name.localeCompare(b.name))
              .map((p) => (
                <tr key={`${p.namespace}/${p.name}`}>
                  <td><button className="link" onClick={() => setOpen(p)}>{p.name}</button></td>
                  <td>{p.namespace}</td>
                  <td className="mono">{p.ready}</td>
                  <td><span className={`hbadge ${badge(p.status)}`}>{p.status}</span></td>
                  <td className="mono">{p.restarts}</td>
                  <td>{age(p.ageMs)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
      {view === "Deployments" && (
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
      )}
      {view === "Services" && (
        <table>
          <thead><tr><th scope="col">Name</th><th scope="col">Namespace</th><th scope="col">Type</th><th scope="col">Address</th><th scope="col">Ports</th></tr></thead>
          <tbody>
            {inNs(services.data).map((s) => (
              <tr key={`${s.namespace}/${s.name}`}>
                <td>{s.name}</td><td>{s.namespace}</td><td>{s.type}</td><td className="mono">{s.address}</td><td className="mono">{s.ports}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {view === "Events" && (
        <table>
          <thead><tr><th scope="col">When</th><th scope="col">Object</th><th scope="col">Reason</th><th scope="col">Message</th></tr></thead>
          <tbody>
            {inNs(events.data).slice(0, 80).map((e, i) => (
              <tr key={i}>
                <td>{ago(e.time, Date.now())}</td><td className="mono">{e.object}</td>
                <td><span className={`hbadge ${e.warning ? "unhealthy" : "healthy"}`}>{e.reason}</span></td>
                <td>{e.message}{e.count > 1 ? ` (${e.count}×)` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {open && <PodDrawer kctx={kctx} pod={open} problems={podProblems(open, Date.now())} events={events.data ?? []} onClose={() => setOpen(null)} />}
    </section>
  );
}

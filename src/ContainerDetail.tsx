import { useState } from "react";
import { activity as commands, dockerLine } from "./lib/activity";
import Status from "./ui/Status";
import { useConfirm } from "./ui";
import { invoke } from "@tauri-apps/api/core";
import { docker } from "./api";
import { Inspect, publishedPortPairs } from "./containerInfo";
import { isWebPort } from "./lib/webPort";
import { CopyPort } from "./ui/PortLinks";
import { usePoll } from "./hooks";
import { Banner } from "./ui";
import Logs from "./Logs";
import StatsTab from "./StatsTab";
import ConnectionTest from "./ConnectionTest";
import { ActivityList, HealthPanel } from "./Health";
import { FixStatus, useFixRuns } from "./FixIt";
import { busy } from "./lib/fixStore";
import { Problem, parseState, problemsFor } from "./lib/health";

// Next to the state word, so a red dot beside "Running" says why.
const SHORT: Record<string, string> = { unhealthy: "Unhealthy", restarting: "Keeps restarting", oom: "Out of memory", crashed: "Stopped with an error", "kafka-localhost": "Only reachable from your Mac", "kafka-ui-empty": "No Kafka set up", "kafka-ui-localhost": "Can't reach Kafka" };
import { isKubeOwned } from "./lib/compose";
import { eventWindow, parseEvents, timeline } from "./lib/events";

const TABS = ["Logs", "Inspect", "Stats", "Mounts", "Network", "Activity"] as const;
type Tab = (typeof TABS)[number];
// appProblems: the Doctor's findings about this container that need the other containers to work out.
type Props = { ctx: string; id: string; appProblems?: Problem[]; onBack: () => void; onReplaced?: (name: string) => void };

export default function ContainerDetail({ ctx, id, appProblems, onBack, onReplaced }: Props) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("Logs");
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const { data: c, error, reload } = usePoll(async () => JSON.parse(await docker(ctx, ["inspect", id]))[0] as Inspect, [ctx, id]);

  async function act(args: string[], done?: () => void) {
    try {
      await commands.ran(args[0], dockerLine(ctx, args.map((a) => (a === id ? name : a))), () => docker(ctx, args), name);
      setErr(null);
      done?.();
    } catch (e) {
      setErr(String(e));
    }
    reload();
  }

  const name = c?.Name.replace(/^\//, "") ?? "Container";
  const paused = !!c?.State.Paused;
  const running = !!c?.State.Running && !paused;
  const raw = paused ? "paused" : c?.State.Status ?? "";
  const status = raw.charAt(0).toUpperCase() + raw.slice(1);
  const ports = running ? publishedPortPairs(c?.NetworkSettings.Ports) : [];
  const state = c ? parseState(JSON.stringify([c])) : null;
  const extra = appProblems ?? [];
  const problem = state ? [...problemsFor(state), ...extra][0] : undefined;
  const activity = usePoll(async () => timeline(parseEvents(await docker(ctx, ["events", ...eventWindow(Date.now(), 86_400_000), "--filter", `container=${name}`, "--filter", "type=container", "--format", "{{json .}}"])), 50, name), [ctx, name], 10000, !!c && tab === "Activity");
  // The cluster owns these: stopping or removing one by hand only makes Kubernetes start it again, or breaks the pod.
  const kube = !!c && (isKubeOwned({ Names: name }) || !!c.Config.Labels?.["io.kubernetes.pod.name"]);
  const ip = Object.values(c?.NetworkSettings.Networks ?? {})[0]?.IPAddress;
  // While a Fix swaps this container, Start, Stop or Remove would break the swap or lose the old one.
  const fixing = busy(useFixRuns(), name);

  return (
    <section className="detail">
      <button className="back" onClick={onBack}>← Containers</button>
      <header>
        <h2>{name}</h2>
        <Status level={problem?.level ?? (running ? "on" : paused ? "warn" : "off")}>{problem ? `${status} · ${problem.short ?? SHORT[problem.id] ?? problem.title}` : status}</Status>
        {c && kube && (
          <div className="actions-inline">
            {running && <button onClick={() => commands.ran("exec", dockerLine(ctx, ["exec", "-it", name, "sh"]), () => invoke("open_terminal", { kind: "shell", context: ctx, target: name }), name).catch((e) => setErr(String(e)))}>Open a shell</button>}
            <span className="hint">Managed by Kubernetes. Restart or remove it from the cluster, not here.</span>
          </div>
        )}
        {c && !kube && fixing && <span className="hint">A fix is running for this container.</span>}
        {c && !kube && !fixing && (
          <div className="actions-inline">
            {running && (
              <>
                <button onClick={() => commands.ran("exec", dockerLine(ctx, ["exec", "-it", name, "sh"]), () => invoke("open_terminal", { kind: "shell", context: ctx, target: name }), name).catch((e) => setErr(String(e)))}>Open a shell</button>
                <button onClick={() => act(["restart", id])}>Restart</button>
                <button onClick={() => act(["stop", id])}>Stop</button>
                <button onClick={() => act(["pause", id])}>Pause</button>
              </>
            )}
            {paused && (
              <>
                <button onClick={() => act(["unpause", id])}>Resume</button>
                <button onClick={() => act(["stop", id])}>Stop</button>
              </>
            )}
            {!running && !paused && <button onClick={() => act(["start", id])}>Start</button>}
            <button className="danger" onClick={async () => (await confirm(`Remove container "${name}"?`)) && act(["rm", "-f", id], onBack)}>
              Remove
            </button>
          </div>
        )}
      </header>

      <Banner error={error ?? err} onClose={() => setErr(null)} />

      {ports.length > 0 && (
        <p className="ports">
          Published on{" "}
          {ports.map((p) =>
            isWebPort(p.container, p.host) ? (
              <button key={p.host} className="link mono" onClick={() => invoke("open_url", { url: `http://localhost:${p.host}` }).catch((e) => setErr(String(e)))}>
                localhost:{p.host}
              </button>
            ) : (
              <CopyPort key={p.host} label={String(p.host)} />
            ),
          )}
        </p>
      )}

      {c && <FixStatus name={name} />}
      {state && <HealthPanel state={state} extra={extra} ctx={ctx} onFixed={onReplaced} onLogs={tab === "Logs" ? undefined : () => setTab("Logs")} />}

      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? "tab active" : "tab"} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      <div className="tabpane" role="tabpanel">
        {tab === "Logs" && <Logs ctx={ctx} id={id} />}
        {tab === "Stats" && <StatsTab ctx={ctx} id={id} running={running} />}
        {tab === "Activity" && (
          <>
            <p className="hint">What happened to {name} in the last day, newest first.</p>
            {activity.data === null ? <p className="hint">Loading…</p> : <ActivityList lines={activity.data} empty="Nothing notable has happened to this container recently." />}
          </>
        )}
        {tab === "Network" && c && (
          <>
            <p className="hint">Other containers on a shared network reach this one as <code>{name}</code>. The default bridge network doesn't do name lookup.</p>
            {Object.keys(c.NetworkSettings.Networks ?? {}).length === 0 ? (
              <p className="hint">This container isn't on any network.</p>
            ) : (
              <table>
                <thead><tr><th scope="col">Network</th><th scope="col">Address</th><th scope="col">Also known as</th></tr></thead>
                <tbody>
                  {Object.entries(c.NetworkSettings.Networks ?? {}).map(([net, v]) => (
                    <tr key={net}>
                      <td>{net}{net === "bridge" && <span className="tag">No name lookup</span>}</td>
                      <td className="mono">{v.IPAddress || "none"}</td>
                      <td className="mono">{(v.Aliases ?? []).join(", ") || "none"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div><button onClick={() => setTesting(true)}>Test a connection…</button></div>
          </>
        )}
        {tab === "Mounts" && c && (
          c.Mounts.length === 0 ? (
            <p className="hint">No mounts. Data written inside this container is lost when it is removed.</p>
          ) : (
            <table>
              <thead><tr><th>Type</th><th>Source</th><th>In container</th><th>Mode</th></tr></thead>
              <tbody>
                {c.Mounts.map((m) => (
                  <tr key={m.Destination}>
                    <td>{m.Type}</td>
                    <td className="mono clip" title={m.Source}>{m.Name ?? m.Source}</td>
                    <td className="mono">{m.Destination}</td>
                    <td>{m.RW ? "read-write" : "read-only"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {tab === "Inspect" && c && (
          <>
            <dl className="facts">
              <div><dt>Image</dt><dd className="mono">{c.Config.Image}</dd></div>
              <div><dt>Created</dt><dd>{new Date(c.Created).toLocaleString()}</dd></div>
              <div><dt>Command</dt><dd className="mono">{[c.Path, ...(c.Args ?? [])].join(" ")}</dd></div>
              <div><dt>IP address</dt><dd className="mono">{ip || "none"}</dd></div>
              <div><dt>Restart policy</dt><dd>{c.HostConfig.RestartPolicy?.Name || "no"}</dd></div>
              <div><dt>ID</dt><dd className="mono">{c.Id.slice(0, 12)}</dd></div>
            </dl>
            <h4>Environment</h4>
            <pre className="kv">{(c.Config.Env ?? []).join("\n") || "None"}</pre>
            <div className="row-head">
              <h4>Full JSON</h4>
              <button onClick={() => navigator.clipboard.writeText(JSON.stringify(c, null, 2))}>Copy</button>
            </div>
            <pre className="kv">{JSON.stringify(c, null, 2)}</pre>
          </>
        )}
      </div>
      {testing && <ConnectionTest ctx={ctx} from={name} onClose={() => setTesting(false)} />}
    </section>
  );
}

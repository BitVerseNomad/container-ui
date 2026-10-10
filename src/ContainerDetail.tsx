import { useState } from "react";
import { useConfirm } from "./ui";
import { invoke } from "@tauri-apps/api/core";
import { docker } from "./api";
import { Inspect, publishedPorts } from "./containerInfo";
import { usePoll } from "./hooks";
import { Banner } from "./ui";
import Logs from "./Logs";
import StatsTab from "./StatsTab";
import Doctor from "./Doctor";

const TABS = ["Logs", "Inspect", "Stats", "Mounts", "Network"] as const;
type Tab = (typeof TABS)[number];
type Props = { ctx: string; id: string; onBack: () => void };

export default function ContainerDetail({ ctx, id, onBack }: Props) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>("Logs");
  const [err, setErr] = useState<string | null>(null);
  const [doctor, setDoctor] = useState(false);
  const { data: c, error, reload } = usePoll(async () => JSON.parse(await docker(ctx, ["inspect", id]))[0] as Inspect, [ctx, id]);

  async function act(args: string[], done?: () => void) {
    try {
      await docker(ctx, args);
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
  const status = paused ? "paused" : c?.State.Status ?? "";
  const ports = running ? publishedPorts(c?.NetworkSettings.Ports) : [];
  const ip = Object.values(c?.NetworkSettings.Networks ?? {})[0]?.IPAddress;

  return (
    <section className="detail">
      <button className="back" onClick={onBack}>Back to containers</button>
      <header>
        <h2>{name}</h2>
        <span className={running ? "state on" : "state"}>{status}</span>
        {c && (
          <div className="actions-inline">
            {running && (
              <>
                <button onClick={() => act(["stop", id])}>Stop</button>
                <button onClick={() => act(["restart", id])}>Restart</button>
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
          {ports.map((p) => (
            <button key={p} className="link mono" onClick={() => invoke("open_url", { url: `http://localhost:${p}` }).catch((e) => setErr(String(e)))}>
              localhost:{p}
            </button>
          ))}
        </p>
      )}

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
            <div><button onClick={() => setDoctor(true)}>Troubleshoot a connection…</button></div>
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
      {doctor && <Doctor ctx={ctx} from={name} onClose={() => setDoctor(false)} />}
    </section>
  );
}

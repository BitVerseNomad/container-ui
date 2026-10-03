import { useState } from "react";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import Logs from "./Logs";

type C = { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string };

export default function Containers({ ctx }: { ctx: string }) {
  const { data, error, reload } = usePoll(() => dockerJson<C>(ctx, ["ps", "-a"]), [ctx]);
  const [logs, setLogs] = useState<C | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function act(args: string[]) {
    try {
      await docker(ctx, args);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
    reload();
  }

  if (logs) return <Logs ctx={ctx} id={logs.ID} name={logs.Names} onClose={() => setLogs(null)} />;

  return (
    <section>
      <h2>Containers</h2>
      <Banner error={error ?? err} onClose={() => setErr(null)} />
      {data && data.length === 0 && <Empty title="No containers">Run one with <code>docker run</code> and it will show up here.</Empty>}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr><th>Name</th><th>Image</th><th>Status</th><th>Ports</th><th /></tr>
          </thead>
          <tbody>
            {data.map((c) => {
              const up = c.State === "running";
              return (
                <tr key={c.ID}>
                  <td>{c.Names}</td>
                  <td className="mono">{c.Image}</td>
                  <td><span className={up ? "badge on" : "badge"}>{c.Status}</span></td>
                  <td className="mono clip" title={c.Ports}>{c.Ports || "none"}</td>
                  <td className="row-actions">
                    <button onClick={() => setLogs(c)}>Logs</button>
                    {up ? (
                      <>
                        <button onClick={() => act(["stop", c.ID])}>Stop</button>
                        <button onClick={() => act(["restart", c.ID])}>Restart</button>
                      </>
                    ) : (
                      <button onClick={() => act(["start", c.ID])}>Start</button>
                    )}
                    <button
                      className="danger"
                      onClick={() => confirm(`Remove container "${c.Names}"?`) && act(["rm", "-f", c.ID])}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

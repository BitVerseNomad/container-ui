import { useState } from "react";
import { useConfirm } from "./ui";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import ContainerDetail from "./ContainerDetail";

type C = { ID: string; Names: string; Image: string; State: string; Status: string; Ports: string };
type Props = { ctx: string; detailId: string | null; setDetailId: (id: string | null) => void };

export default function Containers({ ctx, detailId, setDetailId }: Props) {
  const confirm = useConfirm();
  const { data, error, reload } = usePoll(() => dockerJson<C>(ctx, ["ps", "-a"]), [ctx]);
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

  if (detailId) return <ContainerDetail ctx={ctx} id={detailId} onBack={() => setDetailId(null)} />;

  return (
    <section>
      <h2>Containers</h2>
      <Banner error={error ?? err} onClose={() => setErr(null)} />
      {data && data.length === 0 && (
        <Empty title="No containers">Open the Images tab and press Run on an image to start one.</Empty>
      )}
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
                  <td><button className="link" onClick={() => setDetailId(c.ID)}>{c.Names}</button></td>
                  <td className="mono">{c.Image}</td>
                  <td><span className={up ? "badge on" : "badge"}>{c.Status}</span></td>
                  <td className="mono clip" title={c.Ports}>{c.Ports || "none"}</td>
                  <td className="row-actions">
                    <button onClick={() => setDetailId(c.ID)}>Details</button>
                    {up ? (
                      <>
                        <button onClick={() => act(["stop", c.ID])}>Stop</button>
                        <button onClick={() => act(["restart", c.ID])}>Restart</button>
                      </>
                    ) : (
                      <button onClick={() => act(["start", c.ID])}>Start</button>
                    )}
                    <button className="danger" onClick={async () => (await confirm(`Remove container "${c.Names}"?`)) && act(["rm", "-f", c.ID])}>
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

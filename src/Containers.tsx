import { useState } from "react";
import IconButton from "./ui/IconButton";
import { useConfirm } from "./ui";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import ContainerDetail from "./ContainerDetail";
import { HealthBadge, stripHealth } from "./Health";
import { healthFromStatus } from "./lib/health";

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
      <Banner error={error ?? err} onClose={() => setErr(null)} />
      {data && data.length === 0 && (
        <Empty title="No containers">Open the Images tab and press Run on an image to start one.</Empty>
      )}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Image</th><th scope="col">Status</th><th scope="col">Ports</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {data.map((c) => {
              const up = c.State === "running";
              return (
                <tr key={c.ID}>
                  <td><button className="link" onClick={() => setDetailId(c.ID)}>{c.Names}</button></td>
                  <td className="mono">{c.Image}</td>
                  <td><span className={up ? "badge on" : "badge"}>{stripHealth(c.Status)}</span> <HealthBadge status={healthFromStatus(c.Status)} /></td>
                  <td className="mono clip" title={c.Ports}>{c.Ports || "none"}</td>
                  <td className="row-actions">
                    <IconButton label={`Logs for ${c.Names}`} icon="logs" onClick={() => setDetailId(c.ID)} />
                    {up ? (
                      <>
                        <IconButton label={`Stop ${c.Names}`} icon="stop" onClick={() => act(["stop", c.ID])} />
                        <IconButton label={`Restart ${c.Names}`} icon="restart" onClick={() => act(["restart", c.ID])} />
                      </>
                    ) : (
                      <IconButton label={`Start ${c.Names}`} icon="play" onClick={() => act(["start", c.ID])} />
                    )}
                    <IconButton label={`Remove ${c.Names}`} icon="trash" danger onClick={async () => (await confirm(`Remove container "${c.Names}"?`)) && act(["rm", "-f", c.ID])} />
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

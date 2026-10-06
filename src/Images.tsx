import { useState } from "react";
import IconButton from "./ui/IconButton";
import { useConfirm } from "./ui";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import PullPanel from "./PullPanel";
import RunPanel from "./RunPanel";

type I = { ID: string; Repository: string; Tag: string; Size: string; CreatedSince: string };

export default function Images({ ctx, onRan, startPull = false }: { ctx: string; onRan: (id: string) => void; startPull?: boolean }) {
  const confirm = useConfirm();
  const { data, error, reload } = usePoll(() => dockerJson<I>(ctx, ["images"]), [ctx], 5000);
  const [err, setErr] = useState<string | null>(null);
  const [pulling, setPulling] = useState(startPull);
  const [running, setRunning] = useState<string | null>(null);

  async function act(args: string[]) {
    try {
      await docker(ctx, args);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
    reload();
  }

  return (
    <section>
      <header>
        <button className="primary" onClick={() => setPulling(true)}>Pull image</button>
        <button
          className="danger"
          onClick={async () => (await confirm("Remove all images not used by a container?")) && act(["image", "prune", "-a", "-f"])}
        >
          Remove unused
        </button>
      </header>
      <Banner error={error ?? err} onClose={() => setErr(null)} />
      {data && data.length === 0 && (
        <Empty title="No images">Use <strong>Pull image</strong> to download one from Docker Hub.</Empty>
      )}
      {data && data.length > 0 && (
        <table>
          <thead>
            <tr><th scope="col">Repository</th><th scope="col">Tag</th><th scope="col">ID</th><th scope="col">Size</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {data.map((i) => {
              const ref = i.Repository === "<none>" ? i.ID : `${i.Repository}:${i.Tag}`;
              return (
                <tr key={i.ID + ref}>
                  <td>{i.Repository}</td>
                  <td className="mono">{i.Tag}</td>
                  <td className="mono">{i.ID}</td>
                  <td className="mono">{i.Size}</td>
                  <td>{i.CreatedSince}</td>
                  <td className="row-actions">
                    <IconButton label={`Run ${ref}`} icon="play" onClick={() => setRunning(ref)} />
                    <IconButton label={`Remove ${ref}`} icon="trash" danger onClick={async () => (await confirm(`Remove image ${ref}?`)) && act(["rmi", ref])} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {pulling && (
        <PullPanel
          ctx={ctx}
          onClose={() => setPulling(false)}
          onPulled={reload}
          onRun={(image) => {
            setPulling(false);
            setRunning(image);
          }}
        />
      )}
      {running && <RunPanel ctx={ctx} image={running} onClose={() => setRunning(null)} onRan={onRan} />}
    </section>
  );
}

import { useState } from "react";
import { useConfirm } from "./ui";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import PullPanel from "./PullPanel";
import RunPanel from "./RunPanel";

type I = { ID: string; Repository: string; Tag: string; Size: string; CreatedSince: string };

export default function Images({ ctx, onRan }: { ctx: string; onRan: (id: string) => void }) {
  const confirm = useConfirm();
  const { data, error, reload } = usePoll(() => dockerJson<I>(ctx, ["images"]), [ctx], 5000);
  const [err, setErr] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
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
        <h2>Images</h2>
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
            <tr><th>Repository</th><th>Tag</th><th>ID</th><th>Size</th><th>Created</th><th /></tr>
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
                    <button onClick={() => setRunning(ref)}>Run</button>
                    <button className="danger" onClick={async () => (await confirm(`Remove image ${ref}?`)) && act(["rmi", ref])}>
                      Remove
                    </button>
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

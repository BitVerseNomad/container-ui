import { useState } from "react";
import { score } from "./lib/fuzzy";
import IconButton from "./ui/IconButton";
import { useConfirm } from "./ui";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import PullPanel from "./PullPanel";
import { formatBytes, parseBytes } from "./containerInfo";
import RunPanel from "./RunPanel";
import DiskCard from "./DiskCard";
import { Icon } from "./ui/icons";
import { activity, dockerLine } from "./lib/activity";

type I = { ID: string; Repository: string; Tag: string; Size: string; CreatedSince: string };

export default function Images({ ctx, onRan, startPull = false, arch }: { ctx: string; onRan: (id: string) => void; startPull?: boolean; arch?: string }) {
  const confirm = useConfirm();
  const { data, error, reload } = usePoll(() => dockerJson<I>(ctx, ["images"]), [ctx], 5000);
  const [err, setErr] = useState<string | null>(null);
  const [pulling, setPulling] = useState(startPull);
  const [hubTerm, setHubTerm] = useState<string | undefined>(undefined);
  const [running, setRunning] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const shown = (data ?? []).filter((i) => score(`${i.Repository}:${i.Tag}`, q) > 0);

  async function act(args: string[]) {
    try {
      await activity.ran(args[0], dockerLine(ctx, args), () => docker(ctx, args), args.length > 1 && !args[args.length - 1].startsWith("-") ? args[args.length - 1] : undefined);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
    reload();
  }

  return (
    <section>
      <header>
        <button className="primary icon-label" onClick={() => { setHubTerm(undefined); setPulling(true); }}><Icon name="download" size={13} /> Pull image</button>
      </header>
      <Banner error={error ?? err} onClose={() => setErr(null)} />
      <DiskCard ctx={ctx} onChanged={reload} />
      {data && data.length === 0 && (
        <Empty title="No images">Use <strong>Pull image</strong> to download one from Docker Hub.</Empty>
      )}
      {data && data.length > 0 && (
        <label className="search-field image-search">
          <Icon name="search" size={14} />
          <input placeholder="Search your images" aria-label="Search your images" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      )}
      {data && data.length > 0 && shown.length === 0 && (
        <p className="hint pad">
          No image here matches "{q.trim()}". <button className="link-plain inline-link" onClick={() => { setHubTerm(q.trim()); setPulling(true); }}>Find it on Docker Hub</button>
        </p>
      )}
      {shown.length > 0 && (
        <table>
          <thead>
            <tr><th scope="col">Repository</th><th scope="col">Tag</th><th scope="col">ID</th><th scope="col" className="num">Size</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {shown.map((i) => {
              const ref = i.Repository === "<none>" ? i.ID : `${i.Repository}:${i.Tag}`;
              return (
                <tr key={i.ID + ref}>
                  <td>{i.Repository}</td>
                  <td className="mono">{i.Tag}</td>
                  <td className="mono">{i.ID}</td>
                  <td className="num">{parseBytes(i.Size) ? formatBytes(parseBytes(i.Size)) : i.Size}</td>
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
          searchFor={hubTerm}
          onClose={() => setPulling(false)}
          onPulled={reload}
          onRun={(image) => {
            setPulling(false);
            setRunning(image);
          }}
        />
      )}
      {running && <RunPanel ctx={ctx} arch={arch} image={running} onClose={() => setRunning(null)} onRan={onRan} />}
    </section>
  );
}

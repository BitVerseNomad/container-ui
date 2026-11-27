import { useState } from "react";
import { score } from "./lib/fuzzy";
import { useConfirm } from "./ui";
import { docker, dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner, Empty } from "./ui";
import PullPanel from "./PullPanel";
import { formatBytes, parseBytes } from "./containerInfo";
import RunPanel from "./RunPanel";
import DiskCard from "./DiskCard";
import { Button as OpButton, Field } from "./ui/op";
import { Header } from "./Header";
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
    <>
      <Header title="Images">
        <OpButton variant="primary" icon="download" onClick={() => { setHubTerm(undefined); setPulling(true); }}>Pull image</OpButton>
      </Header>
      <Banner error={error ?? err} onClose={() => setErr(null)} />
      {data && data.length === 0 && (
        <Empty title="No images">Use <strong>Pull image</strong> to download one from Docker Hub.</Empty>
      )}
      {data && data.length > 0 && (
        <Field placeholder="Search your images" aria-label="Search your images" icon="search" width="search" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      {data && data.length > 0 && shown.length === 0 && (
        <p className="hint py-2">
          No image here matches "{q.trim()}". <OpButton variant="ghost" size="xs" onClick={() => { setHubTerm(q.trim()); setPulling(true); }}>Find it on Docker Hub</OpButton>
        </p>
      )}
      {shown.length > 0 && (
        <table>
          <thead>
            <tr><th scope="col">Repository</th><th scope="col">Tag</th><th scope="col">ID</th><th scope="col" className="text-right tabular-nums">Size</th><th scope="col">Created</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
          </thead>
          <tbody>
            {shown.map((i) => {
              const ref = i.Repository === "<none>" ? i.ID : `${i.Repository}:${i.Tag}`;
              return (
                <tr key={i.ID + ref}>
                  <td className="break-all">{i.Repository}</td>
                  <td className="font-mono">{i.Tag}</td>
                  <td className="font-mono">{i.ID}</td>
                  <td className="whitespace-nowrap text-right tabular-nums">{parseBytes(i.Size) ? formatBytes(parseBytes(i.Size)) : i.Size}</td>
                  <td className="whitespace-nowrap">{i.CreatedSince}</td>
                  <td className="whitespace-nowrap text-right">
                    <OpButton variant="ghost" size="sm" icon="play" aria-label={`Run ${ref}`} onClick={() => setRunning(ref)}>Run</OpButton>
                    <OpButton variant="danger-quiet" size="sm" icon="trash" aria-label={`Remove ${ref}`} onClick={async () => (await confirm(`Remove image ${ref}?`)) && act(["rmi", ref])}>Remove</OpButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <details className="mt-4">
        <summary className="hint cursor-pointer">Free up space in the VM</summary>
        <div className="mt-2"><DiskCard ctx={ctx} onChanged={reload} /></div>
      </details>
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
    </>
  );
}

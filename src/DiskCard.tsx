import { useState } from "react";
import { docker } from "./api";
import { usePoll } from "./hooks";
import { Banner, useConfirm } from "./ui";
import { DiskKind, formatDf, parseDiskUsage } from "./lib/disk";

type RowInfo = { label: string; button?: { text: string; args: string[]; ask: string; confirmLabel: string }; note?: string };

// "container prune" is not in the backend allowlist (src-tauri/src/main.rs), so stopped containers have no button here.
const ROWS: Record<DiskKind, RowInfo> = {
  buildCache: {
    label: "Build cache",
    button: { text: "Clear build cache", args: ["builder", "prune", "-f"], ask: "Clear the build cache? Your next image build will be slower while it fills again.", confirmLabel: "Clear" },
  },
  images: {
    label: "Images",
    button: { text: "Remove unused images", args: ["image", "prune", "-a", "-f"], ask: "Remove all images not used by a container? You can pull them again later.", confirmLabel: "Remove" },
  },
  containers: { label: "Stopped containers", note: "Remove them in Containers." },
  volumes: { label: "Volumes", note: "Volumes hold your data, remove them one by one in Volumes." },
};

export default function DiskCard({ ctx, onChanged }: { ctx: string; onChanged?: () => void }) {
  const confirm = useConfirm();
  const { data, error, reload } = usePoll(async () => parseDiskUsage(await docker(ctx, ["system", "df", "--format", "{{json .}}"])), [ctx], 30000);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(args: string[]) {
    setBusy(true);
    try {
      await docker(ctx, args);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    }
    setBusy(false);
    reload();
    onChanged?.();
  }

  return (
    <div className="panel disk-card" aria-labelledby="disk-title">
      <h3 id="disk-title">Space inside the VM</h3>
      <Banner error={error ?? err} onClose={() => setErr(null)} />
      <div className="disk-table" role="table" aria-label="Space used by type">
        <div className="disk-row disk-head" role="row">
          <span role="columnheader">Type</span><span role="columnheader">Size</span><span role="columnheader">Can be freed</span><span role="columnheader"><span className="sr-only">Actions</span></span>
        </div>
          {(data ?? parseDiskUsage("")).map((r) => {
            const info = ROWS[r.kind];
            const b = info.button;
            return (
              <div className="disk-row" role="row" key={r.kind}>
                <span role="cell">{info.label}</span>
                <span role="cell" className="mono">{data ? formatDf(r.size) : "…"}</span>
                <span role="cell" className="mono">{data ? formatDf(r.reclaimable) : "…"}</span>
                <span role="cell" className="disk-action">
                  {b ? (
                    <button disabled={busy} onClick={async () => (await confirm(b.ask, b.confirmLabel)) && run(b.args)}>{b.text}</button>
                  ) : (
                    <span className="hint">{info.note}</span>
                  )}
                </span>
              </div>
            );
          })}
      </div>
      <p className="hint">Freeing space here does not always shrink the VM's disk file on your Mac.</p>
    </div>
  );
}

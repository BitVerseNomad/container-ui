// Compose projects found on the Mac, next to what is already running from them.
import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import Drawer from "./ui/Drawer";
import { Banner } from "./ui";
import { Icon } from "./ui/icons";
import { ComposeScan } from "./useComposeScan";
import { projectsFrom, upCommand } from "./lib/composeScan";

type Ctr = { State: string; Labels?: string };
// The backend sends one path past this cap when the list was cut.
const SHOWN_MAX = 300;
const tilde = (dir: string) => dir.replace(/^\/Users\/[^/]+/, "~");

function CopyCommand({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      aria-label={label}
      title={text}
      onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }, () => {})}
    >
      <Icon name="copy" size={13} /> {done ? "Copied" : "Copy"}
    </button>
  );
}

export default function ComposeProjects({ ctx, scan, containers, onClose }: { ctx: string; scan: ComposeScan; containers: Ctr[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const cut = (scan.paths?.length ?? 0) > SHOWN_MAX;
  const all = useMemo(() => projectsFrom((scan.paths ?? []).slice(0, SHOWN_MAX), containers), [scan.paths, containers]);
  const rows = all.filter((p) => `${p.name} ${p.dir}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Drawer label="Compose projects" title={<>Compose projects</>} onClose={onClose}>
      <p className="hint">
        Folders in your home with a Compose file, found with Spotlight. This app doesn't start or stop projects, because a Compose file can mount any folder and run any image. Copy the command and run it in Terminal.
      </p>
      <div className="inline">
        <label className="search-field">
          <Icon name="search" size={14} />
          <input placeholder="Search projects" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button onClick={() => scan.scan()} disabled={scan.scanning}><Icon name="restart" size={13} /> {scan.scanning ? "Scanning…" : "Scan again"}</button>
      </div>
      <Banner error={scan.error ?? err} onClose={() => setErr(null)} />
      {scan.paths && all.length === 0 && <p className="hint">No Compose files found. Spotlight skips hidden folders and folders it doesn't index.</p>}
      {cut && <p className="hint">Showing the first {SHOWN_MAX} Compose files, A to Z. Search to narrow the list.</p>}
      {all.length > 0 && rows.length === 0 && <p className="hint">No project matches that search.</p>}
      <ul className="compose-list">
        {rows.map((p) => (
          <li key={p.dir} className="compose-item">
            <div className="compose-head">
              <span className={p.running ? "sdot on" : "sdot"} aria-hidden="true" />
              <b>{p.name}</b>
              <span className="hint">{p.total ? `${p.running} of ${p.total} running` : "Not running"}</span>
            </div>
            <span className="mono sub clip" title={`${p.dir}/${p.files.join(", ")}`}>{tilde(p.dir)}/{p.files.join(", ")}</span>
            <pre className="cmd">{upCommand(p.dir, ctx)}</pre>
            <div className="actions-inline">
              <CopyCommand text={upCommand(p.dir, ctx)} label={`Copy start command for ${p.name}`} />
              <button
                aria-label={`Show ${p.name} in Finder`}
                onClick={() => invoke("reveal_compose", { path: `${p.dir}/${p.files[0]}` }).then(() => setErr(null), (e) => setErr(String(e)))}
              >
                Show in Finder
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

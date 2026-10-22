import { invoke } from "@tauri-apps/api/core";
import { portLinksFromPs } from "../containerInfo";

const SHOWN = 3;

// One click opens a published port in the browser, like Docker Desktop. Stopped containers show nothing to click.
// The full docker port text stays in the tooltip, so UDP and unpublished ports are still visible on hover.
export default function PortLinks({ ports, running, name }: { ports: string; running: boolean; name: string }) {
  const links = running ? portLinksFromPs(ports) : [];
  if (!links.length) return <span className="hint" title={ports || undefined}>{ports && !running ? "stopped" : "–"}</span>;
  const extra = links.length - SHOWN;
  return (
    <span className="port-links" title={ports}>
      {links.slice(0, SHOWN).map((l) => (
        <button key={l.label} className="port-link mono" aria-label={`Open ${name} at localhost:${l.port} in your browser`} title={`http://localhost:${l.port}`} onClick={() => invoke("open_url", { url: `http://localhost:${l.port}` }).catch(() => {})}>
          {l.label} <span aria-hidden="true">↗</span>
        </button>
      ))}
      {extra > 0 && <span className="hint">+{extra}</span>}
    </span>
  );
}

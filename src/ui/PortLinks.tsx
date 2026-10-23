import { useState } from "react";
import { openUrl } from "../api";
import { portLinksFromPs } from "../containerInfo";
import { isWebPort } from "../lib/webPort";
import { Icon } from "./icons";

const SHOWN = 3;

// A port that is not a web page (a database, a broker): a muted chip that copies "localhost:3306" on click.
// It shows only the port, like the web chips, so it fits the Ports column.
export function CopyPort({ label }: { label: string }) {
  const [copied, setCopied] = useState(false);
  const text = `localhost:${label}`;
  return (
    <button
      className="port-link muted mono"
      aria-label={`Copy ${text}`}
      title={`Copy ${text}`}
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }, () => {});
      }}
    >
      {copied ? "Copied" : <>{label} <Icon name="copy" size={11} /></>}
    </button>
  );
}

export function WebPort({ port, label, name }: { port: number; label: string; name: string }) {
  return (
    <button className="port-link mono" aria-label={`Open ${name} at localhost:${port} in your browser`} title={`http://localhost:${port}`} onClick={() => openUrl(`http://localhost:${port}`)}>
      {label} <span aria-hidden="true">↗</span>
    </button>
  );
}

// One click opens a published web port in the browser, like Docker Desktop. Other ports (databases and the like)
// copy their address instead, because a browser tab would only show an error. Stopped containers show nothing to click.
// The full docker port text stays in the tooltip, so UDP and unpublished ports are still visible on hover.
export default function PortLinks({ ports, running, name }: { ports: string; running: boolean; name: string }) {
  const links = running ? portLinksFromPs(ports) : [];
  if (!links.length) return <span className="hint" title={ports || undefined}>{ports && !running ? "stopped" : "–"}</span>;
  const extra = links.length - SHOWN;
  return (
    <span className="port-links" title={ports}>
      {links.slice(0, SHOWN).map((l) =>
        isWebPort(l.containerPort, l.port) ? <WebPort key={l.label} port={l.port} label={l.label} name={name} /> : <CopyPort key={l.label} label={l.label} />,
      )}
      {extra > 0 && <span className="hint">+{extra}</span>}
    </span>
  );
}

import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "./api";
import { ReactNode, useEffect, useRef, useState } from "react";
import { docker, dockerJson } from "./api";
import { ImageInfo, Link, checkImage, docsLinks, hostArch, nameWarning, nextFreePort, parseImageInfo, peers, portWarnings, suggestVolumes, usedHostPorts } from "./lib/guided";
import { PortRow, VolRow, buildRunArgs, defaultName, folderProblem, hintFor, isHostFolder, presetEnv, repoName, shouldCleanup } from "./runArgs";
import { rememberWritable, wasWritable } from "./lib/folderMemory";
import { Banner } from "./ui";
import Drawer from "./ui/Drawer";
import { Icon } from "./ui/icons";
import { useDockerLocked } from "./dockerLock";

type Props = { ctx: string; image: string; arch?: string; onClose: () => void; onRan: (id: string) => void };
type Ctr = { Names: string; State: string; Ports: string };

const DEFAULT_NET = "devnet";
const BUILTIN_NETS = new Set(["bridge", "host", "none"]);
const BRIDGE_DOCS: Link = { url: "https://docs.docker.com/engine/network/drivers/bridge/", host: "docs.docker.com" };
const STORAGE_DOCS: Link = { url: "https://docs.docker.com/engine/storage/", host: "docs.docker.com" };
const suffix = () => Math.random().toString(36).slice(2, 6);
const shellQuote = (a: string) => (/[^\w@%+=:,./-]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a);

// Links open in the user's browser, after a click, and always show where they go.
function Ext({ link, children }: { link: Link; children: ReactNode }) {
  return (
    <button className="link ext" onClick={() => openUrl(link.url)}>
      {children} <span className="host">({link.host})</span>
    </button>
  );
}

export default function RunPanel({ ctx, image, arch, onClose, onRan }: Props) {
  const [name, setName] = useState("");
  const [placeholder] = useState(() => defaultName(image, suffix()));
  const [info, setInfo] = useState<ImageInfo | null>(null);
  const [containers, setContainers] = useState<Ctr[]>([]);
  const [networks, setNetworks] = useState<string[] | null>(null);
  const [network, setNetwork] = useState(DEFAULT_NET);
  const [onNetwork, setOnNetwork] = useState<Ctr[]>([]);
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [volumes, setVolumes] = useState<VolRow[]>([]);
  const [env, setEnv] = useState(presetEnv(image));
  const [exposeAll, setExposeAll] = useState(false);
  const [volumeNames, setVolumeNames] = useState<string[]>([]);
  const [showCmd, setShowCmd] = useState(false);
  // The command opens above the panel's sticky footer, not hidden behind it.
  const cmdBox = useRef<HTMLPreElement>(null);
  useEffect(() => { if (showCmd) cmdBox.current?.scrollIntoView?.({ block: "nearest" }); }, [showCmd]);
  const [busy, setBusy] = useState(false);
  // Nothing new starts while the VM, a resize, a Bring over copy, a Compose run or a Fix is changing Docker.
  const locked = useDockerLocked();
  const [errors, setErrors] = useState<string[]>([]);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const hasPreset = presetEnv(image) !== "";
  const finalName = name.trim() || placeholder;

  useEffect(() => {
    docker(ctx, ["image", "inspect", image])
      .then((out) => {
        const i = parseImageInfo(out);
        setInfo(i);
        if (i) {
          setPorts(i.ports.map((p) => ({ host: p, container: p })));
          setVolumes(suggestVolumes(repoName(image), i.volumes));
        }
      })
      .catch(() => {});
    dockerJson<Ctr>(ctx, ["ps", "-a"]).then(setContainers).catch(() => {});
    dockerJson<{ Name: string }>(ctx, ["network", "ls"]).then((r) => setNetworks(r.map((n) => n.Name))).catch(() => setNetworks([]));
    dockerJson<{ Name: string }>(ctx, ["volume", "ls"]).then((v) => setVolumeNames(v.map((x) => x.Name))).catch(() => {});
  }, [ctx, image]);

  const exists = !!network && !!networks?.includes(network);
  useEffect(() => {
    if (!exists) return setOnNetwork([]);
    dockerJson<Ctr>(ctx, ["ps", "--filter", `network=${network}`]).then(setOnNetwork).catch(() => setOnNetwork([]));
  }, [ctx, network, exists]);

  const userNets = (networks ?? []).filter((n) => !BUILTIN_NETS.has(n));
  const netOptions = userNets.includes(DEFAULT_NET) ? userNets : [...userNets, DEFAULT_NET];
  const links = info ? docsLinks(image, info.labels) : null;
  const usedPorts = usedHostPorts(containers);
  const clashRows = ports.map((r, i) => (r.host && usedPorts.has(r.host) ? i : -1)).filter((i) => i >= 0);
  const warnings = [
    ...(info ? checkImage(image, info, hostArch(arch ?? "")) : []),
    ...portWarnings(ports, usedPorts),
    ...(nameWarning(finalName, containers) ? [nameWarning(finalName, containers)!] : []),
  ];
  const built = buildRunArgs({ image, name: finalName, ports, volumes, env, exposeAll, network });

  async function run() {
    if (locked) return;
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors([]);
    setDockerError(null);
    setBusy(true);
    try {
      if (network && !exists) await docker(ctx, ["network", "create", network]);
      const id = (await docker(ctx, built.args)).trim();
      onRan(id);
    } catch (e) {
      const msg = String(e);
      if (shouldCleanup(msg)) await docker(ctx, ["rm", "-f", finalName]).catch(() => {});
      setDockerError(msg);
      setBusy(false);
    }
  }

  const setPort = (i: number, patch: Partial<PortRow>) => setPorts((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setVol = (i: number, patch: Partial<VolRow>) => setVolumes((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const others = peers(onNetwork);
  // A folder the user let containers change before stays that way; any other folder starts read-only.
  const setSource = (i: number, source: string) => setVol(i, { source, writable: isHostFolder(source) && !folderProblem(source) ? wasWritable(source.trim()) : false });
  async function chooseFolder(i: number) {
    try {
      const picked = await invoke<string | null>("pick_folder");
      if (picked) setSource(i, picked);
    } catch (e) {
      setErrors([`Couldn't open the folder chooser: ${e}`]);
    }
  }

  return (
    <Drawer label={`Run ${image}`} title={<>Run {image}</>} onClose={onClose} closeDisabled={busy}>
      <div className="notes">
        Many images need a setting or two before they start.{" "}
        {links?.docs ? <Ext link={links.docs}>Read the setup notes</Ext> : links?.hub ? <Ext link={links.hub}>Read the setup notes</Ext> : "Check the image's page on its registry for setup notes."}
        {links?.docs && links.hub && <> · <Ext link={links.hub}>Docker Hub page</Ext></>}
        {links?.source && <> · <Ext link={links.source}>Source code</Ext></>}
      </div>

      <label>
        Name
        <input value={name} placeholder={placeholder} disabled={busy} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="group">
        <h4>Network</h4>
        <p className="hint">Containers on the same network reach each other by name, like <code>{finalName}</code>. <Ext link={BRIDGE_DOCS}>Why?</Ext></p>
        <select aria-label="Network" value={network} disabled={busy} onChange={(e) => setNetwork(e.target.value)}>
          {netOptions.map((n) => (
            <option key={n} value={n}>{networks?.includes(n) ? n : `${n} (new, created for you)`}</option>
          ))}
          <option value="">Default network (containers can't find each other by name)</option>
        </select>
        {!!network && !exists && <p className="hint">{network} doesn't exist yet. It will be created when you press Run.</p>}
        {others.length > 0 && (
          <div className="peers">
            <span className="hint">Already on {network}:</span>
            {others.map((p) => (
              <span key={p.name} className="peer">
                <b>{p.name}</b>
                {p.ports.length === 0 && <span className="hint">no ports</span>}
                {p.ports.slice(0, 3).map((port) => (
                  <button key={port} className="chip" onClick={() => navigator.clipboard.writeText(`${p.name}:${port}`)} title={`Copy ${p.name}:${port}`}>
                    <Icon name="copy" size={12} /> {p.name}:{port}
                  </button>
                ))}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="group">
        <h4>Ports</h4>
        <p className="hint">
          {info && info.ports.length ? `The image says it listens on ${info.ports.join(", ")}. ` : ""}
          Port on your Mac, then the port inside the container. Other containers don't need these; they connect by name.
        </p>
        {ports.map((p, i) => (
          <div className="pair" key={i}>
            <input aria-label="Host port" placeholder="host" value={p.host} disabled={busy} onChange={(e) => setPort(i, { host: e.target.value })} />
            <span className="arrow">:</span>
            <input aria-label="Container port" placeholder="container" value={p.container} disabled={busy} onChange={(e) => setPort(i, { container: e.target.value })} />
            <button aria-label="Remove port" disabled={busy} onClick={() => setPorts((r) => r.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button disabled={busy} onClick={() => setPorts((r) => [...r, { host: "", container: "" }])}>Add port</button>
        <label className="check">
          <input type="checkbox" checked={exposeAll} disabled={busy} onChange={(e) => setExposeAll(e.target.checked)} />
          Let other devices on my network connect
        </label>
        <p className="hint">{exposeAll ? "Anyone on your network can reach these ports." : "Only this Mac can reach these ports."}</p>
      </div>

      <div className="group">
        <h4>Data</h4>
        <p className="hint">
          {info && info.volumes.length
            ? `The image keeps data in ${info.volumes.join(", ")}. Without a named volume that data is lost when the container is recreated. `
            : "This image doesn't declare a data folder. Add a volume if it keeps files you want to keep. "}
          <Ext link={STORAGE_DOCS}>Learn more</Ext>
        </p>
        <datalist id="volume-names">{volumeNames.map((v) => <option key={v} value={v} />)}</datalist>
        {volumes.map((v, i) => {
          const problem = folderProblem(v.source);
          return (
            <div className="vol" key={i}>
              <div className="pair with-pick">
                <input aria-label="Volume source" list="volume-names" placeholder="name or /path" value={v.source} disabled={busy} onChange={(e) => setSource(i, e.target.value)} />
                <button aria-label={`Choose folder for volume ${i + 1}`} disabled={busy} onClick={() => chooseFolder(i)}>Choose folder…</button>
                <span className="arrow">:</span>
                <input aria-label="Path in container" placeholder="/data" value={v.target} disabled={busy} onChange={(e) => setVol(i, { target: e.target.value })} />
                <button aria-label="Remove volume" disabled={busy} onClick={() => setVolumes((r) => r.filter((_, j) => j !== i))}>×</button>
              </div>
              {problem && <p className="hint err">{problem}</p>}
              {isHostFolder(v.source) && !problem && (
                <label className="check">
                  <input
                    type="checkbox"
                    checked={!!v.writable}
                    disabled={busy}
                    onChange={(e) => {
                      setVol(i, { writable: e.target.checked });
                      rememberWritable(v.source.trim(), e.target.checked);
                    }}
                  />
                  Let the container change files here
                </label>
              )}
            </div>
          );
        })}
        <button disabled={busy} onClick={() => setVolumes((r) => [...r, { source: "", target: "" }])}>Add volume</button>
      </div>

      <div className="group">
        <h4>Settings</h4>
        <p className="hint">
          {hasPreset ? "This image needs a password to start. Change dev if you like. " : ""}
          Add your own, one KEY=value per line.
        </p>
        {info && info.env.length > 0 && (
          <details className="defaults how">
            <summary><Icon name="chevron" size={12} />The image sets {info.env.length} default{info.env.length > 1 ? "s" : ""} itself</summary>
            <pre className="kv">{info.env.join("\n")}</pre>
          </details>
        )}
        <textarea rows={4} value={env} disabled={busy} spellCheck={false} aria-label="Environment variables" onChange={(e) => setEnv(e.target.value)} />
      </div>

      {warnings.length > 0 && (
        <div className="group">
          <h4>Before you run</h4>
          <ul className="checks">
            {warnings.map((w) => (
              <li key={w}><Icon name="info" size={14} /><span>{w.split(/`([^`]+)`/).map((t, k) => (k % 2 ? <code key={k}>{t}</code> : t))}</span>{(() => {
                const i = clashRows.find((k) => w.startsWith(`Port ${ports[k].host} on this Mac`));
                if (i === undefined) return null;
                const next = nextFreePort(ports[i].host, usedPorts, ports);
                return <button className="small" disabled={busy} onClick={() => setPort(i, { host: next })}>Use {next} instead</button>;
              })()}</li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <div className="error" role="alert">
          <pre>{errors.join("\n")}</pre>
        </div>
      )}
      {dockerError && /port is already allocated|address already in use/i.test(dockerError)
        ? <div className="error" role="alert"><p>{hintFor(dockerError)}</p></div>
        : <><Banner error={dockerError} />{dockerError && hintFor(dockerError) && <p className="hint">{hintFor(dockerError)}</p>}</>}
      {busy && <p className="hint">Starting the container. If the image isn't downloaded yet, this includes the pull.</p>}

      <details className="how run-cmd" open={showCmd} onToggle={(e) => setShowCmd(e.currentTarget.open)}>
        <summary><Icon name="chevron" size={12} />Show command</summary>
        <pre className="cmd" ref={cmdBox}>{built.ok ? ["docker", ...built.args].map(shellQuote).join(" ") : "Fix the problems above to see the command."}</pre>
      </details>

      <div className="actions">
        <button disabled={busy} onClick={onClose}>Cancel</button>
        <button className="primary" disabled={busy} aria-disabled={locked || undefined} title={locked ? "Waits for what is changing Docker now" : undefined} onClick={run}>{busy ? "Starting…" : "Run"}</button>
      </div>
    </Drawer>
  );
}

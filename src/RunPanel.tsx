import { useEffect, useState } from "react";
import Drawer from "./ui/Drawer";
import { docker, dockerJson } from "./api";
import { PortRow, VolRow, buildRunArgs, defaultName, hintFor, parseExposedPorts, presetEnv, shouldCleanup } from "./runArgs";
import { Banner } from "./ui";

type Props = { ctx: string; image: string; onClose: () => void; onRan: (id: string) => void };

const suffix = () => Math.random().toString(36).slice(2, 6);

export default function RunPanel({ ctx, image, onClose, onRan }: Props) {
  const [name, setName] = useState("");
  const [placeholder] = useState(() => defaultName(image, suffix()));
  const [ports, setPorts] = useState<PortRow[]>([]);
  const [volumes, setVolumes] = useState<VolRow[]>([]);
  const [env, setEnv] = useState(presetEnv(image));
  const [exposeAll, setExposeAll] = useState(false);
  const [volumeNames, setVolumeNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const hasPreset = presetEnv(image) !== "";

  useEffect(() => {
    // Prefill ports from what the image says it listens on.
    docker(ctx, ["image", "inspect", "--format", "{{json .Config.ExposedPorts}}", image])
      .then((out) => setPorts(parseExposedPorts(out.trim()).map((p) => ({ host: p, container: p }))))
      .catch(() => {});
    dockerJson<{ Name: string }>(ctx, ["volume", "ls"])
      .then((v) => setVolumeNames(v.map((x) => x.Name)))
      .catch(() => {});
  }, [ctx, image]);

  async function run() {
    const finalName = name.trim() || placeholder;
    const built = buildRunArgs({ image, name: finalName, ports, volumes, env, exposeAll });
    if (!built.ok) {
      setErrors(built.errors);
      return;
    }
    setErrors([]);
    setDockerError(null);
    setBusy(true);
    try {
      const id = (await docker(ctx, built.args)).trim();
      onRan(id);
    } catch (e) {
      const msg = String(e);
      if (shouldCleanup(msg)) await docker(ctx, ["rm", "-f", finalName]).catch(() => {});
      setDockerError(msg);
      setBusy(false);
    }
  }

  const setPort = (i: number, patch: Partial<PortRow>) =>
    setPorts((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setVol = (i: number, patch: Partial<VolRow>) =>
    setVolumes((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <Drawer label={`Run ${image}`} title={<>Run {image}</>} onClose={onClose} closeDisabled={busy}>

        <label>
          Name
          <input value={name} placeholder={placeholder} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className="group">
          <h4>Ports</h4>
          <p className="hint">Port on your Mac, then the port inside the container. Prefilled from the image.</p>
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
          <p className="hint">{exposeAll ? "Anyone on your network can reach these ports." : "Only this Mac can reach these ports. Other containers don't use them; they connect by name."}</p>
        </div>

        <div className="group">
          <h4>Volumes</h4>
          <p className="hint">A volume name or an absolute path on your Mac, then the path inside the container. Your home folder is shared with Colima.</p>
          <datalist id="volume-names">
            {volumeNames.map((v) => <option key={v} value={v} />)}
          </datalist>
          {volumes.map((v, i) => (
            <div className="pair" key={i}>
              <input aria-label="Volume source" list="volume-names" placeholder="name or /path" value={v.source} disabled={busy} onChange={(e) => setVol(i, { source: e.target.value })} />
              <span className="arrow">:</span>
              <input aria-label="Path in container" placeholder="/data" value={v.target} disabled={busy} onChange={(e) => setVol(i, { target: e.target.value })} />
              <button aria-label="Remove volume" disabled={busy} onClick={() => setVolumes((r) => r.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <button disabled={busy} onClick={() => setVolumes((r) => [...r, { source: "", target: "" }])}>Add volume</button>
        </div>

        <div className="group">
          <h4>Environment</h4>
          <p className="hint">
            {hasPreset ? "This image needs a password to start. Change dev if you like." : "One KEY=value per line."}
          </p>
          <textarea rows={4} value={env} disabled={busy} spellCheck={false} onChange={(e) => setEnv(e.target.value)} />
        </div>

        {errors.length > 0 && (
          <div className="error" role="alert">
            <pre>{errors.join("\n")}</pre>
          </div>
        )}
        <Banner error={dockerError} />
        {dockerError && hintFor(dockerError) && <p className="hint">{hintFor(dockerError)}</p>}
        {busy && <p className="hint">Starting the container. If the image isn't downloaded yet, this includes the pull.</p>}

        <div className="actions">
          <button disabled={busy} onClick={onClose}>Cancel</button>
          <button className="primary" disabled={busy} onClick={run}>{busy ? "Starting…" : "Run"}</button>
        </div>
    </Drawer>
  );
}

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { docker, dockerJson } from "./api";
import { hubLink } from "./lib/guided";
import { Finding, ProbeResult, diagnose, parseContainerFacts, parseProbe, sharedNetworks } from "./lib/network";
import { Banner } from "./ui";
import Drawer from "./ui/Drawer";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";

type Ctr = { Names: string; State: string };
type Props = { ctx: string; from?: string; onClose: () => void };
const HELPER = "nicolaka/netshoot";
const ICON = { ok: "check", warn: "alert", fail: "close", info: "info" } as const;

export default function Doctor({ ctx, from: initialFrom, onClose }: Props) {
  const [containers, setContainers] = useState<Ctr[]>([]);
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState("");
  const [port, setPort] = useState("");
  const [ports, setPorts] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dockerJson<Ctr>(ctx, ["ps", "-a"]).then((c) => {
      setContainers(c);
      setFrom((f) => f || c.find((x) => x.State === "running")?.Names || "");
    }).catch((e) => setError(String(e)));
  }, [ctx]);

  // the target's declared ports become the port choices
  useEffect(() => {
    if (!to) return setPorts([]);
    docker(ctx, ["inspect", to]).then((out) => {
      const f = parseContainerFacts(out);
      setPorts(f?.ports ?? []);
      setPort((p) => p || String(f?.ports[0] ?? ""));
    }).catch(() => setPorts([]));
  }, [ctx, to]);

  async function check() {
    const portNum = Number(port);
    if (!from || !to || !Number.isInteger(portNum) || portNum < 1 || portNum > 65535) return setError("Choose both containers and a port from 1 to 65535.");
    setBusy(true);
    setError(null);
    setFindings(null);
    try {
      const [a, b] = await Promise.all([docker(ctx, ["inspect", from]), docker(ctx, ["inspect", to])]);
      const fromFacts = parseContainerFacts(a);
      const toFacts = parseContainerFacts(b);
      if (!fromFacts || !toFacts) throw new Error("Couldn't read those containers.");
      setImage(JSON.parse(b)[0]?.Config?.Image ?? null);
      let probe: ProbeResult | null = null;
      if (fromFacts.running && toFacts.running && sharedNetworks(fromFacts, toFacts).named.length > 0) {
        // The helper container lives in the client's network, so nothing has to exist inside the user's own image.
        const have = await docker(ctx, ["image", "inspect", HELPER]).then(() => true).catch(() => false);
        if (!have) {
          setPulling(true);
          await invoke("docker_pull", { context: ctx, image: HELPER });
          setPulling(false);
        }
        probe = parseProbe(await invoke<string>("network_probe", { context: ctx, from, target: to, port: portNum }));
      }
      // Services print the address they hand out while starting, so the first two minutes of the log are enough.
      const startedAt = Date.parse(JSON.parse(b)[0]?.State?.StartedAt ?? "");
      const toLog = toFacts.running && Number.isFinite(startedAt)
        ? await docker(ctx, ["logs", "--since", String(Math.floor(startedAt / 1000)), "--until", String(Math.floor(startedAt / 1000) + 120), to], true).then((log) => log.slice(0, 200_000)).catch(() => "")
        : "";
      setFindings(diagnose({ from: fromFacts, to: toFacts, port: portNum, probe, toLog }));
    } catch (e) {
      setError(String(e));
    } finally {
      setPulling(false);
      setBusy(false);
    }
  }

  async function connect(network: string, names: string[]) {
    setBusy(true);
    try {
      const have = (await dockerJson<{ Name: string }>(ctx, ["network", "ls"])).some((n) => n.Name === network);
      if (!have) await docker(ctx, ["network", "create", network]);
      for (const n of names) await docker(ctx, ["network", "connect", network, n]);
    } catch (e) {
      setError(String(e));
      setBusy(false);
      return;
    }
    setBusy(false);
    await check();
  }

  const hub = image ? hubLink(image) : null;
  const names = containers.map((c) => c.Names);

  return (
    <Drawer label="Connection doctor" title={<>Why can't one container reach another?</>} onClose={onClose} closeDisabled={busy}>
      <p className="hint">Pick the container that can't connect (From) and the one it should reach (To). The checks run from From's side.</p>
      <div className="group">
        <label>From
          <select aria-label="From container" value={from} disabled={busy} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Choose…</option>
            {names.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label>To
          <select aria-label="To container" value={to} disabled={busy} onChange={(e) => { setTo(e.target.value); setPort(""); }}>
            <option value="">Choose…</option>
            {names.filter((n) => n !== from).map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label>Port
          <input aria-label="Port" list="doctor-ports" inputMode="numeric" placeholder="like 9092" value={port} disabled={busy} onChange={(e) => setPort(e.target.value.trim())} />
          <datalist id="doctor-ports">{ports.map((p) => <option key={p} value={p} />)}</datalist>
        </label>
        <div className="actions">
          <button className="primary" disabled={busy || !from || !to || !port} onClick={check}>{busy ? "Checking…" : "Check"}</button>
        </div>
      </div>

      {pulling && <p className="hint">First check only: downloading the small helper image {HELPER}.</p>}
      <OutputLog event="pull-progress" active={pulling} />
      <Banner error={error} onClose={() => setError(null)} />

      {findings && (
        <ul className="findings">
          {findings.map((f) => {
            const connectFix = f.fix?.kind === "connect" && f.fix.containers.length > 0 ? f.fix : null;
            return (
            <li key={f.id + f.title} className={`finding ${f.status}`}>
              <Icon name={ICON[f.status]} size={16} />
              <div>
                <b>{f.title}</b>
                <div className="hint">{f.detail}</div>
                {connectFix && (
                  <button className="primary" disabled={busy} onClick={() => connect(connectFix.network, connectFix.containers)}>
                    Connect {connectFix.containers.join(" and ")} to {connectFix.network}
                  </button>
                )}
                {f.fix?.kind === "copy" && <button onClick={() => navigator.clipboard.writeText((f.fix as { text: string }).text)}>{f.fix.label}</button>}
              </div>
            </li>
            );
          })}
        </ul>
      )}
      {findings && hub && (
        <p className="hint">Setup notes for {image}:{" "}
          <button className="link ext" onClick={() => invoke("open_url", { url: hub.url }).catch(() => {})}>Docker Hub page <span className="host">({hub.host})</span></button>
        </p>
      )}
    </Drawer>
  );
}

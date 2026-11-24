import { openUrl } from "./api";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { docker, dockerJson } from "./api";
import { hubLink } from "./lib/guided";
import { Finding, ProbeResult, diagnose, parseContainerFacts, parseProbe, sharedNetworks } from "./lib/network";
import { Banner } from "./ui";
import Drawer from "./ui/Drawer";
import { Button, Field, Icon, Select } from "./ui/op";
import OutputLog from "./ui/OutputLog";

type Ctr = { Names: string; State: string };
type Props = { ctx: string; from?: string; onClose?: () => void; inline?: boolean };
const HELPER = "nicolaka/netshoot:v0.16";
const ICON = { ok: "check", warn: "alert", fail: "close", info: "info" } as const;
const TONE = { ok: "text-ok", warn: "text-warn", fail: "text-bad", info: "text-fg-muted" } as const;

export default function ConnectionTest({ ctx, from: initialFrom, onClose = () => undefined, inline = false }: Props) {
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

  const body = (
    <>
      <p className="hint">Pick the container that can't connect (From) and the one it should reach (To). The checks run from From's side.</p>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-meta font-medium text-fg-muted">From</span>
          <Select aria-label="From container" value={from} disabled={busy} onChange={setFrom}
            options={names.map((n) => ({ value: n, label: n }))} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-meta font-medium text-fg-muted">To</span>
          <Select aria-label="To container" value={to} disabled={busy} onChange={(v) => { setTo(v); setPort(""); }}
            options={names.filter((n) => n !== from).map((n) => ({ value: n, label: n }))} />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-meta font-medium text-fg-muted">Port</span>
          <Field aria-label="Port" width="port" list="doctor-ports" inputMode="numeric" placeholder="like 9092" value={port} disabled={busy} onChange={(e) => setPort(e.target.value.trim())} />
          <datalist id="doctor-ports">{ports.map((p) => <option key={p} value={p} />)}</datalist>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="primary" disabled={busy || !from || !to || !port} onClick={check}>{busy ? "Checking…" : "Check"}</Button>
        </div>
      </div>

      {pulling && <p className="hint">First check only: downloading the small helper image {HELPER}.</p>}
      <OutputLog event="pull-progress" active={pulling} />
      <Banner error={error} onClose={() => setError(null)} />

      {findings && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {findings.map((f) => {
            const connectFix = f.fix?.kind === "connect" && f.fix.containers.length > 0 ? f.fix : null;
            return (
            <li key={f.id + f.title} className="grid grid-cols-[16px_minmax(0,1fr)] items-start gap-2 border-b border-line py-2">
              <Icon name={ICON[f.status]} size="sm" className={TONE[f.status]} />
              <div className="flex min-w-0 max-w-prose flex-col items-start gap-1">
                <b className="break-words text-body font-semibold">{f.title}</b>
                <div className="hint break-words">{f.detail}</div>
                {connectFix && (
                  <Button variant="primary" disabled={busy} onClick={() => connect(connectFix.network, connectFix.containers)}>
                    Connect {connectFix.containers.join(" and ")} to {connectFix.network}
                  </Button>
                )}
                {f.fix?.kind === "copy" && <Button onClick={() => navigator.clipboard.writeText((f.fix as { text: string }).text)}>{f.fix.label}</Button>}
              </div>
            </li>
            );
          })}
        </ul>
      )}
      {findings && hub && (
        <p className="hint">Setup notes for {image}:{" "}
          <Button variant="ghost" size="xs" onClick={() => openUrl(hub.url)}>Docker Hub page <span className="text-fg-muted">({hub.host})</span></Button>
        </p>
      )}
    </>
  );

  // Inline on a container's Network tab: a modal drawer there would dim the page with no way to close it.
  if (inline) return <section className="flex flex-col gap-3 pt-3"><h2 className="text-body font-semibold">Why can't one container reach another?</h2>{body}</section>;
  return <Drawer label="Connection doctor" title={<>Why can't one container reach another?</>} onClose={onClose} closeDisabled={busy}>{body}</Drawer>;
}

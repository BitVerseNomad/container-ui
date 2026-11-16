import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "./api";
import { ReactNode, useEffect, useRef, useState } from "react";
import { docker, dockerJson } from "./api";
import { ImageInfo, Link, checkImage, docsLinks, hostArch, nameWarning, nextFreePort, parseImageInfo, peers, portWarnings, suggestVolumes, usedHostPorts } from "./lib/guided";
import { PortRow, VolRow, buildRunArgs, defaultName, folderProblem, hintFor, isHostFolder, presetEnv, repoName, shouldCleanup } from "./runArgs";
import { rememberWritable, wasWritable } from "./lib/folderMemory";
import { Banner, Button, Field, Fields, FormRow, ChipButton, Canvas, Command, Row, Menu, MenuItem, MenuSeparator, Inspector, Sheet, Facts } from "./ui/op";
import { useFixRuns } from "./FixIt";
import { busy } from "./lib/fixStore";
import { useDockerLocked } from "./dockerLock";
import { useConfirm, useToast } from "./ui/op";

type Props = { ctx: string; image: string; arch?: string; onClose: () => void; onRan: (id: string, name: string) => void };
type Ctr = { Names: string; State: string; Ports: string };

const DEFAULT_NET = "devnet";
const BUILTIN_NETS = new Set(["bridge", "host", "none"]);
const suffix = () => Math.random().toString(36).slice(2, 6);
const shellQuote = (a: string) => (/[^\w@%+=:,./-]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a);

function Ext({ link, children }: { link: Link; children: ReactNode }) {
  return (
    <Button className="text-accent-ink hover:underline" onClick={() => openUrl(link.url)}>
      {children} <span className="text-fg-muted">({link.host})</span>
    </Button>
  );
}

export default function RunPanel({ ctx, image, arch, onClose, onRan }: Props) {
  const confirm = useConfirm();
  const toast = useToast();
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
  const cmdBox = useRef<HTMLPreElement>(null);
  useEffect(() => { if (showCmd) cmdBox.current?.scrollIntoView?.({ block: "nearest" }); }, [showCmd]);
  const [busy, setBusy] = useState(false);
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
      onRan(id, finalName);
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
    <Sheet open={true} onClose={onClose} title={`Run ${image}`}>
      <Facts items={[
        { label: "Image", value: image },
        { label: "Name", value: <Field value={finalName} disabled={true} /> },
      ]} />
      <FormRow label="Name" htmlFor="name">
        <Field id="name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
      </FormRow>
      <Fields>
        <Field id="mac-port" width="port" value="" onChange={(e) => {}} disabled={busy} />
        <span className="whitespace-nowrap text-fg-muted">on this Mac, to</span>
        <Field id="container-port" width="port" value="" onChange={(e) => {}} disabled={busy} />
        <span className="whitespace-nowrap text-fg-muted">in the container</span>
      </Fields>
      {env.split("\n").filter(Boolean).map((line, i) => {
        const [key, ...rest] = line.split("=");
        const value = rest.join("=");
        const pass = /^(PASSWORD|PWD|SECRET|TOKEN)/i.test(key);
        return (
          <FormRow key={i} label={key} htmlFor={`env-${i}`}>
            <Field id={`env-${i}`} value={value} type={pass ? "password" : undefined} placeholder={pass ? undefined : "Required"} disabled={busy} />
          </FormRow>
        );
      })}
      {volumes.map((v, i) => (
        <Fields key={i}>
          <Field id={`vol-source-${i}`} value={v.source} list="volume-names" placeholder="name or /path" disabled={busy} onChange={(e) => setSource(i, e.target.value)} />
          <span className="whitespace-nowrap text-fg-muted">at</span>
          <Field id={`vol-target-${i}`} className="font-mono" value={v.target} disabled={busy} onChange={(e) => setVol(i, { target: e.target.value })} />
        </Fields>
      ))}
      <ChipButton icon="chev-right" pressed={false} onClick={() => {}}>More options</ChipButton>
      <ChipButton icon="chev-right" pressed={false} onClick={() => setShowCmd(!showCmd)}>Show command</ChipButton>
      {showCmd && built.ok && (
        <Command text={built.args.join(" ")} />
      )}
      {warnings.length > 0 && (
        <Banner tone="bad" title="…" actions={<Button size="xs" variant="ghost">Try again</Button>}>
          {warnings.join(" ")}
        </Banner>
      )}
      {dockerError && (
        <Banner tone="bad" title={hintFor(dockerError) || "Start failed"} actions={<Button size="xs" variant="ghost">Show output</Button>}>
          {dockerError}
        </Banner>
      )}
      {busy && <p className="hint">Starting the container. If the image isn't downloaded yet, this includes the pull.</p>}
      <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="md" disabled={busy || !built.ok} onClick={run}>{busy ? "Starting…" : "Run"}</Button>
    </Sheet>
  );
}

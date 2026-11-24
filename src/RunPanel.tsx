import { invoke } from "@tauri-apps/api/core";
import { ReactNode, useEffect, useRef, useState } from "react";
import { docker, dockerJson, openUrl } from "./api";
import { ImageInfo, Link, checkImage, docsLinks, hostArch, nameWarning, nextFreePort, parseImageInfo, peers, suggestVolumes, usedHostPorts } from "./lib/guided";
import { PortRow, VolRow, buildRunArgs, defaultName, folderProblem, hintFor, isHostFolder, presetEnv, repoName, shouldCleanup } from "./runArgs";
import { rememberWritable, wasWritable } from "./lib/folderMemory";
import RegistryLoginFix from "./RegistryLoginFix";
import { Banner, Button, Canvas, Checkbox, ChipButton, Command, Field, Fields, FormRow, Select, Sheet, useConfirm } from "./ui/op";
import { useDockerLocked } from "./dockerLock";

type Props = { ctx: string; image: string; arch?: string; onClose: () => void; onRan: (id: string, name: string) => void };
type Ctr = { Names: string; State: string; Ports: string };

const DEFAULT_NET = "devnet";
const NO_NETWORK = "__default__";
const BUILTIN_NETS = new Set(["bridge", "host", "none"]);
const SETTING_HINTS: Record<string, string> = {
  postgres: "postgres stops at start without a password.",
  mysql: "mysql stops at start without a root password.",
  mariadb: "mariadb stops at start without a root password.",
};
const suffix = () => Math.random().toString(36).slice(2, 6);
const shellQuote = (a: string) => (/[^\w@%+=:,./-]/.test(a) ? `'${a.replace(/'/g, "'\\''")}'` : a);
const PASSWORD_KEY = /(PASSWORD|PWD|SECRET|TOKEN)/i;
const valueOf = (line: string) => line.slice(line.indexOf("=") + 1);
const isPortClash = (err: string) => /port is already allocated|address already in use/i.test(err);

function Ext({ link, children }: { link: Link; children: ReactNode }) {
  return (
    <Button variant="ghost" size="xs" onClick={() => { void openUrl(link.url); }}>
      {children} <span className="text-fg-muted">({link.host})</span>
    </Button>
  );
}

export default function RunPanel({ ctx, image, arch, onClose, onRan }: Props) {
  const confirm = useConfirm();
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
  const [extraEnv, setExtraEnv] = useState("");
  const [exposeAll, setExposeAll] = useState(false);
  const [volumeNames, setVolumeNames] = useState<string[]>([]);
  const [moreOpen, setMoreOpen] = useState(false);
  const [showCmd, setShowCmd] = useState(false);
  const [showOutput, setShowOutput] = useState(false);
  const [busy, setBusy] = useState(false);
  // Nothing new starts while the VM, a resize, a Bring over copy, a Compose run or a Fix is changing Docker.
  const locked = useDockerLocked();
  const [errors, setErrors] = useState<string[]>([]);
  const [triedRun, setTriedRun] = useState(false);
  const [dockerError, setDockerError] = useState<string | null>(null);
  const finalName = name.trim() || placeholder;
  const envLines = env ? env.split("\n") : [];

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

  // Escape closes the sheet only when idle. While a run is starting, it asks first.
  // The flag stops the same Escape that dismisses the question from asking it again.
  const stopAsked = useRef(false);
  const askStop = async () => {
    if (stopAsked.current) return;
    stopAsked.current = true;
    try {
      const stop = await confirm({
        title: "Stop the run?",
        body: "The container is still starting. Closing now does not undo the start, and the container may still come up.",
        confirm: "Stop the run",
        danger: true,
      });
      if (stop) onClose();
    } finally {
      // A timer, not a microtask: the Escape key event is still reaching the window listener after the question closes.
      setTimeout(() => { stopAsked.current = false; }, 0);
    }
  };
  useEffect(() => {
    if (!busy) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      void askStop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // askStop reads only confirm and onClose, which are stable for the life of the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy]);

  const userNets = (networks ?? []).filter((n) => !BUILTIN_NETS.has(n));
  const netNames = userNets.includes(DEFAULT_NET) ? userNets : [...userNets, DEFAULT_NET];
  const netOptions = [
    ...netNames.map((n) => ({ value: n, label: networks?.includes(n) ? n : `${n} (new, created for you)` })),
    { value: NO_NETWORK, label: "Default network (containers can't find each other by name)" },
  ];
  const links = info ? docsLinks(image, info.labels) : null;
  const usedPorts = usedHostPorts(containers);
  const others = peers(onNetwork);
  const imageWarnings = [
    ...(info ? checkImage(image, info, hostArch(arch ?? "")) : []),
    ...(nameWarning(finalName, containers) ? [nameWarning(finalName, containers)!] : []),
  ];
  const extraLines = extraEnv.trim() ? extraEnv.split("\n") : [];
  const built = buildRunArgs({ image, name: finalName, ports, volumes, env: [env, extraEnv].filter(Boolean).join("\n"), exposeAll, network });
  const missingSetting = envLines.some((line) => valueOf(line) === "");

  async function run() {
    if (locked) return;
    if (missingSetting) {
      setTriedRun(true);
      return;
    }
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
      setShowOutput(false);
      setBusy(false);
    }
  }

  const setPort = (i: number, patch: Partial<PortRow>) => setPorts((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setVol = (i: number, patch: Partial<VolRow>) => setVolumes((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setEnvValue = (i: number, value: string) => setEnv(envLines.map((line, j) => (j === i ? `${line.slice(0, line.indexOf("="))}=${value}` : line)).join("\n"));
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

  const failure = dockerError
    ? isPortClash(dockerError)
      ? { title: "The host port is taken", body: "Pick another port above, or stop the container that uses it." }
      : hintFor(dockerError)
        ? { title: "This image has no build for your CPU", body: hintFor(dockerError)! }
        : { title: "The container didn't start", body: "Show the output to see what Docker said." }
    : null;

  return (
    <Sheet open={true} onClose={onClose} title={`Run ${image}`} busy={busy} stack footer={
      <>
        <Button variant="ghost" size="md" disabled={busy} onClick={onClose}>Cancel</Button>
        <Button
          variant="primary"
          size="md"
          disabled={busy}
          aria-disabled={locked || undefined}
          title={locked ? "Waits for what is changing Docker now" : undefined}
          onClick={run}
        >
          {busy ? "Starting…" : "Run"}
        </Button>
      </>
    }>
      {imageWarnings.map((w) => (
        <Banner key={w} tone="warn">{w}</Banner>
      ))}

      <FormRow label="Name" htmlFor="run-name">
        <Field id="run-name" value={name} placeholder={placeholder} disabled={busy} onChange={(e) => setName(e.target.value)} />
        <div className="hint">
          {links?.docs ? <Ext link={links.docs}>Read the setup notes</Ext> : links?.hub ? <Ext link={links.hub}>Read the setup notes</Ext> : "Check the image's page on its registry for setup notes."}
          {links?.docs && links.hub && <> · <Ext link={links.hub}>Docker Hub page</Ext></>}
          {links?.source && <> · <Ext link={links.source}>Source code</Ext></>}
        </div>
      </FormRow>

      <FormRow label="Ports" htmlFor="run-host-port-0">
        <Fields>
          {ports.map((row, i) => {
            const clash = !!row.host && usedPorts.has(row.host);
            const next = clash ? nextFreePort(row.host, usedPorts, ports) : "";
            return (
              <div key={i} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Field id={`run-host-port-${i}`} width="port" aria-label="Host port" value={row.host} invalid={clash ? `Port ${row.host} is taken` : undefined} disabled={busy} onChange={(e) => setPort(i, { host: e.target.value })} />
                  <span className="whitespace-nowrap text-fg-muted">on this Mac, to</span>
                  <Field width="port" aria-label="Container port" value={row.container} disabled={busy} onChange={(e) => setPort(i, { container: e.target.value })} />
                  <span className="whitespace-nowrap text-fg-muted">in the container</span>
                </div>
                {clash && (
                  <Banner tone="warn" actions={<Button size="xs" disabled={busy} onClick={() => setPort(i, { host: next })}>{`Use ${next} instead`}</Button>}>
                    Port {row.host} on this Mac is already used by <span className="font-mono">{usedPorts.get(row.host)}</span>.
                  </Banner>
                )}
              </div>
            );
          })}
        </Fields>
        {info && info.ports.length > 0 && (
          <div className="hint">The image says it listens on {info.ports.join(", ")}. Other containers connect by name and don't need these ports.</div>
        )}
      </FormRow>

      {envLines.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-meta font-medium text-fg-muted">Settings the image needs</h3>
          <Fields>
            {envLines.map((line, i) => {
              const key = line.slice(0, line.indexOf("="));
              const value = valueOf(line);
              return (
                <div key={key} className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-meta text-fg-muted">{key}</span>
                  <Field
                    id={`env-${i}`}
                    aria-label={key}
                    type={PASSWORD_KEY.test(key) ? "password" : "text"}
                    placeholder="Required"
                    value={value}
                    invalid={triedRun && !value ? "Enter a value" : undefined}
                    disabled={busy}
                    onChange={(e) => setEnvValue(i, e.target.value)}
                  />
                </div>
              );
            })}
          </Fields>
          {SETTING_HINTS[repoName(image)] && <div className="hint">{SETTING_HINTS[repoName(image)]}</div>}
        </section>
      )}

      {volumes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-meta font-medium text-fg-muted">Keep its data</h3>
          <datalist id="volume-names">{volumeNames.map((v) => <option key={v} value={v} />)}</datalist>
          <Fields>
            {volumes.map((v, i) => {
              const problem = folderProblem(v.source);
              return (
                <div key={i} className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Field id={`vol-source-${i}`} aria-label="Volume source" list="volume-names" placeholder="name or /path" value={v.source} disabled={busy} onChange={(e) => setSource(i, e.target.value)} />
                    <Button size="xs" variant="ghost" aria-label={`Choose folder for volume ${i + 1}`} disabled={busy} onClick={() => chooseFolder(i)}>Choose folder…</Button>
                    <span className="whitespace-nowrap text-fg-muted">at</span>
                    <Field id={`vol-target-${i}`} aria-label="Path in container" className="font-mono" placeholder="/data" value={v.target} disabled={busy} onChange={(e) => setVol(i, { target: e.target.value })} />
                    <Button size="xs" variant="ghost" icon="close" iconOnly aria-label="Remove volume" disabled={busy} onClick={() => setVolumes((rows) => rows.filter((_, j) => j !== i))} />
                  </div>
                  {problem && <div className="hint text-bad">{problem}</div>}
                  {isHostFolder(v.source) && !problem && (
                    <Checkbox
                      checked={!!v.writable}
                      disabled={busy}
                      onChange={(checked) => {
                        setVol(i, { writable: checked });
                        rememberWritable(v.source.trim(), checked);
                      }}
                    >
                      Let the container change files here
                    </Checkbox>
                  )}
                </div>
              );
            })}
          </Fields>
          <div className="hint">A named volume. Without it the data is lost when the container is removed.</div>
        </section>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <ChipButton icon={moreOpen ? "chev-down" : "chev-right"} aria-expanded={moreOpen} onClick={() => setMoreOpen(!moreOpen)}>More options</ChipButton>
          <ChipButton icon={showCmd ? "chev-down" : "chev-right"} aria-expanded={showCmd} onClick={() => setShowCmd(!showCmd)}>Show command</ChipButton>
        </div>

        {moreOpen && (
          <div className="flex flex-col gap-3">
            {info && info.env.length > 0 && (
              <div className="hint">The image sets {info.env.length} default{info.env.length > 1 ? "s" : ""} itself: {info.env.join(", ")}</div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-meta font-medium text-fg-muted">Network</span>
              <Select aria-label="Network" value={network || NO_NETWORK} disabled={busy} options={netOptions} onChange={(value) => setNetwork(value === NO_NETWORK ? "" : value)} />
              {!!network && (
                <div className="hint">Containers on the same network reach each other by name, like {finalName}.</div>
              )}
              {!!network && !exists && <div className="hint">{network} doesn't exist yet. It will be created when you press Run.</div>}
              {others.length > 0 && (
                <div className="hint">
                  Already on {network}: {others.flatMap((p) => (p.ports.length ? p.ports.map((port) => `${p.name}:${port}`) : [p.name])).join(", ")}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-meta font-medium text-fg-muted">Extra environment</span>
              <textarea
                aria-label="Extra environment"
                rows={3}
                spellCheck={false}
                disabled={busy}
                value={extraEnv}
                onChange={(e) => setExtraEnv(e.target.value)}
                className="rounded-md border border-edge bg-bg-raised p-2 font-mono text-meta text-fg"
              />
              <div className="hint">{extraLines.length ? `${extraLines.length} extra line${extraLines.length > 1 ? "s" : ""}.` : "Add your own, one KEY=value per line."}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => setVolumes((rows) => [...rows, { source: "", target: "" }])}>Add a folder or volume</Button>
              <Button size="sm" disabled={busy} onClick={() => setPorts((rows) => [...rows, { host: "", container: "" }])}>Add a port</Button>
            </div>
            <Checkbox checked={exposeAll} disabled={busy} onChange={setExposeAll}>Let other devices on my network connect</Checkbox>
            <div className="hint">{exposeAll ? "Anyone on your network can reach these ports." : "Only this Mac can reach these ports."}</div>
          </div>
        )}

        {showCmd && (built.ok ? <Command text={["docker", ...built.args].map(shellQuote).join(" ")} /> : <div className="hint text-bad">{built.errors.join(" ")}</div>)}
      </div>

      {errors.length > 0 && <Banner tone="bad">{errors.join(" ")}</Banner>}

      {failure && dockerError && <RegistryLoginFix text={dockerError} />}
      {failure && dockerError && (
        <Banner
          tone="bad"
          title={failure.title}
          actions={<Button size="xs" variant="ghost" aria-expanded={showOutput} onClick={() => setShowOutput(!showOutput)}>Show output</Button>}
        >
          <p>{failure.body}</p>
          {showOutput && <Canvas aria-label="Output" lines={dockerError.split("\n").map((text) => ({ text }))} />}
        </Banner>
      )}

      {busy && <p className="hint">Starting the container. If the image isn't downloaded yet, this includes the pull.</p>}
    </Sheet>
  );
}

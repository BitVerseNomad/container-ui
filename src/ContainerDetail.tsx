import { useState, useCallback } from "react";
import { openShell } from "./lib/shell";
import { activity as commands, dockerLine } from "./lib/activity";
import { useConfirm } from "./ui/op";
import { invoke } from "@tauri-apps/api/core";
import { docker } from "./api";
import { Inspect, publishedPortPairs } from "./containerInfo";
import { isWebPort } from "./lib/webPort";
import { CopyPort } from "./ui/PortLinks";
import { usePoll } from "./hooks";
import { Banner, Button, Empty, Facts, Tabs, TabPanel, List, Row, Col, MoreButton, Menu, MenuItem, MenuSeparator, Inspector } from "./ui/op";
import { useFixRuns } from "./FixIt";
import { busy } from "./lib/fixStore";
import { useDockerLocked } from "./dockerLock";
import type { Problem } from "./lib/health";
import { parseState, problemsFor } from "./lib/health";
import { crashLead } from "./lib/crashLead";
import { Icon } from "./ui/icons";
import { inspectorContent } from "./lib/inspectorContent";
import type { LiveMap } from "./lib/liveStats";
import { go, buildPath } from "./lib/router";
import ConnectionTest from "./ConnectionTest";
import { ActivityList, HealthPanel } from "./Health";
import Logs from "./Logs";
import StatsTab from "./StatsTab";
import { useResizeEnv } from "./Resize";
import { timeline, parseEvents, eventWindow } from "./lib/events";
import { isKubeOwned } from "./lib/compose";

const SHORT: Record<string, string> = { unhealthy: "Unhealthy", restarting: "Keeps restarting", oom: "Out of memory", crashed: "Stopped with an error", "kafka-localhost": "Only reachable from your Mac", "kafka-ui-empty": "No Kafka set up", "kafka-ui-localhost": "Can't reach Kafka" };

const TABS = ["logs", "stats", "settings", "folders", "network", "history"] as const;
type Tab = (typeof TABS)[number];
type Props = { ctx: string; id: string; tab?: string; appProblems?: Problem[]; onBack?: () => void; onReplaced?: (name: string) => void; listed?: string[]; live?: LiveMap; history?: Record<string, number[]> };

export default function ContainerDetail({ ctx, id, tab: routeTab, appProblems, onBack: onBackProp, onReplaced, listed = [], live, history }: Props) {
  const confirm = useConfirm();
  const [tab, setTab] = useState<Tab>((routeTab ?? "logs") as Tab);
  const [err, setErr] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const { data: c, error, reload } = usePoll(async () => JSON.parse(await docker(ctx, ["inspect", id]))[0] as Inspect, [ctx, id]);

  async function act(args: string[], done?: () => void) {
    if (locked) return;
    try {
      await commands.ran(args[0], dockerLine(ctx, args.map((a) => (a === id ? name : a))), () => docker(ctx, args), name);
      setErr(null);
      done?.();
    } catch (e) {
      setErr(String(e));
    }
    reload();
  }

  const name = c?.Name.replace(/^\//, "") ?? "Container";
  const locked = useDockerLocked([name]);
  const wait = locked || undefined;
  const paused = !!c?.State.Paused;
  const running = !!c?.State.Running && !paused;
  const raw = paused ? "paused" : c?.State.Status ?? "";
  const status = raw.charAt(0).toUpperCase() + raw.slice(1);
  const ports = running ? publishedPortPairs(c?.NetworkSettings.Ports) : [];
  const state = c ? parseState(JSON.stringify([c])) : null;
  const crashing = !!state && problemsFor(state).some((p) => p.id === "restarting" || p.id === "crashed");
  const tail = usePoll(() => docker(ctx, ["logs", "--tail", "80", name], true), [ctx, name], 10000, crashing);
  const lead = crashing && tail.data ? crashLead(tail.data, c?.Mounts ?? []) : null;
  const leadProblem: Problem[] = lead ? [{ id: "last-error", level: "warn", title: "Its last error", detail: `"${lead.line.slice(0, 300)}"${lead.hint ? ` ${lead.hint}` : ""}` }] : [];
  const extra = [...leadProblem, ...(appProblems ?? [])];
  const vm = useResizeEnv()?.profile;
  const problem = state ? [...problemsFor(state, vm?.status === "Running" ? vm.memory : undefined), ...extra][0] : undefined;
  const activity = usePoll(async () => timeline(parseEvents(await docker(ctx, ["events", ...eventWindow(Date.now(), 86_400_000), "--filter", `container=${name}`, "--filter", "type=container", "--format", "{{json .}}"])), 50, name), [ctx, name], 10000, !!c && tab === "history");
  const kube = !!c && (isKubeOwned({ Names: name }) || !!c.Config.Labels?.["io.kubernetes.pod.name"]);
  const ip = Object.values(c?.NetworkSettings?.Networks ?? {})[0]?.IPAddress;
  const fixing = busy(useFixRuns(), name);

  const onBack = onBackProp ?? (() => window.history.length > 1 ? window.history.back() : go("#/containers"));
  const onTab = (next: string) => go(buildPath({ page: "containers", id, tab: next }));

  const stateText = (() => {
    if (fixing) return "A fix is running";
    if (state?.running && state.health?.status === "unhealthy") return `${status} · Unhealthy`;
    if (state?.oomKilled) return `${status} · Out of memory`;
    return status;
  })();

  const facts = [
    { label: "Image", value: c?.Config.Image ?? "" },
    ...(c?.Config.Labels?.["com.docker.compose.project"] ? [{ label: "Project", value: c.Config.Labels["com.docker.compose.project"] }] : []),
    { label: "Started", value: (c as any)?.State?.StartedAt ? `Started ${new Date((c as any).State.StartedAt).toLocaleString()} ago` : "just now" },
    { label: "Restarts", value: `${(c as any)?.State?.RestartCount ?? 0} restarts` },
    { label: "Ports", value: ports.length > 0 ? ports.map(p => <span key={p.host} className="port">{isWebPort(p.container, p.host) ? <Button key={p.host} variant="ghost" size="xs" onClick={() => invoke("open_url", { url: `http://localhost:${p.host}` })}>:{p.host}</Button> : <span>{`:${p.host}`}</span>}</span>).join("") : "-" },
  ];

  const actions = problem ? (
    <>
      {problem.fix ? (
        <Button variant="primary" size="md" onClick={() => {}}>{problem.fix.label}</Button>
      ) : (
        <Button variant="primary" size="md" onClick={() => {}}>See why</Button>
      )}
      {appProblems && appProblems.length > 1 ? <Button variant="ghost" size="xs" onClick={() => go("#/doctor")}>and {appProblems.length - 1} more</Button> : null}
    </>
  ) : null;

  return (
    <section className="detail">
      <Button className="back" variant="ghost" size="xs" onClick={onBack}>← Containers</Button>
      <header>
        <h2>{name}</h2>
        <span className={`dot ${state?.health?.status === "unhealthy" ? "bad" : state?.running ? "ok" : "off"}`} aria-hidden={true} />
        <span className="state-text">{stateText}</span>
        <div className="actions-inline">
          {c && !kube && running && (
            <>
              <Button onClick={() => openShell(ctx, name).catch((e) => setErr(e instanceof Error ? e.message : String(e)))}>Open a shell</Button>
              <Button variant="primary" size="md" disabled={locked} onClick={() => act(["restart", id])}>Restart</Button>
              <Button variant="primary" size="md" disabled={locked} onClick={() => act(["stop", id])}>Stop</Button>
            </>
          )}
          {c && !kube && paused && (
            <>
              <Button disabled={locked} onClick={() => act(["unpause", id])}>Resume</Button>
              <Button disabled={locked} onClick={() => act(["stop", id])}>Stop</Button>
            </>
          )}
          {c && !kube && !running && !paused && (
            <Button disabled={locked} onClick={() => act(["start", id])}>Start</Button>
          )}
          {c && !kube && (
            <Button variant="danger" disabled={locked} onClick={async () => !locked && (await confirm({ title: `Remove ${name}?`, body: `This deletes the container. Its image and volumes are kept, so you can run it again.`, confirm: "Remove", danger: true })) && act(["rm", "-f", id], () => go("#/containers"))}>Remove</Button>
          )}
          {locked && <span className="hint">Waits for what is changing Docker now.</span>}
        </div>
      </header>

      <Banner tone={problem?.level ?? "info"} title={problem?.short ?? problem?.title ?? "Container"} actions={actions}>
        {problem?.detail ? problem.detail.replace(/`/g, "") : ""}
      </Banner>

      <Facts items={facts} />

      <Tabs value={tab} items={TABS.map(t => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} onChange={(next: string) => { setTab(next as Tab); onTab(next); }} aria-label="Container">
        <TabPanel value="logs">
          <Logs ctx={ctx} id={id} />
        </TabPanel>
        <TabPanel value="stats">
          <StatsTab ctx={ctx} id={id} running={running} />
        </TabPanel>
        <TabPanel value="settings">
          <HealthPanel state={state ?? { name: "", running: false, status: "", exitCode: 0, oomKilled: false, restartCount: 0, startedAt: "", health: null, memLimit: 0, composeFile: null, composeFiles: [], service: null, restart: "" }} extra={extra} ctx={ctx} onFixed={onReplaced} listed={listed} />
        </TabPanel>
        <TabPanel value="folders">
          {(c as any)?.Mounts?.length === 0 ? (
            <p className="hint">No mounts. Data written inside this container is lost when it is removed.</p>
          ) : (
            <List aria-label="Mounts">
              {(c as any)?.Mounts?.map((m: any, i: number) => (
                <Row key={i} lead={<span><Icon name="folder" size={16} /></span>} name={m.Source} meta={m.Destination} />
              ))}
            </List>
          )}
        </TabPanel>
        <TabPanel value="network">
          {Object.keys((c as any)?.NetworkSettings?.Networks ?? {}).length === 0 ? (
            <p className="hint">This container isn't on any network.</p>
          ) : (
            <List aria-label="Networks">
              {Object.entries((c as any).NetworkSettings.Networks ?? {}).map(([net, v]: any) => (
                <Row key={net} lead={<span><Icon name="network" size={16} /></span>} name={net} meta={v.IPAddress || "none"} />
              ))}
            </List>
          )}
          <ConnectionTest ctx={ctx} from={name} onClose={() => setTesting(false)} />
        </TabPanel>
        <TabPanel value="history">
          <ActivityList lines={activity.data ?? []} empty="Nothing notable has happened to this container recently." />
        </TabPanel>
      </Tabs>
    </section>
  );
}

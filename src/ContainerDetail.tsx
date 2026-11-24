import { useCallback, useRef, useState } from "react";
import { openShell } from "./lib/shell";
import { activity as commands, dockerLine } from "./lib/activity";
import { invoke } from "@tauri-apps/api/core";
import { docker } from "./api";
import { Inspect, publishedPortPairs } from "./containerInfo";
import { isWebPort } from "./lib/webPort";
import { usePoll } from "./hooks";
import { Button, Banner, Canvas, Chip, ChipButton, Col, Facts, List, MoreButton, Menu, MenuItem, MenuSeparator, Row, TabPanel, Tabs, useConfirm, type DotState } from "./ui/op";
import { Header } from "./Header";
import { useFixRuns } from "./FixIt";
import { busy } from "./lib/fixStore";
import { useDockerLocked } from "./dockerLock";
import type { Problem } from "./lib/health";
import { parseState, problemsFor } from "./lib/health";
import { crashLead } from "./lib/crashLead";
import { Icon } from "./ui/op";
import type { LiveMap } from "./lib/liveStats";
import { go, buildPath } from "./lib/router";
import ConnectionTest from "./ConnectionTest";
import { ActivityList, HealthPanel } from "./Health";
import Logs, { LogFilter } from "./Logs";
import StatsTab from "./StatsTab";
import { useResizeEnv } from "./Resize";
import { timeline, parseEvents, eventWindow } from "./lib/events";
import { isKubeOwned } from "./lib/compose";

// The inspect fields this page reads beyond the shared Inspect type.
type DetailInspect = Inspect & { State: Inspect["State"] & { StartedAt?: string }; RestartCount?: number };

const TABS = ["logs", "stats", "settings", "folders", "network", "history"] as const;
type Tab = (typeof TABS)[number];
const LABEL: Record<Tab, string> = { logs: "Logs", stats: "Stats", settings: "Settings", folders: "Folders", network: "Network", history: "History" };

type Props = { ctx: string; id: string; tab?: string; appProblems?: Problem[]; onReplaced?: (name: string) => void; listed?: string[]; live?: LiveMap; history?: Record<string, number[]> };

const tabOf = (tab: string | undefined): Tab => (TABS as readonly string[]).includes(tab ?? "") ? (tab as Tab) : "logs";

// "Started 3 h ago", or "just now" for the first minute.
export function startedAgo(startedAt: string | undefined, now = Date.now()): string {
  const started = startedAt ? Date.parse(startedAt) : Number.NaN;
  if (Number.isNaN(started)) return "just now";
  const minutes = Math.floor((now - started) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `Started ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Started ${hours} h ago`;
  return `Started ${Math.floor(hours / 24)} d ago`;
}

export default function ContainerDetail({ ctx, id, tab: routeTab, appProblems, onReplaced, listed = [] }: Props) {
  const confirm = useConfirm();
  const tab = tabOf(routeTab);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  const copyLogs = useRef<() => void>(() => undefined);
  const registerCopy = useCallback((copy: () => void) => {
    copyLogs.current = copy;
  }, []);
  const { data: c, reload } = usePoll(async () => JSON.parse(await docker(ctx, ["inspect", id]))[0] as DetailInspect, [ctx, id]);

  const name = c?.Name.replace(/^\//, "") ?? "Container";
  const locked = useDockerLocked([name]);
  const fixing = busy(useFixRuns(), name);
  const paused = !!c?.State.Paused;
  const running = !!c?.State.Running && !paused;
  const raw = paused ? "paused" : c?.State.Status ?? "";
  const status = raw.charAt(0).toUpperCase() + raw.slice(1);
  const ports = running ? publishedPortPairs(c?.NetworkSettings?.Ports) : [];
  const state = c ? parseState(JSON.stringify([c])) : null;
  const crashing = !!state && problemsFor(state).some((p) => p.id === "restarting" || p.id === "crashed");
  const tail = usePoll(() => docker(ctx, ["logs", "--tail", "80", name], true), [ctx, name], 10000, crashing);
  const lead = crashing && tail.data ? crashLead(tail.data, c?.Mounts ?? []) : null;
  const leadProblem: Problem[] = lead ? [{ id: "last-error", level: "warn", title: "Its last error", detail: `"${lead.line.slice(0, 300)}"${lead.hint ? ` ${lead.hint}` : ""}` }] : [];
  const extra = [...leadProblem, ...(appProblems ?? [])];
  const vm = useResizeEnv()?.profile;
  const all = state ? [...problemsFor(state, vm?.status === "Running" ? vm.memory : undefined), ...extra] : extra;
  // The worst finding is the banner; the rest sit behind "and N more".
  const problem = all.find((p) => p.level === "bad") ?? all[0];
  const activity = usePoll(async () => timeline(parseEvents(await docker(ctx, ["events", ...eventWindow(Date.now(), 86_400_000), "--filter", `container=${name}`, "--filter", "type=container", "--format", "{{json .}}"])), 50, name), [ctx, name], 10000, !!c && tab === "history");
  const kube = !!c && (isKubeOwned({ Names: name }) || !!c.Config.Labels?.["io.kubernetes.pod.name"]);
  const mounts = c?.Mounts ?? [];
  const networks = Object.entries(c?.NetworkSettings?.Networks ?? {});
  const frozen = locked || fixing;

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

  async function remove() {
    if (locked) return;
    const ok = await confirm({ title: `Remove ${name}?`, body: "This deletes the container. Its image and volumes are kept, so you can run it again.", confirm: "Remove", danger: true });
    if (ok) await act(["rm", "-f", id], () => go("#/containers"));
  }

  // "Run it yourself": the same command the list shows, in a dialog that can copy it.
  async function runYourself() {
    const verb = running ? "stop" : "start";
    const command = `docker --context ${ctx} ${verb} ${name}`;
    const yes = await confirm({ title: `Run ${name} yourself`, body: "This is what OpenPier runs. You can paste it in Terminal.", command, confirm: "Copy command" });
    if (yes) await navigator.clipboard.writeText(command);
  }

  const onBack = () => (window.history.length > 1 ? window.history.back() : go("#/containers"));
  const onTab = (next: string) => go(buildPath({ page: "containers", id, tab: next }));

  const stateText = (() => {
    if (fixing) return "A fix is running";
    if (state?.running && state.health?.status === "unhealthy") return `${status} · Unhealthy`;
    if (state?.oomKilled) return `${status} · Out of memory`;
    return status;
  })();
  const dot: DotState = fixing ? "busy" : !c ? "off" : problem?.level === "bad" ? "bad" : problem ? "warn" : running ? "ok" : "off";

  const facts = [
    { label: "Image", value: c?.Config.Image ?? "" },
    ...(c?.Config.Labels?.["com.docker.compose.project"] ? [{ label: "Project", value: c.Config.Labels["com.docker.compose.project"] }] : []),
    { label: "Started", value: startedAgo(c?.State.StartedAt) },
    { label: "Restarts", value: `${c?.RestartCount ?? 0} restarts` },
    {
      label: "Ports",
      value: ports.length === 0 ? "-" : ports.map((p) => (isWebPort(p.container, p.host)
        ? <Button key={p.host} variant="ghost" size="xs" className="port" onClick={() => void invoke("open_url", { url: `http://localhost:${p.host}` })}>{`:${p.host}`}</Button>
        : <span key={p.host} className="port">{`:${p.host}`}</span>)),
    },
  ];

  const actions = problem ? (
    <>
      <Button variant="primary" size="md" onClick={() => onTab("settings")}>See why</Button>
      {all.length > 1 ? <Button variant="ghost" size="xs" onClick={() => go("#/doctor")}>{`and ${all.length - 1} more`}</Button> : null}
    </>
  ) : null;

  const logsAside = tab === "logs" ? (
    <div className="flex flex-wrap items-center gap-2">
      <LogFilter value={filter} onChange={setFilter} />
      <ChipButton pressed={follow} onClick={() => setFollow((f) => !f)}>Follow</ChipButton>
      <Button variant="ghost" iconOnly icon="copy" aria-label="Copy logs" onClick={() => copyLogs.current()} />
    </div>
  ) : undefined;

  return (
    <div className="content stack detail">
      <Header
        title={name}
        back={{ label: "Back to Containers", onBack }}
        stateDot={dot}
        stateText={stateText}
        meters={false}
      >
        {c && !kube && running && (
          <>
            <Button onClick={() => openShell(ctx, name).catch((e) => setErr(e instanceof Error ? e.message : String(e)))}>Open a shell</Button>
            <Button disabled={frozen} onClick={() => act(["restart", id])}>Restart</Button>
            <Button disabled={frozen} onClick={() => act(["stop", id])}>Stop</Button>
          </>
        )}
        {c && !kube && paused && <Button disabled={frozen} onClick={() => act(["unpause", id])}>Resume</Button>}
        {c && !kube && !running && !paused && <Button variant="primary" size="md" disabled={frozen} onClick={() => act(["start", id])}>Start</Button>}
        {c && !kube && (
          <Menu trigger={<MoreButton name={name} />} label={`Actions for ${name}`} align="end" wide>
            <MenuItem label={paused ? "Unpause" : "Pause"} why="Freezes it without stopping it" disabled={frozen} onSelect={() => void act([paused ? "unpause" : "pause", id])} />
            <MenuSeparator />
            <MenuItem label="Copy name" onSelect={() => void navigator.clipboard.writeText(name)} />
            <MenuItem label="Run it yourself" why="Shows the command, if you'd rather use Terminal" onSelect={() => void runYourself()} />
            <MenuSeparator />
            <MenuItem label="Remove…" danger disabled={frozen} onSelect={() => void remove()} />
          </Menu>
        )}
        {locked && <span className="hint">Waits for what is changing Docker now.</span>}
      </Header>

      {err && <p className="hint" role="alert">{err}</p>}

      {problem && (
        <Banner tone={problem.level} title={problem.short ?? problem.title} actions={actions}>
          {problem.detail ? problem.detail.replace(/`/g, "") : ""}
        </Banner>
      )}

      <Facts items={facts} />

      <Tabs value={tab} items={TABS.map((t) => ({ value: t, label: LABEL[t] }))} onChange={onTab} aria-label="Container" aside={logsAside} className="!h-auto min-h-9 flex-wrap gap-y-2 py-1">
        <TabPanel value="logs">
          <Logs ctx={ctx} id={id} name={name} filter={filter} follow={follow} onFollowChange={setFollow} registerCopy={registerCopy} />
        </TabPanel>
        <TabPanel value="stats">
          <StatsTab ctx={ctx} id={id} running={running} />
        </TabPanel>
        <TabPanel value="settings">
          <div className="flex flex-col overflow-hidden rounded-md border border-line bg-bg-raised">
            <HealthPanel flat state={state ?? { name: "", running: false, status: "", exitCode: 0, oomKilled: false, restartCount: 0, startedAt: "", health: null, memLimit: 0, composeFile: null, composeFiles: [], service: null, restart: "" }} extra={extra} ctx={ctx} onFixed={onReplaced} listed={listed} />
            {c && (
              <List aria-label="Settings">
                <Row lead={<span />} name="Image" meta={c.Config.Image} metaSelectable />
                <Row lead={<span />} name="Command" meta={[c.Path ?? "", ...(c.Args ?? [])].join(" ")} metaSelectable />
                <Row lead={<span />} name="Restart policy" meta={c.HostConfig?.RestartPolicy?.Name || "no"} />
                <Row lead={<span />} name="Environment" meta={`${c.Config.Env?.length ?? 0} variables`} />
              </List>
            )}
            {c && <div className="border-t border-line p-3"><Canvas aria-label="Environment" wrap>{(c.Config.Env ?? []).join("\n")}</Canvas></div>}
          </div>
        </TabPanel>
        <TabPanel value="folders">
          {mounts.length === 0 ? (
            <p className="hint">No mounts. Data written inside this container is lost when it is removed.</p>
          ) : (
            <List aria-label="Folders">
              {mounts.map((m) => (
                <Row key={m.Destination} lead={<Icon name="folder" size="md" />} name={m.Source} meta={m.Destination} metaSelectable>
                  <Col><Chip>{m.RW ? "Can change files" : "Read only"}</Chip></Col>
                </Row>
              ))}
            </List>
          )}
        </TabPanel>
        <TabPanel value="network">
          {networks.length === 0 ? (
            <p className="hint">This container isn't on any network.</p>
          ) : (
            <List aria-label="Networks">
              {networks.map(([net, v]) => (
                <Row key={net} lead={<Icon name="network" size="md" />} name={net} meta={v.IPAddress || "none"} />
              ))}
            </List>
          )}
          <ConnectionTest ctx={ctx} from={name} inline />
        </TabPanel>
        <TabPanel value="history">
          <ActivityList lines={activity.data ?? []} empty="Nothing notable has happened to this container recently." />
        </TabPanel>
      </Tabs>
    </div>
  );
}

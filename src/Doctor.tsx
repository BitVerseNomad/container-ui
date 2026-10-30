import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Profile, docker } from "./api";
import { usePoll } from "./hooks";
import { useSetup, useSetupActions } from "./Setup";
import ConnectionTest from "./ConnectionTest";
import { FixRuns, Go, fixAction, useFixRuns } from "./FixIt";
import { doctor } from "./lib/doctor";
import type { Finding, Report } from "./lib/doctor";
import { parseDiskUsage } from "./lib/disk";
import { parseColimaConfig } from "./lib/colimaConfig";
import { parseProxy, vpnInterfaces } from "./lib/netFacts";
import { hostArch } from "./lib/guided";
import { toApp } from "./lib/apps";
import type { Inspect } from "./lib/apps";
import { binds, readOnlyWrites, sharesOf } from "./lib/mounts";
import { recentPullFailure, subscribePull } from "./lib/netEvidence";
import { holdAfterResize } from "./lib/vmSize";
import { muted, setMuted, subscribeMuted } from "./lib/muted";
import { busy } from "./lib/fixStore";
import { useDockerLocked } from "./dockerLock";
import { fixAllPlan } from "./lib/setup";
import { biggerFix } from "./lib/sharedFix";
import type { SetupFinding } from "./lib/setup";
import { Banner, useConfirm } from "./ui";
import Menu from "./ui/Menu";
import type { MenuItem } from "./ui/Menu";
import { Icon } from "./ui/icons";
import Ticks, { plain } from "./ui/Ticks";
import { LimitActions, isListed } from "./Health";
import { REACHABLE, ResizeButton, ResizeOr, ResizeOther, ResizeStatus, ResultRow, VmChangeOr, afterDismiss, addChangeRefresh, resizing, useHeld, useResize } from "./Resize";

const ICON = { ok: "check", warn: "alert", fail: "close", info: "info" } as const;

export const useMuted = () => useSyncExternalStore(subscribeMuted, muted);

// Reads what the checks need: every container, the images they run, and disk use. It only reads.
export function useDoctor(ctx: string | null, profile: Profile | null) {
  const mutedKeys = useMuted();
  const pullFailure = useSyncExternalStore(subscribePull, () => recentPullFailure());
  const facts = usePoll(async () => {
    if (!ctx) return null;
    const ids = (await docker(ctx, ["ps", "-a", "-q"])).split("\n").filter(Boolean);
    // One gone container (a --rm job that just ended) fails the whole call, so ask for each one when that happens.
    const one = (id: string) => docker(ctx, ["inspect", id]).then((o) => JSON.parse(o) as unknown[]).catch(() => []);
    const containers: unknown[] = !ids.length ? [] : await docker(ctx, ["inspect", ...ids]).then((o) => JSON.parse(o) as unknown[]).catch(async () => (await Promise.all(ids.map(one))).flat());
    const imageIds = [...new Set(containers.map((c) => (c as { Image?: string }).Image).filter((x): x is string => !!x))];
    // Left undefined when Docker didn't answer, so the checks that need them are skipped, not shown as passed.
    const images = imageIds.length ? await docker(ctx, ["image", "inspect", ...imageIds]).then((o) => JSON.parse(o) as unknown[]).catch(() => undefined) : [];
    const disk = await docker(ctx, ["system", "df", "--format", "{{json .}}"]).then(parseDiskUsage).catch(() => undefined);
    // The profile's saved settings and the Mac's network, both read-only. Left undefined when they can't be read, so
    // the checks that need them are skipped, not shown as passed.
    const colima = profile ? await invoke<{ home: string; yaml: string }>("colima_config", { name: profile.name }).then((r) => (r.yaml ? { config: parseColimaConfig(r.yaml), home: r.home } : undefined)).catch(() => undefined) : undefined;
    const net = await invoke<{ proxy: string; interfaces: string }>("network_facts").then((r) => ({ proxy: parseProxy(r.proxy), vpn: vpnInterfaces(r.interfaces) })).catch(() => undefined);
    // A read-only share is said only when a container's own log shows it: the log of each container that writes into
    // one, last lines. A container whose log can't be read has no entry, so it is not blamed.
    const rofsLogs: Record<string, string> = {};
    if (colima?.config.mounts) {
      const shares = sharesOf(colima.config, colima.home)!;
      for (const u of readOnlyWrites(binds(containers.map((c) => toApp(c as Inspect))), shares))
        rofsLogs[u.app] ??= await docker(ctx, ["logs", "--tail", "200", u.app], true).catch(() => "");
    }
    return { containers, images, disk, colima, net, rofsLogs: colima ? rofsLogs : undefined };
  }, [ctx], 30_000);
  // Can the VM look up a name? Its own, slower read: `colima ssh -- getent hosts` waits for the VM's resolver, which
  // takes seconds when it is broken. One failure may be a start in progress, so a failure is asked again before it
  // counts. Only a clear answer is used; anything else leaves the check out.
  const dnsRead = usePoll(async () => {
    if (!ctx || !profile) return null;
    const ask = () => invoke<string>("vm_dns_probe", { name: profile.name }).catch(() => "unknown");
    const first = await ask();
    if (first !== "failed") return first === "resolved";
    await new Promise((r) => setTimeout(r, 3000));
    return (await ask()) === "failed" ? false : null;
  }, [ctx, profile?.name], 60_000, !!ctx);
  const running = profile?.status === "Running";
  const runs = useFixRuns();
  const report = useMemo(() => {
    if (!ctx || !facts.data) return null;
    const r = doctor({ ctx, ...facts.data, pullFailure: pullFailure ?? undefined, dns: dnsRead.data ?? undefined, hostArch: hostArch(profile?.arch ?? ""), vmMemory: running ? profile?.memory : undefined }, mutedKeys);
    // A NAME-old is a leftover only once its Fix has stopped; mid-Fix it is the step the Fix is on.
    return { ...r, findings: r.findings.filter((f) => !(f.id === "fix-leftover" && f.subject && busy(runs, f.subject))) };
  }, [ctx, facts.data, dnsRead.data, pullFailure, profile?.arch, profile?.memory, running, mutedKeys, runs]);
  // containers: the raw inspect output, so the VM size fix can say which containers start again after a restart.
  // Held while the VM restarts for a new size: the checks can't run then, and their rows would vanish and come back.
  // Held a little longer too, until a read made after the restart lands: one made while the containers were still
  // stopped would drop every line about a running one (kafka's, kafka-ui's) until the next 30-second poll.
  // Only a read that worked and started after the resize ended releases it (holdAfterResize); a failed one keeps
  // holding until the next poll lands.
  const s = useResize();
  const wasResizing = useRef(false);
  // A change that worked reads the facts again before its result shows; that read is fresh, so the hold lets go.
  const released = useRef(false);
  const reloadRef = useRef(facts.reload);
  reloadRef.current = facts.reload;
  useEffect(() => {
    return addChangeRefresh(async () => { await reloadRef.current(); released.current = true; });
  }, []);
  const endedAt = useRef<number | null>(null);
  if (resizing(s)) { if (!wasResizing.current) released.current = false; wasResizing.current = true; }
  else if (wasResizing.current) { wasResizing.current = false; endedAt.current = Date.now(); }
  useEffect(() => {
    if (endedAt.current !== null && !resizing(s)) { void facts.reload(); void dnsRead.reload(); }
  }, [s.progress]); // eslint-disable-line react-hooks/exhaustive-deps
  const held = resizing(s) || (holdAfterResize(false, endedAt.current, facts.dataFrom) && !released.current);
  if (!held) endedAt.current = null;
  const heldReport = useRef(report);
  const heldContainers = useRef(facts.data?.containers);
  if (!held) { heldReport.current = report; heldContainers.current = facts.data?.containers; }
  return { report: heldReport.current, error: facts.error, reload: () => { void dnsRead.reload(); return facts.reload(); }, // the name lookup is slower; the page doesn't wait for it
     containers: heldContainers.current };
}

// What the page shows in each group. todo is the one problem count in the app: the sidebar badge and this page's
// summary both show it. A problem about one container is left out of it, because the Containers screen shows it
// under that container's row; it is listed here too, under its own heading, uncounted.
export function groups(setupFindings: SetupFinding[], report: Report | null, mutedKeys: ReadonlySet<string>) {
  // The general "small VM" note says less than the one naming what won't fit, so only one shows: the named one,
  // unless the general one can fix it in one click (its new size clears both).
  const sized = setupFindings.some((f) => f.id === "resources" && f.fix?.kind === "resize");
  const live = (report?.findings ?? []).filter((f) => !mutedKeys.has(f.key) && !(sized && f.id === "vm-memory"));
  const vmNamed = live.some((f) => f.id === "vm-memory");
  const sf = setupFindings.filter((f) => !(vmNamed && f.id === "resources"));
  const sAction = sf.filter((f) => f.status === "fail" || f.status === "warn");
  const eAction = live.filter((f) => f.severity === "action" && !f.subject);
  return {
    sAction,
    onHome: live.filter((f) => f.severity === "action" && !!f.subject),
    sKnow: sf.filter((f) => f.status === "info"),
    sPassed: sf.filter((f) => f.status === "ok"),
    eAction,
    eKnow: live.filter((f) => f.severity === "know"),
    hidden: (report?.findings ?? []).filter((f) => mutedKeys.has(f.key)),
    todo: sAction.length + eAction.length,
  };
}

const summaryOf = (todo: number) => (todo === 0 ? "Nothing needs action." : `${todo} problem${todo === 1 ? " needs" : "s need"} action.`);

type Props = {
  ctx: string | null;
  setup: ReturnType<typeof useSetup>;
  doc: ReturnType<typeof useDoctor>;
  onProfiles: () => void;
  // Opens the one Bring over panel, which App owns so home's empty state opens the same one.
  onBring: (only?: string[]) => void;
  onGo: (page: Go) => void;
  onOpen: (container: string) => void;
  // The Compose files the scan lists: a container that hit its own memory limit can show its file.
  composePaths?: string[];
};

// Every check in one place: setup, containers, networks, images, storage and the VM. Nothing changes until a click.
export default function Doctor({ ctx, setup, doc, onProfiles, onBring, onGo, onOpen, composePaths = [] }: Props) {
  const actions = useSetupActions({ reload: setup.reload, profile: setup.profile, onProfiles, onBring, rc: setup.rc });
  const rs = useResize();
  // A row that goes while focus is in it (its Apply and start worked, its fix ran): focus goes to the row that was
  // after it, else the Doctor's first button, else the heading. Never the page top.
  const lastRow = useRef<{ key: string; next: string | null } | null>(null);
  const onFocusIn = (e: React.FocusEvent) => {
    const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-key]");
    if (li) lastRow.current = { key: li.dataset.key!, next: (li.nextElementSibling as HTMLElement | null)?.dataset.key ?? null };
  };
  useEffect(() => {
    const r = lastRow.current;
    if (!r || (document.activeElement && document.activeElement !== document.body)) return;
    if (document.querySelector(`li[data-key="${CSS.escape(r.key)}"]`)) return;
    lastRow.current = null;
    const next = r.next ? document.querySelector<HTMLElement>(`li[data-key="${CSS.escape(r.next)}"] ${REACHABLE}`) : null;
    (next ?? document.querySelector<HTMLElement>(`.doctor-head ${REACHABLE}`) ?? afterDismiss(document.body))?.focus();
  });
  const mutedKeys = useMuted();
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);

  // While the VM restarts the checks hold still. After it, the size row stays where it was, with its result, until
  // Dismiss; a failed restart leaves the VM stopped, which has no size row, so the last one is kept for it.
  const shown = useHeld(setup.findings ?? []);
  const lastSize = useRef<SetupFinding | undefined>(undefined);
  const liveSize = shown.find((f) => f.id === "resources");
  if (liveSize) lastSize.current = liveSize;
  const sizeRun = rs.from === "setup" && (!!rs.progress || !!rs.outcome);
  const sizeRow = sizeRun ? liveSize ?? lastSize.current : undefined;
  const g = groups(shown, doc.report, mutedKeys);
  const { onHome, sKnow, eAction, eKnow, hidden, todo } = g;
  const at = g.sAction.findIndex((f) => f.id === "testcontainers");
  const sAction = !sizeRow || g.sAction.includes(sizeRow) ? g.sAction : at < 0 ? [...g.sAction, sizeRow] : [...g.sAction.slice(0, at), sizeRow, ...g.sAction.slice(at)];
  const sPassed = g.sPassed.filter((f) => f !== sizeRow);
  const plan = fixAllPlan(shown);
  const passed = [...sPassed.map((f) => ({ t: f.title, setup: f.id as string })), ...(doc.report?.passed ?? []).map((t) => ({ t, setup: undefined }))];

  async function recheck() {
    setChecking(true);
    await Promise.all([setup.reload(), doc.reload()]);
    setChecking(false);
  }

  // The page's one green button: Fix all when it shows, else each failure's fix, or the VM size fix on its own.
  const setupRow = (f: SetupFinding) => (
    f === sizeRow || f.fix?.kind === "resize" ? <SizeRow key={f.id} f={f} primary={plan.length <= 1} onProfiles={onProfiles} /> : actions.row(f, f.status === "fail" && plan.length <= 1)
  );
  const listed = [...eAction, ...onHome, ...eKnow];
  const item = (f: Finding) => {
    const cls = f.severity === "know" ? "info" : f.level === "bad" ? "fail" : "warn";
    // Same rule as the Containers screen: a pair fixed together has one button, on the problem that owns the fix.
    const shared = biggerFix(f.fix, listed.map((x) => x.fix));
    const owner = shared && listed.find((x) => x.fix === shared);
    const elsewhere = owner && owner !== f ? owner : undefined;
    const more: MenuItem[] = [
      ...(f.subject ? [{ label: `Open ${f.subject}`, icon: <Icon name="logs" size={13} />, onSelect: () => onOpen(f.subject!) }] : []),
      { label: "Not an issue", icon: <Icon name="check" size={13} />, onSelect: () => setMuted(f.key, true) },
    ];
    const limitRow = !elsewhere && !f.fix?.resize && !!f.fix?.reveal;
    return (
      <li key={f.key} className={`finding ${cls}${limitRow && isListed(f.fix!.reveal!, composePaths) ? " limit" : ""}`} data-key={f.key}>
        <Icon name={ICON[cls]} />
        <div>
          <b><Ticks text={f.title} /></b>
          {elsewhere && (
            <span className="hint together">
              Fixed together with{" "}
              <button className="link" aria-label={`Go to the fix on ${elsewhere.subject ?? elsewhere.title}`} onClick={() => {
                const row = document.querySelector<HTMLElement>(`[data-key="${CSS.escape(elsewhere.key)}"]`);
                const fixButton = row?.querySelector<HTMLElement>(".finding-actions button.small, .limit-actions button.small");
                // A muted owner has no button here; its row (or the page) still takes focus so the move is heard.
                if (!fixButton && row) row.tabIndex = -1;
                (fixButton ?? row)?.focus();
              }}>{elsewhere.subject ?? elsewhere.title}</button>.
            </span>
          )}
          <span className="hint"><Ticks text={f.detail} /></span>
          {f.code && <pre className="code-lines">{f.code}</pre>}
          {f.after && <span className="hint"><Ticks text={f.after} /></span>}
          {f.fix?.resize && !elsewhere && <ResizeOther title={f.title} need="memory" />}
          {f.fix?.resize && <ResizeStatus from={`doctor:${f.key}`} />}
          {f.fix?.vm && <ResizeStatus from={`doctor:${f.key}`} title={f.title} okElsewhere />}
          {f.fix?.text && !f.fix.go && !elsewhere && (
            <details className="how">
              <summary><Icon name="chevron" size={12} />Or run it yourself<span className="sr-only">: {f.title}</span></summary>
              {/* A VM change is two short commands: one line of code, run in order. Other fixes keep their block. */}
              {f.fix.vm ? <p className="how-cmd"><code>{f.fix.text.split("\n").join(" && ")}</code></p> : <pre className="cmd">{f.fix.text}</pre>}
              {f.fix.note && <p className="hint">{f.fix.note}</p>}
            </details>
          )}
        </div>
        <span className="finding-actions">
          {elsewhere ? null : f.fix?.vm ? (
            <VmChangeOr from={`doctor:${f.key}`} change={f.fix.vm} title={f.title} noStatus />
          ) : f.fix?.resize ? (
            <ResizeOr from={`doctor:${f.key}`} title={f.title} need="memory" alsoStart={f.subject ? [f.subject] : []} noStatus noProfiles vmWords
              fallback={f.subject ? <button className="small" onClick={() => onOpen(f.subject!)}>Open {f.subject}</button> : <button className="small" onClick={() => onGo("Profiles")}>Open Profiles</button>} />
          ) : limitRow && !isListed(f.fix!.reveal!, composePaths) ? (
            f.subject ? <button className="small" onClick={() => onOpen(f.subject!)}>Open {f.subject}</button> : null
          ) : limitRow ? null : f.fix ? <DoctorFix fix={f.fix} title={f.title} ctx={ctx} onGo={onGo} onFixed={() => doc.reload()} /> : f.subject ? <button className="small" onClick={() => onOpen(f.subject!)}>Open {f.subject}</button> : null}
          <Menu label={`More actions for ${plain(f.title)}`} className="more" items={more}><Icon name="more" size={16} /></Menu>
        </span>
        {/* A listed project's own limit: its notes and both buttons go under the text, so the body keeps the row's width. */}
        {limitRow && isListed(f.fix!.reveal!, composePaths) && <LimitActions fix={{ ...f.fix!, reveal: f.fix!.reveal! }} ctx={ctx ?? undefined} listed={composePaths} small fallback={null} />}
      </li>
    );
  };

  // The container problems below are counted on their own rows, not here, so the line says where they are.
  const onScreen = onHome.length ? ` ${onHome.length} ${todo ? "more" : onHome.length === 1 ? "container problem" : "container problems"} ${onHome.length === 1 ? "is" : "are"} on the Containers screen.` : "";
  const summary = `${todo === 0 && onHome.length ? "Nothing needs action here." : summaryOf(todo)}${onScreen}`;
  return (
    <div className="setup doctor" onFocus={onFocusIn}>
      <div className="doctor-head">
        <p className="hint">
          {summary}{ctx || resizing(rs) ? "" : " Start the VM to also check containers, networks, images and storage."}
        </p>
        <span className="finding-actions">
          <button className="small" disabled={checking} onClick={recheck}>{checking ? "Checking…" : "Run checks again"}</button>
          <Menu label="More Doctor actions" className="more" items={[{ label: "Test a connection…", icon: <Icon name="network" size={13} />, disabled: !ctx, onSelect: () => setTesting(true) }]}><Icon name="more" size={16} /></Menu>
        </span>
      </div>
      <Banner error={setup.error ?? doc.error} />
      {/* A VM change whose row is gone (the folder is shared now): its result stays here until Dismiss. */}
      {rs.change && rs.from?.startsWith("doctor:") && <ResultRow from={rs.from} />}
      {rs.change && rs.from?.startsWith("doctor:") && (!!rs.outcome || !!rs.progress) && !listed.some((f) => `doctor:${f.key}` === rs.from) && <div className="resize-orphan"><ResizeStatus from={rs.from} okElsewhere /></div>}
      <FixRuns />
      {actions.log}
      {todo > 0 && (
        <section aria-label="Needs action">
          <div className="doctor-group-head"><h3 className="doctor-group">Needs action</h3>{/* Only fixes that edit settings: Bring over copies data and the VM size fix restarts the VM, so each asks on its own. */}{actions.fixAll(plan, sAction.filter((f) => f.fix?.kind === "fix" || f.fix?.kind === "install"), todo)}</div>
          <ul className="findings">{[...sAction.map(setupRow), ...eAction.map(item)]}</ul>
        </section>
      )}
      {onHome.length > 0 && (
        <section aria-label="On the Containers screen">
          <h3 className="doctor-group">On the Containers screen</h3>
          <ul className="findings">{onHome.map(item)}</ul>
        </section>
      )}
      {sKnow.length + eKnow.length > 0 && (
        <section aria-label="Worth knowing">
          <h3 className="doctor-group">Worth knowing</h3>
          <ul className="findings">{[...sKnow.map(setupRow), ...eKnow.map(item)]}</ul>
        </section>
      )}
      {passed.length > 0 && (
        <details className="passing">
          <summary><Icon name="chevron" size={12} />{passed.length} check{passed.length === 1 ? "" : "s"} pass</summary>
          <ul className="findings">
            {passed.map(({ t, setup: id }) => (
              <li key={t} className="finding ok" data-setup={id}><Icon name="check" /><div><b>{t}</b></div></li>
            ))}
          </ul>
        </details>
      )}
      {hidden.length > 0 && (
        <details className="passing">
          <summary><Icon name="chevron" size={12} />{hidden.length} marked not an issue</summary>
          <ul className="findings">
            {hidden.map((f) => (
              <li key={f.key} className="finding info">
                <Icon name="info" />
                <div>
                  <b>{f.title}</b>
                  <button className="link" onClick={() => setMuted(f.key, false)}>Show it again</button>
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {testing && ctx && <ConnectionTest ctx={ctx} onClose={() => setTesting(false)} />}
    </div>
  );
}


// A container problem's one button: the fix when the app can run it, else where to go, else copy the commands.
function DoctorFix({ fix, title, ctx, onGo, onFixed }: { fix: NonNullable<Finding["fix"]>; title: string; ctx: string | null; onGo: (page: Go) => void; onFixed: () => void }) {
  const confirm = useConfirm();
  const runs = useFixRuns();
  // A Fix replaces containers; it waits while the VM, a resize, a copy or Compose is changing Docker.
  useDockerLocked();
  if (fix.go) return <button className="small" aria-label={`${fix.label}: ${title}`} onClick={() => onGo(fix.go!)}>{fix.label}</button>;
  const run = fixAction(fix, ctx ?? undefined, confirm, runs, onFixed);
  if (run) return <button className="small" title={run.hint} aria-label={`${run.running ? run.busyLabel : `${run.label}…`}: ${title}`} aria-disabled={run.running || run.locked || undefined} onClick={() => !run.locked && run.go()}>{run.running ? run.busyLabel : `${run.label}…`}</button>;
  return <button className="small" aria-label={`Copy commands: ${title}`} onClick={() => navigator.clipboard.writeText(fix.text)}>Copy commands</button>;
}

// The VM size row: one button that restarts the VM with a better size, and the run's progress and result under its
// title. While the VM restarts a spinner takes the icon's place, as on the Containers screen.
function SizeRow({ f, primary, onProfiles }: { f: SetupFinding; primary: boolean; onProfiles: () => void }) {
  const s = useResize();
  const mine = s.from === "setup";
  const busy = mine && !!s.progress;
  const fix = f.fix?.kind === "resize" ? f.fix : null;
  const open = f.status !== "ok";
  const o = mine ? s.outcome : null;
  return (
    <li className={`finding ${f.status}`} data-setup={f.id}>
      {busy ? <span className="mark finding-mark" aria-hidden="true"><span className="spin" /></span> : <Icon name={ICON[f.status]} />}
      <div>
        <b>{f.title}</b>
        {/* While a result shows, it is the row's one sentence. */}
        {!o && <span className="hint"><Ticks text={f.detail} /></span>}
        {open && f.more && <span className="hint">Other numbers? <button className="link" aria-label={`${f.more.label}: ${f.title}`} onClick={onProfiles}>{f.more.label}</button></span>}
        {open && f.command && !(mine && s.outcome) && (
          <details className="how">
            <summary><Icon name="chevron" size={12} />What it does<span className="sr-only">: {f.title}</span></summary>
            <pre className="cmd">{f.command}</pre>
          </details>
        )}
        <ResizeStatus from="setup" />
      </div>
      {fix && !(mine && s.outcome) && (
        <span className="finding-actions">
          <ResizeButton from="setup" size={{ cpus: fix.cpus, memory: fix.memory }} title={f.title} primary={primary} />
          <span className="more-slot" aria-hidden="true" />
        </span>
      )}
    </li>
  );
}

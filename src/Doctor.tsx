import { useMemo, useState, useSyncExternalStore } from "react";
import { Profile, docker } from "./api";
import { usePoll } from "./hooks";
import { useSetup, useSetupActions } from "./Setup";
import BringOver from "./BringOver";
import ConnectionTest from "./ConnectionTest";
import { FixRuns, Go, fixAction, useFixRuns } from "./FixIt";
import { doctor } from "./lib/doctor";
import type { Finding, Report } from "./lib/doctor";
import { parseDiskUsage } from "./lib/disk";
import { hostArch } from "./lib/guided";
import { muted, setMuted, subscribeMuted } from "./lib/muted";
import { busy } from "./lib/fixStore";
import { fixAllPlan } from "./lib/setup";
import { biggerFix } from "./lib/sharedFix";
import type { SetupFinding } from "./lib/setup";
import { Banner, useConfirm } from "./ui";
import Menu from "./ui/Menu";
import type { MenuItem } from "./ui/Menu";
import { Icon } from "./ui/icons";
import Ticks from "./ui/Ticks";

const ICON = { ok: "check", warn: "alert", fail: "close", info: "info" } as const;

export const useMuted = () => useSyncExternalStore(subscribeMuted, muted);

// Reads what the checks need: every container, the images they run, and disk use. It only reads.
export function useDoctor(ctx: string | null, profile: Profile | null) {
  const mutedKeys = useMuted();
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
    return { containers, images, disk };
  }, [ctx], 30_000);
  const running = profile?.status === "Running";
  const runs = useFixRuns();
  const report = useMemo(() => {
    if (!ctx || !facts.data) return null;
    const r = doctor({ ctx, ...facts.data, hostArch: hostArch(profile?.arch ?? ""), vmMemory: running ? profile?.memory : undefined }, mutedKeys);
    // A NAME-old is a leftover only once its Fix has stopped; mid-Fix it is the step the Fix is on.
    return { ...r, findings: r.findings.filter((f) => !(f.id === "fix-leftover" && f.subject && busy(runs, f.subject))) };
  }, [ctx, facts.data, profile?.arch, profile?.memory, running, mutedKeys, runs]);
  return { report, error: facts.error, reload: facts.reload };
}

// What the page shows in each group. todo is the one problem count in the app: the sidebar badge and this page's
// summary both show it. A problem about one container is left out of it, because the Containers screen shows it
// under that container's row; it is listed here too, under its own heading, uncounted.
export function groups(setupFindings: SetupFinding[], report: Report | null, mutedKeys: ReadonlySet<string>) {
  const live = (report?.findings ?? []).filter((f) => !mutedKeys.has(f.key));
  // The general "small VM" note says less than the one naming what won't fit, so only one shows.
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
  onGo: (page: Go) => void;
  onOpen: (container: string) => void;
};

// Every check in one place: setup, containers, networks, images, storage and the VM. Nothing changes until a click.
export default function Doctor({ ctx, setup, doc, onProfiles, onGo, onOpen }: Props) {
  const [bringing, setBringing] = useState(false);
  const actions = useSetupActions({ reload: setup.reload, profile: setup.profile, onProfiles, onBring: () => setBringing(true), rc: setup.rc });
  const mutedKeys = useMuted();
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);

  const { sAction, onHome, sKnow, sPassed, eAction, eKnow, hidden, todo } = groups(setup.findings ?? [], doc.report, mutedKeys);
  const plan = fixAllPlan(setup.findings ?? []);
  const passed = [...sPassed.map((f) => ({ t: f.title, setup: f.id as string })), ...(doc.report?.passed ?? []).map((t) => ({ t, setup: undefined }))];

  async function recheck() {
    setChecking(true);
    await Promise.all([setup.reload(), doc.reload()]);
    setChecking(false);
  }

  const setupRow = (f: SetupFinding) => (
    actions.row(f, f.status === "fail" && plan.length <= 1)
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
    return (
      <li key={f.key} className={`finding ${cls}`} data-key={f.key}>
        <Icon name={ICON[cls]} />
        <div>
          <b>{f.title}</b>
          {elsewhere && (
            <span className="hint together">
              Fixed together with{" "}
              <button className="link" aria-label={`Go to the fix on ${elsewhere.subject ?? elsewhere.title}`} onClick={() => {
                const row = document.querySelector<HTMLElement>(`[data-key="${CSS.escape(elsewhere.key)}"]`);
                const fixButton = row?.querySelector<HTMLElement>(".finding-actions button.small");
                // A muted owner has no button here; its row (or the page) still takes focus so the move is heard.
                if (!fixButton && row) row.tabIndex = -1;
                (fixButton ?? row)?.focus();
              }}>{elsewhere.subject ?? elsewhere.title}</button>.
            </span>
          )}
          <span className="hint"><Ticks text={f.detail} /></span>
          {f.fix?.text && !f.fix.go && !elsewhere && (
            <details className="how">
              <summary><Icon name="chevron" size={12} />Or run it yourself<span className="sr-only">: {f.title}</span></summary>
              <pre className="cmd">{f.fix.text}</pre>
              {f.fix.note && <p className="hint">{f.fix.note}</p>}
            </details>
          )}
        </div>
        <span className="finding-actions">
          {elsewhere ? null : f.fix ? <DoctorFix fix={f.fix} title={f.title} ctx={ctx} onGo={onGo} onFixed={() => doc.reload()} /> : f.subject ? <button className="small" onClick={() => onOpen(f.subject!)}>Open {f.subject}</button> : null}
          <Menu label={`More actions for ${f.title}`} className="more" items={more}><Icon name="more" size={16} /></Menu>
        </span>
      </li>
    );
  };

  // The container problems below are counted on their own rows, not here, so the line says where they are.
  const onScreen = onHome.length ? ` ${onHome.length} ${todo ? "more" : onHome.length === 1 ? "container problem" : "container problems"} ${onHome.length === 1 ? "is" : "are"} on the Containers screen.` : "";
  const summary = `${todo === 0 && onHome.length ? "Nothing needs action here." : summaryOf(todo)}${onScreen}`;
  return (
    <div className="setup doctor">
      <div className="doctor-head">
        <p className="hint">
          {summary}{ctx ? "" : " Start the VM to also check containers, networks, images and storage."}
        </p>
        <span className="finding-actions">
          <button className="small" disabled={checking} onClick={recheck}>{checking ? "Checking…" : "Run checks again"}</button>
          <Menu label="More Doctor actions" className="more" items={[{ label: "Test a connection…", icon: <Icon name="network" size={13} />, disabled: !ctx, onSelect: () => setTesting(true) }]}><Icon name="more" size={16} /></Menu>
        </span>
      </div>
      <Banner error={setup.error ?? doc.error} />
      <FixRuns />
      {actions.log}
      {todo > 0 && (
        <section aria-label="Needs action">
          <div className="doctor-group-head"><h3 className="doctor-group">Needs action</h3>{actions.fixAll(plan, sAction.filter((f) => f.fix && f.fix.kind !== "copy" && f.fix.kind !== "profiles" && f.fix.kind !== "bring"), todo)}</div>
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
      {bringing && <BringOver ctx={ctx ?? ""} onClose={() => setBringing(false)} onDone={() => void Promise.all([setup.reload(), doc.reload()])} onProfiles={() => { setBringing(false); onProfiles(); }} />}
    </div>
  );
}


// A container problem's one button: the fix when the app can run it, else where to go, else copy the commands.
function DoctorFix({ fix, title, ctx, onGo, onFixed }: { fix: NonNullable<Finding["fix"]>; title: string; ctx: string | null; onGo: (page: Go) => void; onFixed: () => void }) {
  const confirm = useConfirm();
  const runs = useFixRuns();
  if (fix.go) return <button className="small" aria-label={`${fix.label}: ${title}`} onClick={() => onGo(fix.go!)}>{fix.label}</button>;
  const run = fixAction(fix, ctx ?? undefined, confirm, runs, onFixed);
  if (run) return <button className="small" title={run.hint} aria-label={`${run.running ? run.busyLabel : `${run.label}…`}: ${title}`} aria-disabled={run.running || undefined} onClick={run.go}>{run.running ? run.busyLabel : `${run.label}…`}</button>;
  return <button className="small" aria-label={`Copy commands: ${title}`} onClick={() => navigator.clipboard.writeText(fix.text)}>Copy commands</button>;
}

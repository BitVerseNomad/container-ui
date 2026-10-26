import { ReactNode, useMemo, useState, useSyncExternalStore } from "react";
import { Profile, docker } from "./api";
import { usePoll } from "./hooks";
import { useSetup, useSetupActions } from "./Setup";
import ConnectionTest from "./ConnectionTest";
import FixIt, { FixRuns, Go, fixAction, useFixRuns } from "./FixIt";
import { doctor } from "./lib/doctor";
import type { Finding, Report } from "./lib/doctor";
import { parseDiskUsage } from "./lib/disk";
import { hostArch } from "./lib/guided";
import { muted, setMuted, subscribeMuted } from "./lib/muted";
import { fixAllPlan } from "./lib/setup";
import type { SetupFinding } from "./lib/setup";
import { Banner, useConfirm } from "./ui";
import { Icon } from "./ui/icons";

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
  const report = useMemo(
    () => (ctx && facts.data ? doctor({ ctx, ...facts.data, hostArch: hostArch(profile?.arch ?? ""), vmMemory: running ? profile?.memory : undefined }, mutedKeys) : null),
    [ctx, facts.data, profile?.arch, profile?.memory, running, mutedKeys],
  );
  return { report, error: facts.error, reload: facts.reload };
}

// What the page shows in each group. The sidebar badge uses the same count, so the two can't disagree.
export function groups(setupFindings: SetupFinding[], report: Report | null, mutedKeys: ReadonlySet<string>) {
  const live = (report?.findings ?? []).filter((f) => !mutedKeys.has(f.key));
  // The general "small VM" note says less than the one naming what won't fit, so only one shows.
  const vmNamed = live.some((f) => f.id === "vm-memory");
  const sf = setupFindings.filter((f) => !(vmNamed && f.id === "resources"));
  const sAction = sf.filter((f) => f.status === "fail" || f.status === "warn");
  const eAction = live.filter((f) => f.severity === "action");
  return {
    sAction,
    sKnow: sf.filter((f) => f.status === "info"),
    sPassed: sf.filter((f) => f.status === "ok"),
    eAction,
    eKnow: live.filter((f) => f.severity === "know"),
    hidden: (report?.findings ?? []).filter((f) => mutedKeys.has(f.key)),
    todo: sAction.length + eAction.length,
  };
}

const summaryOf = (todo: number) => (todo === 0 ? "Nothing needs action." : `${todo} thing${todo === 1 ? " needs" : "s need"} action.`);

// The top of the Doctor where you already are: the worst few problems, one button each, and the way to the rest.
const SHOWN = 3;
type PanelProps = Omit<Props, "onOpen"> & { onOpen: (container: string) => void; onDoctor: () => void };
export function DoctorPanel({ ctx, setup, doc, onProfiles, onGo, onOpen, onDoctor }: PanelProps) {
  const actions = useSetupActions({ reload: setup.reload, profile: setup.profile, onProfiles });
  const mutedKeys = useMuted();
  const confirm = useConfirm();
  const runs = useFixRuns();
  const { sAction, eAction, todo } = groups(setup.findings ?? [], doc.report, mutedKeys);
  const plan = fixAllPlan(setup.findings ?? []);

  type Line = { key: string; title: string; cls: "fail" | "warn"; action: ReactNode; count: number };
  const review = <button onClick={onDoctor}>Review</button>;
  // Setup first (it breaks or confuses docker in your terminal, as the old strip said), then crashes, then the rest.
  const engine: Line[] = [...eAction].sort((a, b) => Number(a.level !== "bad") - Number(b.level !== "bad")).map((f) => {
    const run = f.fix ? fixAction(f.fix, ctx ?? undefined, confirm, runs, () => doc.reload()) : null;
    const action = run ? (
      <button className="primary" disabled={run.running} onClick={run.go}>{run.running ? run.busyLabel : run.label}</button>
    ) : f.fix?.go ? (
      <button onClick={() => onGo(f.fix!.go!)}>{f.fix.label}</button>
    ) : f.subject ? (
      <button onClick={() => onOpen(f.subject!)}>Open</button>
    ) : review;
    return { key: f.key, title: f.title, cls: f.level === "bad" ? "fail" : "warn", action, count: 1 };
  });
  // Several setup fixes run as one Fix all, the same as on the Doctor page. The line counts only what Fix all
  // fixes; a problem it can't fix gets its own line.
  const covered = sAction.filter((f) => f.fix?.kind === "fix" || f.fix?.kind === "install");
  const grouped = covered.length > 1 && plan.length > 1;
  const breaks = covered.some((f) => f.status === "fail");
  const single = (f: SetupFinding): Line => ({ key: f.id, title: f.title, cls: f.status === "fail" ? "fail" : "warn", action: actions.quick(f) ?? review, count: 1 });
  const setupLines: Line[] = grouped
    ? [
        { key: "setup", title: `${covered.length} setup problems${breaks ? " will break docker in your terminal" : ""}`, cls: breaks ? "fail" : "warn", action: actions.quickAll(plan, covered), count: covered.length },
        ...sAction.filter((f) => !covered.includes(f)).map(single),
      ]
    : sAction.map(single);
  const byCls = (l: Line[], c: Line["cls"]) => l.filter((x) => x.cls === c);
  const lines = [...byCls(setupLines, "fail"), ...byCls(setupLines, "warn"), ...byCls(engine, "fail"), ...byCls(engine, "warn")];
  const shown = lines.slice(0, SHOWN);
  const more = todo - shown.reduce((n, l) => n + l.count, 0);

  return (
    <>
      <FixRuns />
      {todo > 0 && (
        <section className="doctor-panel" aria-label="Doctor">
          <div className="doctor-panel-head">
            <b>{summaryOf(todo)}</b>
            <button className="link" onClick={onDoctor}>Open Doctor</button>
          </div>
          <ul className="findings">
            {shown.map((l) => (
              <li key={l.key} className={`finding ${l.cls}`}>
                <Icon name={ICON[l.cls]} />
                <div className="doctor-line"><b>{l.title}</b>{l.action}</div>
              </li>
            ))}
          </ul>
          {more > 0 && <button className="link doctor-more" onClick={onDoctor}>+ {more} more in Doctor</button>}
          {actions.log}
        </section>
      )}
    </>
  );
}

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
  const actions = useSetupActions({ reload: setup.reload, profile: setup.profile, onProfiles });
  const mutedKeys = useMuted();
  const [testing, setTesting] = useState(false);
  const [checking, setChecking] = useState(false);

  const { sAction, sKnow, sPassed, eAction, eKnow, hidden, todo } = groups(setup.findings ?? [], doc.report, mutedKeys);
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
  const item = (f: Finding) => {
    const cls = f.severity === "know" ? "info" : f.level === "bad" ? "fail" : "warn";
    return (
        <li key={f.key} className={`finding ${cls}`}>
          <Icon name={ICON[cls]} />
          <div>
            <b>{f.title}</b>
            <span className="hint">{f.detail}</span>
            {f.fix && <FixIt fix={f.fix} ctx={ctx ?? undefined} onGo={onGo} onFixed={() => doc.reload()} />}
            <span className="actions-inline doctor-links">
              {f.subject && <button className="link" onClick={() => onOpen(f.subject!)}>Open {f.subject}</button>}
              <button className="link" onClick={() => setMuted(f.key, true)}>Not an issue</button>
            </span>
          </div>
        </li>
    );
  };

  const summary = summaryOf(todo);
  return (
    <div className="setup doctor">
      <div className="doctor-head">
        <p className="hint">
          {summary} {ctx ? "Nothing changes until you click a fix." : "Start the VM to also check containers, networks, images and storage."}
        </p>
        <span className="actions-inline">
          <button disabled={!ctx} onClick={() => setTesting(true)}>Test a connection…</button>
          <button disabled={checking} onClick={recheck}>{checking ? "Checking…" : "Run checks again"}</button>
        </span>
      </div>
      <Banner error={setup.error ?? doc.error} />
      <FixRuns />
      {todo > 0 && (
        <section aria-label="Needs action">
          <h3 className="doctor-group">Needs action</h3>
          {actions.fixAll(plan)}
          <ul className="findings">{[...sAction.map(setupRow), ...eAction.map(item)]}</ul>
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
          <summary>{passed.length} check{passed.length === 1 ? "" : "s"} pass</summary>
          <ul className="findings">
            {passed.map(({ t, setup: id }) => (
              <li key={t} className="finding ok" data-setup={id}><Icon name="check" /><div><b>{t}</b></div></li>
            ))}
          </ul>
        </details>
      )}
      {hidden.length > 0 && (
        <details className="passing">
          <summary>{hidden.length} marked not an issue</summary>
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
      {actions.log}
      {testing && ctx && <ConnectionTest ctx={ctx} onClose={() => setTesting(false)} />}
    </div>
  );
}


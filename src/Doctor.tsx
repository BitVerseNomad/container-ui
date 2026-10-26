import { useMemo, useState, useSyncExternalStore } from "react";
import { Profile, docker } from "./api";
import { usePoll } from "./hooks";
import { useSetup, useSetupActions } from "./Setup";
import ConnectionTest from "./ConnectionTest";
import FixIt, { FixRuns, Go } from "./FixIt";
import { doctor } from "./lib/doctor";
import type { Finding, Report } from "./lib/doctor";
import { parseDiskUsage } from "./lib/disk";
import { hostArch } from "./lib/guided";
import { muted, setMuted, subscribeMuted } from "./lib/muted";
import { fixAllPlan } from "./lib/setup";
import type { SetupFinding } from "./lib/setup";
import { Banner } from "./ui";
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

  const summary = todo === 0 ? "Nothing needs action." : `${todo} thing${todo === 1 ? " needs" : "s need"} action.`;
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


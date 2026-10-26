import { useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { docker } from "./api";
import { useConfirm } from "./ui";
import { Icon } from "./ui/icons";
import type { Problem } from "./lib/health";
import { describe } from "./lib/fixRun";
import { busy, dismiss, runFor, snapshot, startConnect, startFix, subscribe } from "./lib/fixStore";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
export const useFixRuns = () => useSyncExternalStore(subscribe, snapshot);

// A problem's fix: a Fix button when the app can do it, and the same steps as commands to copy.
// The run's progress and result show in FixStatus on the page, which stays while this panel comes and goes.
export type Go = NonNullable<NonNullable<Problem["fix"]>["go"]>;
type Fix = NonNullable<Problem["fix"]>;
type Confirm = ReturnType<typeof useConfirm>;
type Runs = ReturnType<typeof useFixRuns>;

// The one-click part of a fix (Replace or Connect), shared by the full Fix and the Doctor panel's button.
// Null when the app can't run it, so the caller offers the commands instead.
export function fixAction(fix: Fix, ctx: string | undefined, confirm: Confirm, runs: Runs, onFixed?: (name: string) => void) {
  if (!ctx) return null;
  if (fix.connect) {
    const c = fix.connect;
    const running = c.containers.some((n) => busy(runs, n));
    const go = async () => {
      const what = `${c.create ? `Create the network ${c.network} and connect` : `Connect`} ${c.containers.join(" and ")}${c.create ? "" : ` to ${c.network}`}? Their other networks stay as they are.`;
      if (running || !(await confirm(what, "Connect"))) return;
      startConnect(c, (args) => docker(ctx, args), (r) => r.ok && onFixed?.(c.containers[0]));
    };
    return { label: "Connect", busyLabel: "Connecting…", running, go, hint: `Adds ${c.containers.join(" and ")} to ${c.network}. Nothing is restarted.` };
  }
  if (!fix.steps) return null;
  const steps = fix.steps;
  const names = steps.map((s) => s.name);
  const running = names.some((n) => busy(runs, n));
  const go = async () => {
    if (running || !(await confirm(fix.confirm ?? `Replace ${names.join(" and ")}?`, "Fix"))) return;
    startFix(
      steps,
      (args) => docker(ctx, args, args[0] === "logs"),
      sleep,
      (args) => invoke<void>("docker_check", { args }),
      (r) => r.ok && onFixed?.(names[names.length - 1]),
    );
  };
  return { label: names.length > 1 ? "Fix both" : "Fix", busyLabel: "Fixing…", running, go, hint: names.length > 1 ? `Replaces ${names.join(", then ")}.` : `Replaces ${names[0]}.` };
}

export default function FixIt({ fix, ctx, onFixed, onGo }: { fix: NonNullable<Problem["fix"]>; ctx?: string; onFixed?: (name: string) => void; onGo?: (page: Go) => void }) {
  const confirm = useConfirm();
  const runs = useFixRuns();
  if (fix.go) return onGo ? <span className="actions-inline"><button onClick={() => onGo(fix.go!)}>{fix.label}</button></span> : null;
  const run = fixAction(fix, ctx, confirm, runs, onFixed);
  const canRun = !!run;
  const copy = (
    <>
      <pre className="cmd" aria-label={fix.label}>{fix.text}</pre>
      <span className="actions-inline">
        <button onClick={() => navigator.clipboard.writeText(fix.text)}><Icon name="copy" size={14} /> Copy commands</button>
        {!canRun && <span className="hint">Run them in your terminal.{fix.note ? ` ${fix.note}` : ""}</span>}
      </span>
    </>
  );
  if (!run) return copy;

  // Joining a network only adds, so it asks once and needs no undo.
  return (
    <>
      <span className="actions-inline">
        <button className="primary" disabled={run.running} onClick={run.go}>{run.running ? run.busyLabel : run.label}</button>
        <span className="hint">{run.hint}</span>
      </span>
      <details className="fix-commands">
        <summary>Or run the commands yourself</summary>
        {copy}
        {fix.note && !fix.connect && <p className="hint">{fix.note}</p>}
      </details>
    </>
  );
}

// Progress and the outcome of a fix that involves this container, until dismissed or the next fix.
export function FixStatus({ name }: { name: string }) {
  const run = runFor(useFixRuns(), name);
  if (!run) return null;
  if (run.step) return <p className="fix-result" role="status" aria-live="polite">{run.step}</p>;
  const r = run.result;
  if (!r) return null;
  return (
    <div className={`fix-result ${r.ok ? "ok" : "bad"}`} role="status">
      <p>
        {r.ok && <Icon name="check" size={14} />} {describe(r)}{" "}
        <button className="link fix-dismiss" onClick={() => dismiss(name)}>Dismiss</button>
      </p>
      {!r.ok && r.logs && <pre className="cmd">{r.logs.trim().split("\n").slice(-12).join("\n")}</pre>}
    </div>
  );
}

// Every fix started from a page that lists many problems. A fixed problem leaves the list, so its result shows here.
export function FixRuns() {
  const runs = useFixRuns();
  return <>{runs.map((r) => <FixStatus key={r.names.join(",")} name={r.names[0]} />)}</>;
}

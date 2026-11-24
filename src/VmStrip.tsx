import { ReactNode, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
// The VM in one line: name, state, what containers use of its CPU, memory and disk, and Start/Stop/Restart.
import { Profile, gbOf } from "./api";
import { formatBytes } from "./containerInfo";
import { fraction } from "./lib/usage";
import OutputLog from "./ui/OutputLog";
import { explainStartFailure } from "./lib/startFailure";
import { Button } from "./ui/op/Button";
import { Icon } from "./ui/op/Icon";

export type Totals = { cores: number; memBytes: number; diskBytes: number } | null;
type Props = {
  // A line about the Mac side of things (docker in the terminal), shown under the usage.
  note?: ReactNode;
  profile: Profile;
  totals: Totals;
  op: "starting" | "stopping" | "restarting" | null;
  failure: string | null;
  // which operation produced `failure`; a failed stop needs different words and a different fix
  failedOp?: "starting" | "stopping" | "restarting";
  onStart: () => void;
  // the stopped card below has the Start button, so the strip leaves it out
  startInCard?: boolean;
  onRetry: () => void;
  onStop: () => void;
  onRestart: () => void;
  onForce: () => void;
  onForceStop: () => void;
  // A container fix is running: a VM restart in the middle would leave its container half replaced.
  fixing?: boolean;
  // The VM size fix's own line ("Restarting the VM with 6 CPUs and 8 GiB… about a minute"). Its page reports the
  // run, so the strip only says this: no Cancel (it would leave the containers stopped) and no Colima output.
  line?: string;
};

function Use({ label, value, part }: { label: string; value: string; part: number }) {
  const pct = Math.round(part * 100);
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={`${label}: ${value}`}>
      <span className="whitespace-nowrap"><span className="hint">{label}</span> {value}</span>
      <span className="relative block h-1 w-16 overflow-hidden rounded-full bg-tile [&>i]:block [&>i]:h-full [&>i]:bg-accent" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span>
    </span>
  );
}

export default function VmStrip({ profile, totals, op, failure, failedOp, onStart, startInCard, onRetry, onStop, onRestart, onForce, onForceStop, note, fixing, line }: Props) {
  const running = profile.status === "Running";
  const t = totals ?? { cores: 0, memBytes: 0, diskBytes: 0 };
  const busy = op !== null;
  const [log, setLog] = useState("");
  useEffect(() => {
    if (!failure) return setLog("");
    invoke<string>("vm_log_tail", { name: profile.name }).then(setLog).catch(() => setLog(""));
  }, [failure, profile.name]);
  const stopFailed = !!failure && failedOp === "stopping";
  const why = !failure ? null : stopFailed
    ? { title: `Couldn't stop ${profile.name}`, detail: "Colima didn't answer in time, so the VM may still be running. Force stop shuts it down without waiting; your containers and images stay.", line: undefined, fix: "force_stop" as const }
    : explainStartFailure(failure, profile.name, log);
  // A failed stop leaves the VM as it was, so show its real state, not "Failed".
  const state = op === "starting" ? "Starting…" : op === "restarting" ? "Restarting…" : op === "stopping" ? "Stopping…" : failure && !stopFailed ? "Failed" : profile.status;
  const dot = stopFailed ? "warn" : running && !failure ? "on" : failure ? "bad" : "";
  return (
    <div className="vm-strip-wrap flex flex-col gap-1.5">
      <div className="vm-strip flex min-h-8 flex-wrap items-center gap-2.5">
        {op ? <span className="mark" aria-hidden="true"><span className="spin" /></span> : <span className={`sdot ${dot}`} aria-hidden="true" />}
        <span className="hint whitespace-nowrap">{state}</span>
        {busy && line && <span className="hint vm-line">{line}</span>}
        {running && !busy && (
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <Use label="CPU" value={`${t.cores.toFixed(1)} of ${profile.cpus} cores`} part={fraction(t.cores, profile.cpus)} />
            <Use label="Memory" value={`${formatBytes(t.memBytes)} of ${gbOf(profile.memory)} GiB`} part={fraction(t.memBytes, profile.memory)} />
            <Use label="Disk" value={`${formatBytes(t.diskBytes)} of ${gbOf(profile.disk)} GiB`} part={fraction(t.diskBytes, profile.disk)} />
          </span>
        )}
        <span className="inline-flex items-center gap-2">
          {busy && line ? null : busy ? (
            <Button size="sm" onClick={() => invoke("cancel_vm_op").catch(() => {})}>Cancel</Button>
          ) : running && !failure ? (
            <>
              <Button size="sm" aria-label={`Restart the ${profile.name} VM`} title={fixing ? "Wait for the fix to finish" : `Restart the ${profile.name} VM`} disabled={busy || fixing} onClick={onRestart}>Restart</Button>
              <Button size="sm" aria-label={`Stop the ${profile.name} VM`} title={fixing ? "Wait for the fix to finish" : `Stop the ${profile.name} VM`} disabled={busy || fixing} onClick={onStop}>Stop VM</Button>
            </>
          ) : failure || startInCard ? null : (
            <Button variant="primary" size="sm" disabled={busy} onClick={onStart}>Start</Button>
          )}
        </span>
      </div>
      {!busy && note}
      {why && !busy && (
        <div className="problem-line text-bad">
          <b><Icon name="alert" size="sm" /> {why.title}</b>
          <span className="hint">{why.detail}</span>
          {why.line && <pre className="cmd">{why.line}</pre>}
          <span className="actions-inline">
            {why.fix === "force_restart" && <Button variant="primary" size="sm" onClick={onForce}>Force stop, then start</Button>}
            {why.fix === "force_stop" && <Button variant="primary" size="sm" onClick={onForceStop}>Force stop</Button>}
            <Button variant={why.fix === "retry" ? "primary" : "default"} size="sm" onClick={onRetry}>{stopFailed ? "Try stopping again" : "Try starting again"}</Button>
            <Button size="sm" icon="copy" onClick={() => navigator.clipboard.writeText(`colima ${stopFailed ? "stop" : "start"} failed (machine ${profile.name}, ${profile.arch})\n\n--- colima output\n${failure}\n\n--- VM log (last lines)\n${log || "(empty)"}`)}>Copy details</Button>
          </span>
        </div>
      )}
      {!line && <OutputLog event="colima-progress" active={busy} failure={why ? null : failure} collapsed={!!why} />}
    </div>
  );
}

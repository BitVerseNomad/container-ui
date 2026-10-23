import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
// The VM in one line: name, state, what containers use of its CPU, memory and disk, and Start/Stop/Restart.
import { Profile, gbOf } from "./api";
import { formatBytes } from "./containerInfo";
import { fraction } from "./lib/usage";
import IconButton from "./ui/IconButton";
import OutputLog from "./ui/OutputLog";
import { explainStartFailure } from "./lib/startFailure";
import { Icon } from "./ui/icons";

export type Totals = { cores: number; memBytes: number; diskBytes: number } | null;
type Props = {
  profile: Profile;
  totals: Totals;
  op: "starting" | "stopping" | null;
  failure: string | null;
  // which operation produced `failure`; a failed stop needs different words and a different fix
  failedOp?: "starting" | "stopping";
  onStart: () => void;
  onRetry: () => void;
  onStop: () => void;
  onRestart: () => void;
  onForce: () => void;
  onForceStop: () => void;
};

function Use({ label, value, part }: { label: string; value: string; part: number }) {
  const pct = Math.round(part * 100);
  return (
    <span className="use" title={`${label}: ${value}`}>
      <span className="use-text"><span className="hint">{label}</span> {value}</span>
      <span className="bar thin" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}><i style={{ width: `${pct}%` }} /></span>
    </span>
  );
}

export default function VmStrip({ profile, totals, op, failure, failedOp, onStart, onRetry, onStop, onRestart, onForce, onForceStop }: Props) {
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
  const state = op === "starting" ? "Starting…" : op === "stopping" ? "Stopping…" : failure && !stopFailed ? "Failed" : profile.status;
  const dot = stopFailed ? "warn" : running && !failure ? "on" : failure ? "bad" : "";
  return (
    <div className="vm-strip-wrap">
      <div className="vm-strip">
        <span className={`sdot ${dot}`} aria-hidden="true" />
        <b>{profile.name}</b>
        <span className="hint vm-state">{state}</span>
        {running && !busy && (
          <span className="uses">
            <Use label="CPU" value={`${t.cores.toFixed(1)}/${profile.cpus}`} part={fraction(t.cores, profile.cpus)} />
            <Use label="Mem" value={`${formatBytes(t.memBytes)}/${gbOf(profile.memory)} GiB`} part={fraction(t.memBytes, profile.memory)} />
            <Use label="Disk" value={`${formatBytes(t.diskBytes)}/${gbOf(profile.disk)} GiB`} part={fraction(t.diskBytes, profile.disk)} />
          </span>
        )}
        <span className="vm-actions">
          {busy ? (
            <button onClick={() => invoke("cancel_vm_op").catch(() => {})}>Cancel</button>
          ) : running && !failure ? (
            <>
              <IconButton label={`Restart the ${profile.name} VM`} icon="restart" disabled={busy} onClick={onRestart} />
              <IconButton label={`Stop the ${profile.name} VM`} icon="stop" disabled={busy} onClick={onStop} />
            </>
          ) : failure ? null : (
            <button className="primary" disabled={busy} onClick={onStart}>Start</button>
          )}
        </span>
      </div>
      {why && !busy && (
        <div className="problem-line bad start-why">
          <b><Icon name="alert" size={14} /> {why.title}</b>
          <span className="hint">{why.detail}</span>
          {why.line && <pre className="cmd">{why.line}</pre>}
          <span className="actions-inline">
            {why.fix === "force_restart" && <button className="primary" onClick={onForce}>Force stop, then start</button>}
            {why.fix === "force_stop" && <button className="primary" onClick={onForceStop}>Force stop</button>}
            <button className={why.fix === "retry" ? "primary" : ""} onClick={onRetry}>{stopFailed ? "Try stopping again" : "Try starting again"}</button>
            <button onClick={() => navigator.clipboard.writeText(`colima ${stopFailed ? "stop" : "start"} failed (profile ${profile.name}, ${profile.arch})\n\n--- colima output\n${failure}\n\n--- VM log (last lines)\n${log || "(empty)"}`)}><Icon name="copy" size={14} /> Copy details</button>
          </span>
        </div>
      )}
      <OutputLog event="colima-progress" active={busy} failure={why ? null : failure} collapsed={!!why} />
    </div>
  );
}

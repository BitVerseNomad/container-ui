// The VM in one line: name, state, what containers use of its CPU, memory and disk, and Start/Stop/Restart.
import { Profile, gbOf } from "./api";
import { formatBytes } from "./containerInfo";
import { fraction } from "./lib/usage";
import IconButton from "./ui/IconButton";
import OutputLog from "./ui/OutputLog";

export type Totals = { cores: number; memBytes: number; diskBytes: number } | null;
type Props = {
  profile: Profile;
  totals: Totals;
  op: "starting" | "stopping" | null;
  failure: string | null;
  onStart: () => void;
  onRetry: () => void;
  onStop: () => void;
  onRestart: () => void;
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

export default function VmStrip({ profile, totals, op, failure, onStart, onRetry, onStop, onRestart }: Props) {
  const running = profile.status === "Running";
  const t = totals ?? { cores: 0, memBytes: 0, diskBytes: 0 };
  const busy = op !== null;
  const state = op === "starting" ? "Starting…" : op === "stopping" ? "Stopping…" : failure ? "Failed" : profile.status;
  return (
    <div className="vm-strip-wrap">
      <div className="vm-strip">
        <span className={`sdot ${running && !failure ? "on" : failure ? "bad" : ""}`} aria-hidden="true" />
        <b>{profile.name}</b>
        <span className="hint vm-state">{state}</span>
        {running && !busy && (
          <span className="uses">
            <Use label="CPU" value={`${t.cores.toFixed(1)}/${profile.cpus}`} part={fraction(t.cores, profile.cpus)} />
            <Use label="Mem" value={`${formatBytes(t.memBytes)}/${gbOf(profile.memory)} GB`} part={fraction(t.memBytes, profile.memory)} />
            <Use label="Disk" value={`${formatBytes(t.diskBytes)}/${gbOf(profile.disk)} GB`} part={fraction(t.diskBytes, profile.disk)} />
          </span>
        )}
        <span className="vm-actions">
          {running && !failure ? (
            <>
              <IconButton label={`Restart the ${profile.name} VM`} icon="restart" disabled={busy} onClick={onRestart} />
              <IconButton label={`Stop the ${profile.name} VM`} icon="stop" disabled={busy} onClick={onStop} />
            </>
          ) : failure ? (
            <button className="primary" disabled={busy} onClick={onRetry}>Retry</button>
          ) : (
            <button className="primary" disabled={busy} onClick={onStart}>Start</button>
          )}
        </span>
      </div>
      <OutputLog event="colima-progress" active={busy} failure={failure} />
    </div>
  );
}

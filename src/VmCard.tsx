import { Profile, gbOf } from "./api";
import { formatBytes } from "./containerInfo";
import { fraction } from "./lib/usage";
import Card from "./ui/Card";
import Meter from "./ui/Meter";
import OutputLog from "./ui/OutputLog";
import { Icon } from "./ui/icons";

export type Totals = { cores: number; memBytes: number; diskBytes: number } | null;
type Props = {
  profile: Profile;
  totals: Totals;
  busy: boolean;
  failure: string | null;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
};

export default function VmCard({ profile, totals, busy, failure, onStart, onStop, onRestart }: Props) {
  const running = profile.status === "Running";
  const t = totals ?? { cores: 0, memBytes: 0, diskBytes: 0 };
  return (
    <Card className="vm-card">
      <div className="vm-top">
        <div>
          <b>{profile.name}</b>
          <span className="hint"> · {profile.runtime} · {profile.arch}{profile.address ? ` · ${profile.address}` : ""}</span>
        </div>
        <div className="actions-inline">
          {running && !failure ? (
            <>
              <button disabled={busy} onClick={onRestart}><Icon name="restart" size={14} /> Restart</button>
              <button disabled={busy} onClick={onStop}><Icon name="stop" size={14} /> Stop</button>
            </>
          ) : failure ? (
            <button className="primary" disabled={busy} onClick={onStart}>Retry</button>
          ) : (
            <button className="primary" disabled={busy} onClick={onStart}>Start</button>
          )}
        </div>
      </div>
      {running && !busy && (
        <div className="meters">
          <Meter label="CPU · containers use" value={`${t.cores.toFixed(1)} of ${profile.cpus} cores`} fraction={fraction(t.cores, profile.cpus)} />
          <Meter label="Memory" value={`${formatBytes(t.memBytes)} of ${gbOf(profile.memory)} GB`} fraction={fraction(t.memBytes, profile.memory)} />
          <Meter label="Disk" value={`${formatBytes(t.diskBytes)} of ${gbOf(profile.disk)} GB`} fraction={fraction(t.diskBytes, profile.disk)} />
        </div>
      )}
      <OutputLog event="colima-progress" active={busy} failure={failure} />
    </Card>
  );
}

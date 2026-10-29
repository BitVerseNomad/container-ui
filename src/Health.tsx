import { ReactNode } from "react";
import { Line, ago } from "./lib/events";
import { Problem, State, problemsFor } from "./lib/health";
import Ticks from "./ui/Ticks";
import FixIt from "./FixIt";
import { ResizeOr } from "./Resize";

export const stripHealth = (status: string) => status.replace(/\s*\((?:un)?healthy\)|\s*\(health: starting\)/, "");

export function HealthBadge({ status }: { status: "starting" | "healthy" | "unhealthy" | null }) {
  if (!status) return null;
  return <span className={`hbadge ${status}`}>{status}</span>;
}

export function ActivityList({ lines, empty }: { lines: Line[]; empty: string }) {
  if (lines.length === 0) return <p className="hint">{empty}</p>;
  const now = Date.now();
  return (
    <ul className="activity">
      {lines.map((l, i) => (
        <li key={`${l.time}-${i}`} className={l.level}>
          <span className="adot" aria-hidden="true" />
          <span>{l.text}</span>
          <span className="when">{ago(l.time, now)}</span>
        </li>
      ))}
    </ul>
  );
}

// Health, restarts and anything wrong with a container, in plain words.
// ctx and onFixed let a problem with a fix run it here; onFixed gets the name of the replaced container.
export function HealthPanel({ state, extra = [], onLogs, ctx, onFixed }: { state: State; extra?: Problem[]; onLogs?: () => void; ctx?: string; onFixed?: (name: string) => void }): ReactNode {
  const problems: Problem[] = [...problemsFor(state), ...extra];
  return (
    <div className="health-panel panel">
      <div className="hp-row">
        <b>Health</b>
        {state.health ? (
          <>
            <HealthBadge status={state.health.status} />
            {state.health.streak > 0 && !problems.some((p) => p.id === "unhealthy") && <span className="hint">{state.health.streak} checks in a row have failed</span>}
          </>
        ) : (
          <span className="hint">No health check is defined for this image. Without one, Docker can tell a container is running but not whether it is working.</span>
        )}
      </div>
      <div className="hp-row">
        <b>Restarts</b>
        <span>{state.restartCount}</span>
        <span className="hint">{state.running ? (state.startedAt ? `Started ${ago(Date.parse(state.startedAt), Date.now())}` : "Running") : `Exited with code ${state.exitCode}`}</span>
      </div>
      {problems.map((p) => (
        <div key={p.id} className={`problem-line ${p.level}`}>
          <b>{p.title}</b>
          <div className="hint"><Ticks text={p.detail} /></div>
          {p.fix?.resize ? (
            <ResizeOr from={`detail:${state.name}:${p.id}`} title={`${p.title}, ${state.name}`} need="memory" alsoStart={[state.name]} primary vmWords fallback={onLogs && <button onClick={onLogs}>Open the logs</button>} />
          ) : p.fix ? (
            <FixIt fix={p.fix} ctx={ctx} onFixed={onFixed} />
          ) : (
            onLogs && <button onClick={onLogs}>Open the logs</button>
          )}
        </div>
      ))}
    </div>
  );
}

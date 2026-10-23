import { ReactNode } from "react";
import { Line, ago } from "./lib/events";
import { Problem, State, problemsFor } from "./lib/health";

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
export function HealthPanel({ state, onLogs }: { state: State; onLogs?: () => void }): ReactNode {
  const problems: Problem[] = problemsFor(state);
  return (
    <div className="health-panel panel">
      <div className="hp-row">
        <b>Health</b>
        {state.health ? (
          <>
            <HealthBadge status={state.health.status} />
            {state.health.streak > 0 && <span className="hint">{state.health.streak} checks in a row have failed</span>}
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
          <div className="hint">{p.detail}</div>
          {onLogs && <button onClick={onLogs}>Open the logs</button>}
        </div>
      ))}
    </div>
  );
}

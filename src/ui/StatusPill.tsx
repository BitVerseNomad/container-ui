export type PillState = "running" | "stopped" | "starting" | "stopping" | "error";

const TEXT: Record<PillState, string> = {
  running: "VM running",
  stopped: "VM stopped",
  starting: "Starting…",
  stopping: "Stopping…",
  error: "VM error",
};

export default function StatusPill({ state }: { state: PillState }) {
  return (
    <span className={`pill ${state}`} role="status">
      <span className="pdot" aria-hidden="true" />
      {TEXT[state]}
    </span>
  );
}

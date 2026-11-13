import { useCallback, useState } from "react";
import { Sheet, Command, Sev, Empty, Button } from "./ui/op";
import { useActivity } from "./Commands";
import { useFixRuns } from "./FixIt";

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function Activity({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { entries } = useActivity();
  const fixing = useFixRuns().some((r) => r.step != null);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  return (
    <Sheet open={open} onClose={onClose} title="Activity">
      {!entries.length && <Empty icon="logs" title="Nothing yet">Every command the app runs shows up here.</Empty>}
      {entries.length && (
        <ul className="list">
          {entries.map((e) => {
            const again = e.again && e.ok !== null && !fixing;
            return (
              <li key={e.id} className={e.ok === false ? "bad" : undefined}>
                <span className="hint">{time(e.at)}</span>
                <Command text={e.cmd} />
                {e.ok === false && <Sev level="bad" />}
                {e.ok === null && <span className="hint">running</span>}
                {e.ok === false && <span className="hint">failed</span>}
                {again && (
                  <Button size="xs" onClick={() => { setErr(null); e.again!().catch((x) => setErr(x instanceof Error ? x.message : String(x))); }}>
                    Run again
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

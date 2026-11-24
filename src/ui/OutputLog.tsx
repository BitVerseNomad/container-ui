import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { LogLine, applyFrame, cleanFrame, summarizeFailure } from "../lib/logClean";
import { Button } from "./op/Button";
import { Icon } from "./op/Icon";

type Props = { event: string; failure?: string | null; active?: boolean; onClear?: () => void; collapsed?: boolean };

// Live, cleaned view of a streamed command. The parent passes `failure` (the error string from the
// invoke call) and `active` (an operation is running; starting a new one clears old output).
// The log has a fixed height and scrolls itself, so it never pushes the page below it off screen.
export default function OutputLog({ event, failure = null, active = false, onClear, collapsed = false }: Props) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    // If the window may not listen (a missing capability), keep going: the final error still shows.
    const un = listen<string>(event, (e) => setLines((l) => applyFrame(l, e.payload).slice(-400))).catch(() => null);
    return () => {
      un.then((f) => f?.());
    };
  }, [event]);

  useEffect(() => {
    if (active) setLines([]);
  }, [active]);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [lines]);

  if (!lines.length && !active && !failure) return null;
  const headline = failure ? summarizeFailure(failure.split("\n").map(cleanFrame)) : "";

  // Folded: a run that did not fail keeps its output one click away. A problem card above a failure
  // already explains it, so `collapsed` folds that too. Only a live or failed run shows the full log.
  if (!active && (collapsed || !failure))
    return lines.length ? (
      <details className="out-more">
        <summary><Icon name="chev-down" size="sm" />Show output ({lines.length} lines)</summary>
        <pre ref={box} className="out-log mt-2 max-h-56 overflow-auto rounded-md bg-bg-canvas p-3 font-mono text-meta text-fg">
          {lines.map((l, i) => (
            <div key={i} className="whitespace-pre-wrap font-mono text-meta">{l.text}</div>
          ))}
        </pre>
      </details>
    ) : null;

  return (
    <div className="out flex min-w-0 flex-col gap-2">
      {failure && <p className="out-fail" role="alert">{headline || "Something went wrong."}</p>}
      <div className="flex flex-wrap items-center gap-2 text-meta">
        <span className="state mr-auto text-fg-muted">{active ? "Working…" : "Output"}</span>
        <Button size="xs" icon="copy" onClick={() => navigator.clipboard.writeText(lines.map((l) => l.raw).join("\n"))}>Copy raw output</Button>
        {onClear && !active && (
          <Button size="xs" onClick={() => { setLines([]); onClear(); }}>Clear</Button>
        )}
      </div>
      <pre ref={box} className="out-log max-h-56 overflow-auto rounded-md bg-bg-canvas p-3 font-mono text-meta text-fg">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap font-mono text-meta">{l.text}</div>
        ))}
      </pre>
    </div>
  );
}

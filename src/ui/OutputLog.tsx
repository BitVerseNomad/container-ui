import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { LogLine, applyFrame, cleanFrame, summarizeFailure } from "../lib/logClean";
import { Icon } from "./icons";

type Props = { event: string; failure?: string | null; active?: boolean; onClear?: () => void };

// Live, cleaned view of a streamed command. The parent passes `failure` (the error string from the
// invoke call) and `active` (an operation is running; starting a new one clears old output).
export default function OutputLog({ event, failure = null, active = false, onClear }: Props) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const box = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const un = listen<string>(event, (e) => setLines((l) => applyFrame(l, e.payload).slice(-400)));
    return () => {
      un.then((f) => f());
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

  return (
    <div className="out">
      {failure && <p className="out-fail" role="alert">{headline || "Something went wrong."}</p>}
      <div className="out-bar">
        <span className="state">{active ? "Working…" : "Output"}</span>
        <button onClick={() => navigator.clipboard.writeText(lines.map((l) => l.raw).join("\n"))}>
          <Icon name="copy" size={14} /> Copy raw output
        </button>
        {onClear && !active && (
          <button onClick={() => { setLines([]); onClear(); }}>Clear</button>
        )}
      </div>
      <pre ref={box} className="out-log">
        {lines.map((l, i) => (
          <div key={i} className={`ln ${l.level}`}>{l.text}</div>
        ))}
      </pre>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { docker } from "./api";
import { usePoll } from "./hooks";
import { Banner } from "./ui/op";
import { Canvas, Field, type CanvasLine, useToast } from "./ui/op";
import { LogLine, mergeLogs, sinceOf } from "./lib/logMerge";

const KEEP_LINES = 10_000;
const FOLLOW_SLACK_PX = 4;

const clock = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour12: false }) + "  " : "");
const levelOf = (text: string): CanvasLine["level"] => (/\b(error|fatal|panic)\b/i.test(text) ? "e" : /\bwarn(ing)?\b/i.test(text) ? "w" : undefined);

// The filter field the page puts in the tabs row, on the Logs tab.
export function LogFilter({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  return <Field icon="search" width="filter" aria-label="Filter lines" placeholder="Filter lines" value={value} onChange={(e) => onChange(e.target.value)} />;
}

type Props = {
  ctx: string;
  id: string;
  name: string;
  filter: string;
  follow: boolean;
  onFollowChange: (on: boolean) => void;
  registerCopy: (copy: () => void) => void;
};

export default function Logs({ ctx, id, name, filter, follow, onFollowChange, registerCopy }: Props) {
  // First the last 500 lines, then only what is new since the last timestamp: a tick costs a few lines, not 1000.
  const [lines, setLines] = useState<LogLine[] | null>(null);
  const have = useRef<LogLine[]>([]);
  useEffect(() => {
    have.current = [];
    setLines(null);
  }, [ctx, id]);
  const { data, error } = usePoll(() => {
    const since = sinceOf(have.current);
    return docker(ctx, since ? ["logs", "--timestamps", "--since", since, id] : ["logs", "--timestamps", "--tail", "500", id], true);
  }, [ctx, id], 2000);
  useEffect(() => {
    if (data === null) return;
    have.current = mergeLogs(have.current, data, KEEP_LINES);
    setLines(have.current);
  }, [data]);

  const toast = useToast();
  const paneRef = useRef<HTMLPreElement>(null);
  const lastTop = useRef(0);

  const shown = useMemo(() => {
    const q = filter.toLowerCase();
    return (lines ?? []).slice(-KEEP_LINES).filter((l) => !q || l.text.toLowerCase().includes(q));
  }, [lines, filter]);

  useEffect(() => {
    if (follow && paneRef.current) paneRef.current.scrollTop = paneRef.current.scrollHeight;
  }, [shown, follow]);

  const copy = useCallback(() => {
    const text = shown.map((l) => clock(l.iso) + l.text).join("\n");
    navigator.clipboard.writeText(text).then(() => toast({ text: "Copied logs" }));
  }, [shown, toast]);
  useEffect(() => {
    registerCopy(copy);
  }, [copy, registerCopy]);

  const canvasLines: CanvasLine[] = shown.map((l) => ({ time: clock(l.iso), text: l.text, level: levelOf(l.text) }));

  return (
    <div className="stack">
      {error && <Banner tone="bad">{error}</Banner>}
      {/* The pane is bounded by the window, so the log scrolls inside it and not the whole page. */}
      <Canvas
        ref={paneRef}
        fill
        className="h-[calc(100dvh-16rem)]"
        aria-label={`Logs of ${name}`}
        lines={canvasLines.length > 0 ? canvasLines : undefined}
        onScroll={(e) => {
          // Our own auto-scroll only moves down, so only an upward scroll means the user wants to read back.
          const el = e.currentTarget;
          const up = el.scrollTop < lastTop.current - FOLLOW_SLACK_PX;
          lastTop.current = el.scrollTop;
          if (up && follow) onFollowChange(false);
        }}
      >
        {canvasLines.length === 0 ? (lines === null ? "Loading…" : filter ? "No lines match." : "No log output.") : null}
      </Canvas>
    </div>
  );
}

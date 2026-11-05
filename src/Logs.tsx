import { useEffect, useMemo, useRef, useState } from "react";
import { docker } from "./api";
import { usePoll } from "./hooks";
import { Banner } from "./ui";
import { Icon } from "./ui/icons";
import { LogLine, mergeLogs, sinceOf } from "./lib/logMerge";

const clock = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour12: false }) + "  " : "");

type Props = { ctx: string; id: string };

export default function Logs({ ctx, id }: Props) {
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
    have.current = mergeLogs(have.current, data);
    setLines(have.current);
  }, [data]);
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLPreElement>(null);
  const lastTop = useRef(0);

  const text = useMemo(() => {
    const q = filter.toLowerCase();
    const shown = (lines ?? []).filter((l) => !q || l.text.toLowerCase().includes(q));
    return shown.map((l) => clock(l.iso) + l.text).join("\n");
  }, [lines, filter]);

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [text, follow]);

  return (
    <>
      <div className="log-bar">
        <input className="filter" placeholder="Filter lines" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className={follow ? "toggle on" : "toggle"} aria-pressed={follow} onClick={() => setFollow((f) => !f)}>
          {follow ? "Following new lines" : "Paused, click to follow"}
        </button>
        <button onClick={() => navigator.clipboard.writeText(text)} disabled={!text}><Icon name="copy" size={14} /> Copy</button>
      </div>
      <Banner error={error} />
      <pre
        ref={box}
        className="logs"
        onScroll={(e) => {
          // Our own auto-scroll only moves down, so only an upward scroll means the user wants to read back.
          const el = e.currentTarget;
          const up = el.scrollTop < lastTop.current - 4;
          lastTop.current = el.scrollTop;
          if (up) setFollow(false);
          else if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setFollow(true);
        }}
      >
        {text || (lines === null ? "Loading…" : filter ? "No lines match." : "No log output.")}
      </pre>
    </>
  );
}

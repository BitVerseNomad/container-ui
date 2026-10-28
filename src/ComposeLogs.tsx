// A project's logs, live: the last 300 lines of each service, then every 2 seconds only what is new. Filter by
// service or text; scrolling up pauses following, scrolling back to the end resumes it.
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePoll } from "./hooks";
import { Banner } from "./ui";
import { Icon } from "./ui/icons";
import { ProjectLine, mergeProjectLogs, projectSince, serviceName } from "./lib/composeLogs";

const clock = (iso: string) => (iso ? new Date(iso).toLocaleTimeString([], { hour12: false }) : "");

type Props = { ctx: string; file: string; project: string };

export default function ComposeLogs({ ctx, file, project }: Props) {
  const have = useRef<ProjectLine[]>([]);
  const [lines, setLines] = useState<ProjectLine[] | null>(null);
  const { data, error } = usePoll(() => invoke<string>("compose_logs", { context: ctx, file, since: projectSince(have.current) }), [ctx, file], 2000);
  useEffect(() => {
    if (data === null) return;
    have.current = mergeProjectLogs(have.current, data);
    setLines(have.current);
  }, [data]);

  const services = useMemo(() => [...new Set((lines ?? []).map((l) => l.service).filter(Boolean))].sort(), [lines]);
  const [only, setOnly] = useState("");
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLPreElement>(null);
  const lastTop = useRef(0);
  const width = Math.max(0, ...services.map((s) => serviceName(s, project).length));

  const text = useMemo(() => {
    const q = filter.toLowerCase();
    return (lines ?? [])
      .filter((l) => (!only || l.service === only) && (!q || l.text.toLowerCase().includes(q)))
      .map((l) => `${only ? "" : serviceName(l.service, project).padEnd(width) + "  "}${clock(l.iso)}  ${l.text}`)
      .join("\n");
  }, [lines, only, filter, project, width]);

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [text, follow]);

  return (
    <div className="compose-logs">
      <div className="log-bar">
        {services.length > 1 && (
          <select aria-label={`Service to show for ${project}`} value={only} onChange={(e) => setOnly(e.target.value)}>
            <option value="">All services</option>
            {services.map((s) => <option key={s} value={s}>{serviceName(s, project)}</option>)}
          </select>
        )}
        <input className="filter" aria-label={`Filter ${project} log lines`} placeholder="Filter lines" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button className={follow ? "toggle on" : "toggle"} aria-pressed={follow} onClick={() => setFollow((f) => !f)}>
          {follow ? "Following new lines" : "Paused, click to follow"}
        </button>
        <button onClick={() => navigator.clipboard.writeText(text)} disabled={!text}><Icon name="copy" size={13} /> Copy</button>
      </div>
      <Banner error={error} />
      <pre
        ref={box}
        className="mono"
        tabIndex={0}
        aria-label={`Live logs of ${project}`}
        onScroll={(e) => {
          // Our own auto-scroll only moves down, so only an upward scroll means the user wants to read back.
          const el = e.currentTarget;
          const up = el.scrollTop < lastTop.current - 4;
          lastTop.current = el.scrollTop;
          if (up) setFollow(false);
          else if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) setFollow(true);
        }}
      >
        {text || (lines === null ? "Reading logs…" : filter || only ? "No lines match." : "No log lines yet.")}
      </pre>
    </div>
  );
}

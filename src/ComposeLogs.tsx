// A project's logs, live: the last 300 lines of each service, then every 2 seconds only what is new. Filter by
// service or text; scrolling up pauses following, scrolling back to the end resumes it.
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { usePoll } from "./hooks";
import { Banner } from "./ui";
import { Icon } from "./ui/icons";
import { ProjectLine, mergeProjectLogs, projectSince, serviceName } from "./lib/composeLogs";
import { useActivity } from "./Commands";

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

  // What you did to this project while its logs are open, marked in the stream at the time it happened.
  const { entries } = useActivity();
  const opened = useRef(Date.now());
  const marks = useMemo(
    () => entries.filter((e) => e.kind.startsWith("compose ") && e.what === project && e.ok !== null && e.at >= opened.current - 60_000).map((e) => ({ at: e.at, text: `${e.ok ? "" : "failed: "}${e.cmd.replace(/^.*compose /, "compose ")}` })),
    [entries, project],
  );

  const text = useMemo(() => {
    const q = filter.toLowerCase();
    const shown = (lines ?? []).filter((l) => (!only || l.service === only) && (!q || l.text.toLowerCase().includes(q)));
    const rows = shown.map((l) => ({ at: l.iso ? Date.parse(l.iso) : 0, text: `${only ? "" : serviceName(l.service, project).padEnd(width) + "  "}${clock(l.iso)}  ${l.text}` }));
    const marked = q ? [] : marks.map((m) => ({ at: m.at, text: `·· ${clock(new Date(m.at).toISOString())}  you ran ${m.text} ··` }));
    return [...rows, ...marked].sort((a, b) => a.at - b.at).map((r) => r.text).join("\n");
  }, [lines, only, filter, project, width, marks]);

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

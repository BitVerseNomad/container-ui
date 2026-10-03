import { useEffect, useMemo, useRef, useState } from "react";
import { docker } from "./api";
import { usePoll } from "./hooks";
import { Banner } from "./ui";

type Props = { ctx: string; id: string; name: string; onClose: () => void };

export default function Logs({ ctx, id, name, onClose }: Props) {
  const { data, error } = usePoll(() => docker(ctx, ["logs", "--tail", "1000", id], true), [ctx, id], 2000);
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  const box = useRef<HTMLPreElement>(null);

  const text = useMemo(() => {
    const lines = (data ?? "").split("\n");
    const q = filter.toLowerCase();
    return (q ? lines.filter((l) => l.toLowerCase().includes(q)) : lines).join("\n");
  }, [data, filter]);

  useEffect(() => {
    if (follow && box.current) box.current.scrollTop = box.current.scrollHeight;
  }, [text, follow]);

  return (
    <section className="logs-view">
      <header>
        <button onClick={onClose}>Back</button>
        <h2>{name}</h2>
        <input
          className="filter"
          placeholder="Filter lines"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="state">{follow ? "Following" : "Paused: scroll to the bottom to follow"}</span>
      </header>
      <Banner error={error} />
      <pre
        ref={box}
        className="logs"
        onScroll={(e) => {
          const el = e.currentTarget;
          setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24);
        }}
      >
        {text || (data === null ? "Loading…" : "No log output.")}
      </pre>
    </section>
  );
}

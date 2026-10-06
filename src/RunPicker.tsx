import { useState } from "react";
import Drawer from "./ui/Drawer";
import { dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Banner } from "./ui";
import { Icon } from "./ui/icons";

type I = { ID: string; Repository: string; Tag: string; Size: string };

export default function RunPicker({ ctx, onPick, onClose }: { ctx: string; onPick: (ref: string) => void; onClose: () => void }) {
  const { data, error } = usePoll(() => dockerJson<I>(ctx, ["images"]), [ctx], 8000);
  const [q, setQ] = useState("");
  const ref = (i: I) => (i.Repository === "<none>" ? i.ID : `${i.Repository}:${i.Tag}`);
  const rows = (data ?? []).filter((i) => ref(i).toLowerCase().includes(q.toLowerCase()));

  return (
    <Drawer label="Run image" title={<>Choose an image to run</>} onClose={onClose}>
        <label className="search-field">
          <Icon name="search" size={14} />
          <input autoFocus placeholder="Search your images" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Banner error={error} />
        {data && rows.length === 0 && <p className="hint">{data.length === 0 ? "No images yet. Pull one first." : "No image matches that search."}</p>}
        <ul className="hits">
          {rows.map((i) => (
            <li key={i.ID + ref(i)}>
              <button className="hit" onClick={() => onPick(ref(i))}>
                <span className="hit-name">{ref(i)}</span>
                <span className="hit-meta">{i.Size}</span>
              </button>
            </li>
          ))}
        </ul>
    </Drawer>
  );
}

import { useState } from "react";
import { formatBytes, parseBytes } from "./containerInfo";
import { dockerJson } from "./api";
import { usePoll } from "./hooks";
import { Sheet, Field, List, Row, Button } from "./ui/op";
import { Icon } from "./ui/icons";

type I = { ID: string; Repository: string; Tag: string; Size: string };

export default function RunPicker({ ctx, onPick, onClose }: { ctx: string; onPick: (ref: string) => void; onClose: () => void }) {
  const { data, error } = usePoll(() => dockerJson<I>(ctx, ["images"]), [ctx], 8000);
  const [q, setQ] = useState("");
  const ref = (i: I) => (i.Repository === "<none>" ? i.ID : `${i.Repository}:${i.Tag}`);
  const rows = (data ?? []).filter((i) => ref(i).toLowerCase().includes(q.toLowerCase()));

  const fill = (ref: string) => setQ(ref);

  return (
    <Sheet open={true} onClose={onClose} title="Choose an image to run">
      <Field icon="search" placeholder="nginx or postgres:16" value={q} onChange={(e) => setQ(e.target.value)} />
      {error && <p className="hint">{error}</p>}
      {data && rows.length === 0 && <p className="hint">{data.length === 0 ? "No images yet. Pull one first." : "No image matches that search."}</p>}
      <List aria-label="Images you have">
        {rows.map((i) => (
          <Row key={i.ID + ref(i)} lead={<Icon name="image" size={16} />} name={ref(i)} meta={parseBytes(i.Size) ? formatBytes(parseBytes(i.Size)) : i.Size} onOpen={() => fill(ref(i))} />
        ))}
      </List>
      <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="md" disabled={!q} onClick={() => onPick(q)}>Continue</Button>
    </Sheet>
  );
}

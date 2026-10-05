import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { dockerJson } from "./api";
import { Banner } from "./ui";
import OutputLog from "./ui/OutputLog";

type Hit = { Name: string; Description: string; StarCount: string; IsOfficial: string };
type Props = { ctx: string; onClose: () => void; onPulled: () => void; onRun: (image: string) => void };

export default function PullPanel({ ctx, onClose, onPulled, onRun }: Props) {
  const [image, setImage] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const name = image.trim();

  async function search() {
    const term = name.split(":")[0];
    if (!term || term.startsWith("-")) return;
    setSearching(true);
    setError(null);
    try {
      setHits(await dockerJson<Hit>(ctx, ["search", "--limit", "12", term]));
    } catch (e) {
      setError(String(e));
    } finally {
      setSearching(false);
    }
  }

  async function pull() {
    setPulling(true);
    setDone(null);
    setError(null);
    setFailure(null);
    try {
      await invoke("docker_pull", { context: ctx, image: name });
      setDone(name);
      onPulled();
    } catch (e) {
      setFailure(String(e));
    } finally {
      setPulling(false);
    }
  }

  return (
    <>
      <div className="scrim" onClick={() => !pulling && onClose()} />
      <div className="drawer" role="dialog" aria-label="Pull image">
        <div className="drawer-head">
          <h3>Pull image</h3>
          <button disabled={pulling} onClick={onClose}>Close</button>
        </div>

        <label>
          Image
          <span className="inline">
            <input
              autoFocus
              value={image}
              placeholder="nginx or postgres:16"
              onChange={(e) => setImage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <button disabled={!name || searching || pulling} onClick={search}>
              {searching ? "Searching…" : "Search"}
            </button>
          </span>
        </label>
        <p className="hint">Search Docker Hub, pick a result, then pull. With no tag, Docker pulls <code>latest</code>.</p>

        <div className="chips">
          <span className="hint">Or try one:</span>
          {["hello-world", "nginx", "mysql", "postgres", "redis"].map((n) => (
            <button key={n} className="chip" disabled={pulling} onClick={() => setImage(n)}>{n}</button>
          ))}
        </div>

        {hits && hits.length === 0 && <p className="hint">No images found on Docker Hub for that name.</p>}
        {hits && hits.length > 0 && (
          <ul className="hits">
            {hits.map((h) => (
              <li key={h.Name}>
                <button className="hit" disabled={pulling} aria-selected={h.Name === name} onClick={() => setImage(h.Name)}>
                  <span className="hit-name">
                    {h.Name}
                    {h.IsOfficial === "true" && <span className="tag">Official</span>}
                  </span>
                  <span className="hit-meta">{Number(h.StarCount).toLocaleString()} stars</span>
                  <span className="hit-desc">{h.Description || "No description"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="actions">
          <button className="primary" disabled={!name || pulling} onClick={pull}>
            {pulling ? "Pulling…" : name ? `Pull ${name}` : "Pull"}
          </button>
        </div>

        <Banner error={error} />
        {done && (
          <>
            <p className="ok">Pulled {done}. It's in your image list now.</p>
            <button className="primary" onClick={() => onRun(done)}>Run {done}</button>
          </>
        )}
        <OutputLog event="pull-progress" active={pulling} failure={failure} />
      </div>
    </>
  );
}

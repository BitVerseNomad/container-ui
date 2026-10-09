import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { dockerJson } from "./api";
import { Hit, SortKey, isOfficial, sortHits } from "./lib/hub";
import { Banner } from "./ui";
import Drawer from "./ui/Drawer";
import OutputLog from "./ui/OutputLog";

type Props = { ctx: string; onClose: () => void; onPulled: () => void; onRun: (image: string) => void };

export default function PullPanel({ ctx, onClose, onPulled, onRun }: Props) {
  const [term, setTerm] = useState("");
  const [image, setImage] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [sort, setSort] = useState<SortKey>("stars");
  const [searching, setSearching] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const name = image.trim();
  const query = term.trim();

  async function search() {
    if (!query || query.startsWith("-")) return;
    setSearching(true);
    setError(null);
    try {
      setHits(await dockerJson<Hit>(ctx, ["search", "--limit", "25", query]));
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

  const shown = hits ? sortHits(hits, sort) : [];

  return (
    <Drawer label="Pull image" title={<>Pull image</>} onClose={onClose} closeDisabled={pulling}>
      <div className="group">
        <h4>1. Find an image <span className="optional">(optional)</span></h4>
        <p className="hint">Searching only lists what's on Docker Hub. Nothing is downloaded.</p>
        <span className="inline">
          <input
            aria-label="Search Docker Hub"
            value={term}
            placeholder="Search Docker Hub, like redis"
            disabled={pulling}
            onChange={(e) => setTerm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
          />
          <button disabled={!query || searching || pulling} onClick={search}>{searching ? "Searching…" : "Search"}</button>
        </span>

        {hits && hits.length === 0 && <p className="hint">Nothing found on Docker Hub for "{query}".</p>}
        {hits && hits.length > 0 && (
          <>
            <div className="sortbar">
              <span className="hint">{hits.length} result{hits.length > 1 ? "s" : ""}. Choose one to fill in step 2.</span>
              <label className="sort">
                Sort by
                <select aria-label="Sort by" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  <option value="stars">Stars (most first)</option>
                  <option value="name">Name (A to Z)</option>
                  <option value="official">Official first</option>
                </select>
              </label>
            </div>
            <ul className="hits">
              {shown.map((h) => (
                <li key={h.Name}>
                  <button className="hit" disabled={pulling} aria-selected={h.Name === name} onClick={() => setImage(h.Name)}>
                    <span className="hit-name">
                      {h.Name}
                      {isOfficial(h.IsOfficial) && <span className="tag">Official</span>}
                    </span>
                    <span className="hit-meta">{Number(h.StarCount).toLocaleString()} stars</span>
                    <span className="hit-desc">{h.Description || "No description"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="group">
        <h4>2. Pull</h4>
        <p className="hint">Downloads the image named here. Add a version after a colon, like <code>nginx:1.27</code>; with none you get <code>latest</code>.</p>
        <input aria-label="Image to pull" value={image} placeholder="nginx or postgres:16" disabled={pulling} onChange={(e) => setImage(e.target.value)} />
        <div className="chips">
          <span className="hint">Or try one:</span>
          {["hello-world", "nginx", "mysql", "postgres", "redis"].map((n) => (
            <button key={n} className="chip" disabled={pulling} onClick={() => setImage(n)}>{n}</button>
          ))}
        </div>
        <div className="actions">
          <button className="primary" disabled={!name || pulling} onClick={pull}>
            {pulling ? "Pulling…" : name ? `Pull ${name}` : "Pull"}
          </button>
        </div>
      </div>

      <Banner error={error} />
      {done && (
        <>
          <p className="ok">Pulled {done}. It's in your image list now.</p>
          <button className="primary" onClick={() => onRun(done)}>Run {done}</button>
        </>
      )}
      <OutputLog event="pull-progress" active={pulling} failure={failure} />
    </Drawer>
  );
}

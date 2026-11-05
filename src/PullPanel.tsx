import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { dockerJson } from "./api";
import { Hit, SortKey, isOfficial, sortHits } from "./lib/hub";
import { PRESETS, checkRef, isAuthError, loginCommand, needsLogin, presetFor } from "./lib/registry";
import { Banner } from "./ui";
import Drawer from "./ui/Drawer";
import { Icon } from "./ui/icons";
import OutputLog from "./ui/OutputLog";
import { notePullFailure, notePullOk } from "./lib/netEvidence";

// `searchFor` opens the panel already searching Docker Hub, for a name the user typed elsewhere.
type Props = { ctx: string; onClose: () => void; onPulled: () => void; onRun: (image: string) => void; searchFor?: string };

type Mode = "hub" | "private";

export default function PullPanel({ ctx, onClose, onPulled, onRun, searchFor }: Props) {
  const [mode, setMode] = useState<Mode>("hub");
  const [host, setHost] = useState("");
  const [path, setPath] = useState("");
  const [tag, setTag] = useState("latest");
  const [term, setTerm] = useState(searchFor ?? "");
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
  const priv = mode === "private";
  const refCheck = checkRef({ host, path, tag });
  const preset = presetFor(host);
  const login = loginCommand(host);
  const authHint = priv && failure !== null && isAuthError(failure);
  const target = priv ? (refCheck.ok ? refCheck.ref : "") : name;

  useEffect(() => {
    if (searchFor?.trim()) void search();
    // Once, on open: later edits search when the user asks.
  }, []);

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

  function switchMode(m: Mode) {
    setMode(m);
    setDone(null);
    setError(null);
    setFailure(null);
  }

  async function pull() {
    if (!target) return;
    setPulling(true);
    setDone(null);
    setError(null);
    setFailure(null);
    try {
      await invoke("docker_pull", { context: ctx, image: target });
      notePullOk();
      setDone(target);
      onPulled();
    } catch (e) {
      notePullFailure(String(e));
      setFailure(String(e));
    } finally {
      setPulling(false);
    }
  }

  const shown = hits ? sortHits(hits, sort) : [];

  return (
    <Drawer label="Pull image" title={<>Pull image</>} onClose={onClose} closeDisabled={pulling}>
      <div className="seg" role="group" aria-label="Where to pull from">
        <button aria-pressed={!priv} disabled={pulling} onClick={() => switchMode("hub")}>Docker Hub</button>
        <button aria-pressed={priv} disabled={pulling} onClick={() => switchMode("private")}>Other registry</button>
      </div>

      {priv && (
        <div className="group">
          <div className="chips">
            <span className="hint">Registry:</span>
            {PRESETS.map((p) => (
              <button key={p.id} className="chip" aria-pressed={preset?.id === p.id} disabled={pulling} onClick={() => setHost(p.host)}>{p.label}</button>
            ))}
          </div>
          <label className="reg-field">
            Registry host
            <input aria-label="Registry host" value={host} placeholder="ghcr.io, or your own like harbor.example.com" disabled={pulling} onChange={(e) => setHost(e.target.value)} />
          </label>
          <label className="reg-field">
            Image path
            <input aria-label="Image path" value={path} placeholder={preset?.pathExample ?? "acme/api"} disabled={pulling} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => e.key === "Enter" && target && !pulling && pull()} />
          </label>
          <label className="reg-field">
            Tag
            <input aria-label="Tag" value={tag} placeholder="latest" disabled={pulling} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && target && !pulling && pull()} />
          </label>
          {refCheck.ok ? (
            <p className="hint">Will pull <code>{refCheck.ref}</code></p>
          ) : (
            (host.trim() || path.trim()) && <p className="hint">{refCheck.reason}</p>
          )}
          {!authHint && needsLogin(host) && (
            <div className="login-hint">
              <p className="hint">Private images need you to sign in first. Run this in Terminal:</p>
              <pre className="cmd">{login ?? "docker login <registry>"}</pre>
              <button disabled={!login} onClick={() => login && navigator.clipboard.writeText(login)}><Icon name="copy" size={14} /> Copy command</button>
            </div>
          )}
          <button className="primary" disabled={!target || pulling} onClick={pull}>
            {pulling ? "Pulling…" : target ? `Pull ${target}` : "Pull"}
          </button>
        </div>
      )}

      {authHint && (
        <div className="problem-line bad start-why" role="alert">
          <b><Icon name="alert" size={14} /> Sign in to {host.trim()} first</b>
          <span className="hint">The registry refused the pull. Run this in Terminal, then try again:</span>
          <pre className="cmd">{login ?? `docker login ${host.trim()}`}</pre>
          <span className="actions-inline">
            <button disabled={!login} onClick={() => login && navigator.clipboard.writeText(login)}><Icon name="copy" size={14} /> Copy command</button>
          </span>
        </div>
      )}

      {!priv && (<>
      <div className="group">
        <h4>Image</h4>
        <span className="inline">
          <input aria-label="Image to pull" value={image} placeholder={!image ? "nginx or postgres:16" : undefined} disabled={pulling} onChange={(e) => setImage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name && !pulling && pull()} />
          <button className="primary" disabled={!name || pulling} onClick={pull}>
            {pulling ? "Pulling…" : name ? `Pull ${name}` : "Pull"}
          </button>
        </span>
        <p className="hint">Add a version after a colon, like <code>nginx:1.27</code>; with none you get <code>latest</code>.</p>
        <div className="chips">
          <span className="hint">Or try one:</span>
          {["hello-world", "nginx", "mysql", "postgres", "redis"].map((n) => (
            <button key={n} className="chip" disabled={pulling} onClick={() => setImage(n)}>{n}</button>
          ))}
        </div>
      </div>

      <div className="group">
        <h4>Not sure of the name? Search Docker Hub</h4>
        <p className="hint">Searching only lists images. Nothing is downloaded.</p>
        <span className="inline">
          <input
            aria-label="Search Docker Hub"
            value={term}
            placeholder={!term ? "Search Docker Hub, like redis" : undefined}
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
              <span className="hint">{hits.length} result{hits.length > 1 ? "s" : ""}. Choose one to fill in the image above.</span>
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

      </>)}

      <Banner error={error} />
      {done && (
        <>
          <p className="ok">Pulled {done}. It's in your image list now.</p>
          <button className="primary" onClick={() => onRun(done)}>Run {done}</button>
        </>
      )}
      <OutputLog event="pull-progress" active={pulling} failure={authHint ? null : failure} collapsed={authHint} />
    </Drawer>
  );
}

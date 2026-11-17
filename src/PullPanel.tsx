import { invoke } from "@tauri-apps/api/core";
import { dockerJson } from "./api";
import { Hit, SortKey, isOfficial, sortHits } from "./lib/hub";
import { PRESETS, checkRef, isAuthError, loginCommand, needsLogin, presetFor } from "./lib/registry";
import { Banner, Button, Sheet, Field, Fields, FormRow, ChipButton, Canvas, Command, Row, Col, Menu, MenuItem, MenuSeparator, Inspector, Select } from "./ui/op";
import { useFixRuns } from "./FixIt";
import { useBringBusy } from "./bringBusy";
import { useDockerLocked } from "./dockerLock";
import { useConfirm, useToast } from "./ui/op";
import { useState, useEffect } from "react";
import { Icon } from "./ui/op";

type Props = { ctx: string; onClose: () => void; onPulled: () => void; onRun: (image: string) => void; searchFor?: string };

type Mode = "hub" | "private";

type HitRow = { Name: string; Description: string; StarCount: string; IsOfficial: string };

export default function PullPanel({ ctx, onClose, onPulled, onRun, searchFor }: Props) {
  const confirm = useConfirm();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("hub");
  const [host, setHost] = useState("");
  const [path, setPath] = useState("");
  const [tag, setTag] = useState("latest");
  const [term, setTerm] = useState(searchFor ?? "");
  const [image, setImage] = useState("");
  const [hits, setHits] = useState<HitRow[] | null>(null);
  const [sort, setSort] = useState<SortKey>("stars");
  const [searching, setSearching] = useState(false);
  const [pulling, setPulling] = useState(false);
  const copyBusy = useBringBusy();
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
  }, []);

  async function search() {
    if (!query || query.startsWith("-")) return;
    setSearching(true);
    setError(null);
    try {
      setHits(await dockerJson<HitRow>(ctx, ["search", "--limit", "25", query]));
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
      setDone(target);
      onPulled();
    } catch (e) {
      const msg = String(e);
      setFailure(msg);
    } finally {
      setPulling(false);
    }
  }

  const shown = hits ? sortHits(hits as HitRow[], sort) : [];

  const hubItems = (
    <>
      <div className="group">
        <FormRow label="Image to pull" htmlFor="image-to-pull">
          <Field id="image-to-pull" width="search" placeholder="nginx or postgres:16" disabled={copyBusy} onChange={(e) => setImage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name && !pulling) { pull(); } }} />
        </FormRow>
        <p className="hint">Add a version after a colon, like <code>nginx:1.27</code>; with none you get <code>latest</code>.</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="hint">Or try one:</span>
          {["hello-world", "nginx", "mysql", "postgres", "redis"].map((n) => (
            <Button key={n} className="rounded-full border border-line bg-tile px-2.5 py-0.5 text-meta text-fg-muted hover:bg-tile-hover" disabled={pulling} onClick={() => setImage(n)}>{n}</Button>
          ))}
        </div>
      </div>
      <div className="group">
        <h4>Not sure of the name? Search Docker Hub</h4>
        <p className="hint">Searching only lists images. Nothing is downloaded.</p>
        <Field id="search-docker-hub-2" width="search" value={term} onChange={(e) => setTerm(e.target.value)} disabled={searching || pulling} />
        <Button disabled={!query || searching || pulling} onClick={search}>{searching ? "Searching…" : "Search"}</Button>
        {hits && hits.length === 0 && <p className="hint">Nothing found on Docker Hub for "{query}".</p>}
        {hits && hits.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-meta">
              <span className="hint">{hits.length} result{hits.length > 1 ? "s" : ""}. Choose one to fill in the image above.</span>
              <label className="flex items-center gap-1.5 text-meta text-fg-muted">
                Sort by
                <Select aria-label="Sort by" value={sort} onChange={(value: string) => setSort(value as SortKey)} options={[
                  { value: "stars", label: "Stars (most first)" },
                  { value: "name", label: "Name (A to Z)" },
                  { value: "official", label: "Official first" },
                ]} />
              </label>
            </div>
            <div className="list">
              {shown.map((h) => (
                <Row key={h.Name} lead={<Icon name="image" size="md" />} name={h.Name} meta={h.Description || "No description"} selected={h.Name === name} onOpen={() => setImage(h.Name)} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );

  const privItems = (
    <>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <ChipButton key={p.id} icon={preset?.id === p.id ? "chev-down" : "chev-right"} pressed={preset?.id === p.id} disabled={pulling} onClick={() => setHost(p.host)}>{p.label}</ChipButton>
        ))}
      </div>
      {(host.trim() || path.trim()) && (
        <>
          {refCheck.ok ? (
            <p className="hint">Will pull <code>{refCheck.ref}</code></p>
          ) : (
            <p className="hint">{refCheck.reason}</p>
          )}
          {!authHint && needsLogin(host) && (
            <div className="text-meta text-fg-muted">
              <p className="hint">Private images need you to sign in first. Run this in Terminal:</p>
              <pre className="cmd">{login ?? `docker login ${host.trim()}`}</pre>
              <Button disabled={!login} onClick={() => login && navigator.clipboard.writeText(login)} icon="copy">Copy command</Button>
            </div>
          )}
        </>
      )}
      <Button variant="primary" size="md" disabled={!target || pulling} onClick={pull}>
        {pulling ? "Pulling…" : target ? `Pull ${target}` : "Pull"}
      </Button>
    </>
  );

  return (
    <Sheet open={true} onClose={onClose} title="Pull an image">
      <Fields>
        <Field id="search-docker-hub" width="search" value={term} onChange={(e) => setTerm(e.target.value)} disabled={searching || pulling} />
      </Fields>
      <p className="hint">Searching only lists images. Nothing is downloaded.</p>
      <div className="list">
        {shown.map((h) => (
          <Row key={h.Name} lead={<Icon name="image" size="md" />} name={h.Name} meta={h.Description || "No description"} selected={h.Name === name} onOpen={() => setImage(h.Name)} />
        ))}
      </div>
      <Fields>
        <Field id="registry-host" width="search" value={host} onChange={(e) => setHost(e.target.value)} disabled={copyBusy} />
        <Field id="image-path" width="search" value={path} onChange={(e) => setPath(e.target.value)} disabled={copyBusy} />
        <Field id="tag" width="port" value={tag} onChange={(e) => setTag(e.target.value)} disabled={copyBusy} />
      </Fields>
      <ChipButton icon="chev-right" pressed={mode === "hub"} onClick={() => switchMode("hub")}>Docker Hub</ChipButton>
      <ChipButton icon="chev-right" pressed={mode === "private"} onClick={() => switchMode("private")}>Other registry</ChipButton>
      {priv && privItems}
      {!priv && hubItems}
      {copyBusy && <p className="hint">Pulling the image. This may take a while.</p>}
      {done && (
        <>
          <Banner tone="info" title="Pulled {done}"><span>Pulled {done}</span></Banner>
          <Button variant="primary" size="md" onClick={() => { onRun(done); onClose(); }}>Run {done}</Button>
        </>
      )}
      <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="md" disabled={pulling || !target} onClick={pull}>{pulling ? "Pulling…" : target ? `Pull ${target}` : "Pull"}</Button>
    </Sheet>
  );
}
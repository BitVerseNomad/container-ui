import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { dockerJson } from "./api";
import { pullProgress } from "./lib/pullProgress";
import { Hit, SortKey, isOfficial, sortHits } from "./lib/hub";
import { PRESETS, checkRef, isAuthError, loginCommand, needsLogin, presetFor } from "./lib/registry";
import { useBringBusy } from "./bringBusy";
import { Banner, Button, Canvas, Chip, ChipButton, Col, Command, Field, FormRow, Icon, List, Progress, Row, Sev, Sheet } from "./ui/op";

type Props = { ctx: string; onClose: () => void; onPulled: () => void; onRun: (image: string) => void; searchFor?: string };

type Mode = "hub" | "private";

const SUGGESTIONS = ["hello-world", "nginx", "mysql", "postgres", "redis"];

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
  const [lines, setLines] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [showOutput, setShowOutput] = useState(false);
  const copyBusy = useBringBusy();

  const name = image.trim();
  const query = term.trim();
  const priv = mode === "private";
  const refCheck = checkRef({ host, path, tag });
  const preset = presetFor(host);
  const login = loginCommand(host);
  const authFailure = priv && failure !== null && isAuthError(failure);
  const target = priv ? (refCheck.ok ? refCheck.ref : "") : name;
  const progress = pullProgress(lines);
  const shown = hits ? sortHits(hits, sort) : [];
  const idle = !pulling && !copyBusy;

  useEffect(() => {
    if (searchFor?.trim()) void search();
  }, []);

  async function search() {
    if (!query || query.startsWith("-")) return;
    setSearching(true);
    setSearchError(null);
    try {
      setHits(await dockerJson<Hit>(ctx, ["search", "--limit", "25", query]));
    } catch (e) {
      setSearchError(String(e));
    } finally {
      setSearching(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setDone(null);
    setFailure(null);
    setShowOutput(false);
  }

  async function pull() {
    if (!target) return;
    setPulling(true);
    setLines([]);
    setDone(null);
    setFailure(null);
    setShowOutput(false);
    const stopListening = await listen<string>("pull-progress", (event) => setLines((all) => [...all, event.payload])).catch(() => null);
    try {
      await invoke("docker_pull", { context: ctx, image: target });
      setDone(target);
      onPulled();
    } catch (e) {
      setFailure(String(e));
    } finally {
      stopListening?.();
      setPulling(false);
    }
  }

  const sheetFoot = (
    <>
      <Button variant="ghost" size="md" onClick={onClose}>Cancel</Button>
      <Button variant="primary" size="md" disabled={!target || pulling} onClick={pull}>
        {pulling ? "Pulling…" : target ? `Pull ${target}` : "Pull"}
      </Button>
    </>
  );

  return (
    <Sheet open={true} onClose={onClose} title="Pull an image" busy={pulling} footer={sheetFoot}>
      <div className="flex gap-1.5">
        <ChipButton icon="search" pressed={!priv} onClick={() => switchMode("hub")}>Docker Hub</ChipButton>
        <ChipButton icon="chev-right" pressed={priv} onClick={() => switchMode("private")}>Other registry</ChipButton>
      </div>

      {!priv && (
        <>
          <FormRow label="Image to pull" htmlFor="image-to-pull">
            <Field id="image-to-pull" width="search" placeholder="nginx or postgres:16" value={image} disabled={copyBusy || pulling} onChange={(e) => setImage(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && name && idle) void pull(); }} />
          </FormRow>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((n) => (
              <ChipButton key={n} disabled={pulling} onClick={() => setImage(n)}>{n}</ChipButton>
            ))}
          </div>

          <FormRow label="Search Docker Hub" htmlFor="search-docker-hub">
            <Field id="search-docker-hub" aria-label="Search Docker Hub" icon="search" width="search" value={term} disabled={searching || pulling} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void search(); }} />
          </FormRow>
          <p className="hint">Searching downloads nothing. It only lists images; nothing is downloaded until you pull.</p>
          <Button disabled={!query || searching || pulling} onClick={search}>{searching ? "Searching…" : "Search"}</Button>
          {searchError && <Banner tone="bad" title="Docker Hub search failed">{searchError}</Banner>}
          {hits && hits.length === 0 && <p className="hint">Nothing found on Docker Hub for "{query}".</p>}
          {shown.length > 0 && (
            <>
              <div className="flex items-center gap-1.5">
                <ChipButton pressed={sort === "stars"} onClick={() => setSort("stars")}>Most stars</ChipButton>
                <ChipButton pressed={sort === "name"} onClick={() => setSort("name")}>Name</ChipButton>
              </div>
              <List aria-label="Search results">
                {shown.map((h) => (
                  <Row key={h.Name} lead={<Icon name="image" size="md" />} name={h.Name} meta={h.Description || "No description"} selected={h.Name === name} onOpen={() => setImage(h.Name)}>
                    <Col>{isOfficial(h.IsOfficial) && <Chip>Official</Chip>}</Col>
                    <Col>{h.StarCount} stars</Col>
                  </Row>
                ))}
              </List>
            </>
          )}
        </>
      )}

      {priv && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <ChipButton key={p.id} pressed={preset?.id === p.id} disabled={pulling} onClick={() => setHost(p.host)}>{p.label}</ChipButton>
            ))}
          </div>
          <FormRow label="Registry host" htmlFor="registry-host">
            <Field id="registry-host" width="search" placeholder="ghcr.io" value={host} disabled={copyBusy || pulling} onChange={(e) => setHost(e.target.value)} />
          </FormRow>
          <FormRow label="Image path" htmlFor="image-path">
            <Field id="image-path" width="search" placeholder="acme/api" value={path} disabled={copyBusy || pulling} onChange={(e) => setPath(e.target.value)} />
          </FormRow>
          <FormRow label="Tag" htmlFor="image-tag">
            <Field id="image-tag" width="port" value={tag} disabled={copyBusy || pulling} onChange={(e) => setTag(e.target.value)} />
          </FormRow>
          {refCheck.ok ? <p className="hint">Will pull <code>{refCheck.ref}</code></p> : (host.trim() || path.trim()) && <p className="hint">{refCheck.reason}</p>}
          <p className="hint">Private images need you to sign in first, with docker login in Terminal.</p>
          {!authFailure && <Command text={login ?? `docker login ${host.trim() || "<registry>"}`} />}
          {!needsLogin(host) && <p className="hint">The public ECR gallery needs no sign-in.</p>}
        </>
      )}

      {(pulling || lines.length > 0) && (
        <div>
          <Progress value={progress.total ? progress.done : null} max={progress.total} aria-label="Pull progress" />
          <div className="hint">{progress.done} of {progress.total}</div>
        </div>
      )}

      {done && (
        <>
          <p className="hint"><Sev level="ok" /> Pulled {done}</p>
          <Button onClick={() => { onRun(done); onClose(); }}>Run {done}</Button>
        </>
      )}

      {failure && (
        <Banner tone="bad" title={authFailure && login !== null ? `Sign in to ${host.trim()} first` : "The pull did not finish"}>
          {authFailure && login !== null ? <Command text={login} /> : <span>Check the name and try again.</span>}
          <Button variant="ghost" size="xs" aria-expanded={showOutput} onClick={() => setShowOutput((open) => !open)}>Show output</Button>
          {showOutput && <Canvas aria-label="Pull output" lines={[...lines, failure].map((text) => ({ text }))} />}
        </Banner>
      )}
    </Sheet>
  );
}

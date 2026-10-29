import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Profile, ctxFor, docker, dockerJson, openUrl } from "./api";
import { formatBytes } from "./containerInfo";
import { Item, Outcome, defaultPick, diskFull, doneText, fits, inventory, key, nearlyEmpty, order, picked, plainError, toStop, whatText } from "./lib/bringOver";
import { parseDiskUsage } from "./lib/disk";
import { markBroughtOver } from "./Setup";
import { useConfirm } from "./ui";
import Drawer from "./ui/Drawer";
import Ticks, { plain } from "./ui/Ticks";
import { Icon } from "./ui/icons";

type DesktopState = { installed: boolean; running: boolean; disk_bytes: number };
type Props = { ctx: string; onClose: () => void; onDone: () => void; onProfiles: () => void };
type Row = { state: "waiting" | "copying" | "done" | "failed"; bytes: number; why?: string };

const DOWNLOAD = "https://www.docker.com/products/docker-desktop/";
const DF = ["system", "df", "-v", "--format", "json"];

// Copies Docker Desktop's volumes and images into Colima, one at a time. Docker Desktop keeps its copy, and
// nothing Colima already has is touched.
export default function BringOver({ ctx, onClose, onDone, onProfiles }: Props) {
  const confirm = useConfirm();
  const [desktop, setDesktop] = useState<DesktopState | null>(null);
  const [items, setItems] = useState<Item[] | null>(null);
  const [unnamed, setUnnamed] = useState(0);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<Map<string, Row>>(new Map());
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  // halted: Docker Desktop containers the copy stopped, so the line can say so and start them again.
  const [result, setResult] = useState<{ text: string; failed: Outcome[]; halted: string[] } | null>(null);
  const [free, setFree] = useState<number | null>(null);
  const [restarting, setRestarting] = useState(false);
  const ids = { result: useId(), hint: useId() };
  const [error, setError] = useState<string | null>(null);
  // Read by screen readers as it happens: what is being copied, and each failure the moment it fails.
  const [said, setSaid] = useState("");
  const [alarm, setAlarm] = useState("");
  const stopped = useRef(false);
  const current = useRef<string | null>(null);
  // The one action button stays mounted while its label changes (Bring, Stop, Done), so focus never falls out of the panel.
  const action = useRef<HTMLButtonElement>(null);
  const firstHeading = useRef<HTMLHeadingElement>(null);

  async function check() {
    setError(null);
    try {
      const s = await invoke<DesktopState>("desktop_state");
      setDesktop(s);
      if (s.running && ctx) await read();
      return s.running;
    } catch (e) {
      setError(String(e));
      return false;
    }
  }

  async function read() {
    setSaid("Reading Docker Desktop…");
    const [desktopDf, desktopImages, desktopRunning, colimaDf, have] = await Promise.all([
      invoke<string>("desktop_docker", { args: DF }),
      invoke<string>("desktop_docker", { args: ["images", "--format", "json"] }),
      invoke<string>("desktop_docker", { args: ["ps", "--filter", "status=running", "--format", "json"] }).catch(() => ""),
      docker(ctx, DF).catch(() => ""),
      dockerJson<{ Repository: string; Tag: string }>(ctx, ["images"]),
    ]);
    // The VM's disk minus what Docker uses: an estimate, but enough to warn before a long copy fails.
    const [profiles, df] = await Promise.all([invoke<Profile[]>("list_profiles").catch(() => []), docker(ctx, ["system", "df", "--format", "{{json .}}"]).catch(() => "")]);
    const disk = profiles.find((p) => ctxFor(p.name) === ctx)?.disk;
    const used = parseDiskUsage(df).reduce((n, r) => n + (r.size ?? 0), 0);
    setFree(disk && df ? Math.max(0, disk - used) : null);
    const inv = inventory({ desktopDf, desktopImages, desktopRunning, colimaDf, colimaImages: have.map((i) => `${i.Repository}:${i.Tag}`) });
    setItems(inv.items);
    setUnnamed(inv.unnamed);
    setPick(defaultPick(inv.items));
    setSaid(`Docker Desktop has ${inv.items.length} volumes and images.`);
  }

  useEffect(() => {
    void check();
    const off = listen<{ name: string; bytes: number }>("desktop-progress", (e) => {
      const at = current.current;
      if (at && at.endsWith(`:${e.payload.name}`)) setRows((m) => new Map(m).set(at, { state: "copying", bytes: e.payload.bytes }));
    });
    return () => void off.then((f) => f());
  }, []);

  // Docker Desktop takes a while to start; look again every 2 seconds for up to 2 minutes.
  async function openDesktop() {
    setOpening(true);
    setSaid("Waiting for Docker Desktop. This can take a minute.");
    try {
      await invoke("open_docker_desktop");
      let up = false;
      for (let i = 0; i < 60 && !(up = await check()); i++) await new Promise((r) => setTimeout(r, 2000));
      // The button that had focus is gone; the list's first heading takes it.
      if (up) setTimeout(() => firstHeading.current?.focus(), 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setOpening(false);
    }
  }

  async function bring() {
    const todo = order(picked(items ?? [], pick));
    const stopping = toStop(todo);
    if (stopping.length) {
      const who = stopping.join(" and ");
      const ok = await confirm(`Stop ${who} in Docker Desktop?\nThey write to the volumes being copied, and a database copied while it runs may not start. You can start them again in Docker Desktop after.`, "Stop and bring over", { safe: true });
      if (!ok) return;
    }
    stopped.current = false;
    await invoke("desktop_copy_stop", { stop: false });
    setBusy(true);
    setResult(null);
    setAlarm("");
    setRows(new Map(todo.map((i) => [key(i), { state: "waiting", bytes: 0 }])));
    const outcomes: Outcome[] = [];
    const tried: Item[] = [];
    for (const item of todo) {
      if (stopped.current) break;
      tried.push(item);
      current.current = key(item);
      setSaid(`Copying ${item.name}`);
      setRows((m) => new Map(m).set(key(item), { state: "copying", bytes: 0 }));
      try {
        const bytes = await invoke<number>("desktop_copy", { kind: item.kind, name: item.name, context: ctx, stopUsers: item.users.length > 0 });
        outcomes.push({ item, ok: true, bytes });
        setRows((m) => new Map(m).set(key(item), { state: "done", bytes }));
      } catch (e) {
        const why = String(e);
        if (stopped.current) {
          setRows((m) => new Map(m).set(key(item), { state: "waiting", bytes: 0 }));
          break;
        }
        outcomes.push({ item, ok: false, why });
        setRows((m) => new Map(m).set(key(item), { state: "failed", bytes: 0, why }));
        setAlarm(`${item.name} failed: ${plainError(why)}`);
      }
    }
    current.current = null;
    const failed = outcomes.filter((o) => !o.ok);
    const halted = toStop(tried);
    const text = `${doneText(outcomes, stopped.current)}${halted.length ? ` ${halted.map((n) => `\`${n}\``).join(" and ")} ${halted.length === 1 ? "is" : "are"} stopped in Docker Desktop.` : ""}`;
    // Read the lists again before showing the end, so the button never flashes the old picks.
    await read().catch(() => {});
    setBusy(false);
    setResult({ text, failed, halted });
    // A failure is announced at once; a success is read with the button that now has focus, so it is heard once.
    if (failed.length) setAlarm(plain(text));
    setSaid("");
    if (outcomes.some((o) => o.ok)) markBroughtOver();
    onDone();
    setTimeout(() => action.current?.focus(), 0);
  }

  async function startAgain(names: string[]) {
    setRestarting(true);
    try {
      await invoke("desktop_start", { names });
      // The button that had focus goes away; focus returns to the action button and the change is said.
      setSaid(`${names.join(" and ")} ${names.length === 1 ? "is" : "are"} running again in Docker Desktop.`);
      setTimeout(() => action.current?.focus(), 0);
      setResult((r) => r && { ...r, text: r.text.replace(/ `[^.]*` (is|are) stopped in Docker Desktop\./, ` ${names.join(" and ")} ${names.length === 1 ? "is" : "are"} running again in Docker Desktop.`), halted: [] });
    } catch (e) {
      setAlarm(`${names.join(" and ")} didn't start: ${String(e).split("\n")[0]}`);
      setResult((r) => r && { ...r, text: `${r.text} ${names.join(" and ")} didn't start: ${String(e).split("\n")[0]}` });
    } finally {
      setRestarting(false);
    }
  }

  async function stop() {
    stopped.current = true;
    await invoke("desktop_copy_stop", { stop: true });
  }

  const toggle = (i: Item) => setPick((s) => { const n = new Set(s); n.has(key(i)) ? n.delete(key(i)) : n.add(key(i)); return n; });
  const chosen = picked(items ?? [], pick);
  const total = chosen.reduce((n, i) => n + i.bytes, 0);
  const vols = (items ?? []).filter((i) => i.kind === "volume");
  const imgs = (items ?? []).filter((i) => i.kind === "image");
  const full = result?.failed.some((o) => !o.ok && diskFull(o.why));
  const tight = !fits(total, free);
  // The picks are exactly what just failed: the button says it is a retry.
  const retry = !!result?.failed.length && chosen.length > 0 && chosen.every((i) => result.failed.some((o) => key(o.item) === key(i)));

  const line = (i: Item) => {
    const r = rows.get(key(i));
    const settled = i.inColima || r?.state === "done";
    const status = r?.state === "copying" ? `${formatBytes(r.bytes)} of about ${formatBytes(i.bytes)}`
      : r?.state === "done" ? "Copied"
      : r?.state === "failed" ? "Failed"
      : r?.state === "waiting" && busy ? "Waiting"
      : i.inColima ? "Already in Colima" : formatBytes(i.bytes);
    const pct = r ? Math.min(99, Math.round((r.bytes / (i.bytes || 1)) * 100)) : 0;
    // Checkboxes only while the user is picking. During a run: a spinner on the one copying, a ring on those waiting;
    // a row that is across gets a tick, never a ticked box that reads as "will copy".
    const mark = settled ? <Icon name="check" size={13} />
      : r?.state === "copying" ? <span className="spin" />
      : r?.state === "waiting" && busy ? <span className="dot off" />
      : null;
    const Line = settled || (busy && r) ? "span" : "label";
    return (
      <li key={key(i)} className={`bring-item${r ? ` ${r.state}` : ""}${settled ? " settled" : ""}`}>
        <Line className="check">
          <span className="bring-mark mark">{mark ?? <input type="checkbox" checked={pick.has(key(i))} disabled={busy} onChange={() => toggle(i)} />}</span>
          <span className="bring-name" title={i.name}>{i.name}</span>
          <span className="hint bring-size">{r?.state === "failed" && <Icon name="close" size={12} />} {status}</span>
        </Line>
        {r?.state === "copying" && <div className="bar" role="progressbar" aria-label={`Copying ${i.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={status}><i style={{ width: `${pct}%` }} /></div>}
        {/* Docker's own words stay in the code font; a message the app wrote does not. */}
        {r?.state === "failed" && <p className={`hint bring-why${plainError(r.why ?? "") === (r.why ?? "").split("\n")[0] ? " raw" : ""}`}>{plainError(r.why ?? "")}</p>}
        {nearlyEmpty(i) && !r && <p className="hint bring-note">Colima's {i.name} is only {formatBytes(i.colimaBytes ?? 0)}; Docker Desktop's is {formatBytes(i.bytes)}. Remove Colima's in Volumes, then bring this one over.</p>}
        {!i.inColima && !r && pick.has(key(i)) && i.users.length > 0 && <p className="hint bring-note">{i.users.map((u, n) => <span key={u}>{n ? " and " : ""}<code>{u}</code></span>)} {i.users.length === 1 ? "uses" : "use"} it in Docker Desktop and will be stopped first, for a clean copy.</p>}
      </li>
    );
  };

  // One button for the whole run: Bring, then Stop while copying, then Done once nothing is left to pick.
  const label = retry ? `Try ${chosen.map((i) => i.name).join(" and ")} again (${formatBytes(total)})` : `Bring ${whatText(chosen)} over (${formatBytes(total)})`;
  // When the disk is full or too small, the way out is a bigger disk; the copy stays one click away.
  const roomFirst = !busy && chosen.length > 0 && (full || tight);
  const button = busy
    ? { label: "Stop", primary: false, go: stop, off: false }
    : chosen.length
      ? { label, primary: !roomFirst, go: bring, off: false }
      : result
        ? { label: "Done", primary: true, go: onClose, off: false }
        : { label: "Bring over", primary: true, go: () => {}, off: true };

  let body;
  if (!ctx) body = <p className="hint">Start the VM first. The volumes and images go into it.</p>;
  else if (error) body = <p className="hint" role="alert">{error}</p>;
  else if (!desktop) body = <p className="hint">Looking for Docker Desktop…</p>;
  else if (!desktop.installed && !desktop.running)
    body = desktop.disk_bytes > 0 ? (
      <>
        <p>Docker Desktop's data is still on this Mac (about {Math.max(1, Math.round(desktop.disk_bytes / 1024 ** 3))} GiB), but only Docker Desktop can read it.</p>
        <p className="hint">Install Docker Desktop again and open it once. Then come back here; you can remove it after.</p>
        <div className="actions">
          <button onClick={() => openUrl(DOWNLOAD)}>Download Docker Desktop</button>
          <button className="primary" onClick={() => void check()}>Check again</button>
        </div>
      </>
    ) : (
      <p className="hint">Docker Desktop and its data are gone from this Mac, so there is nothing left to bring over.</p>
    );
  else if (!desktop.running)
    body = (
      <>
        <p>Docker Desktop is closed. Open it, and its volumes and images show up here.</p>
        {opening && <p className="hint">This can take a minute.</p>}
        <div className="actions">
          <button className="primary" aria-disabled={opening || undefined} onClick={() => !opening && openDesktop()}>{opening ? "Waiting for Docker Desktop…" : "Open Docker Desktop"}</button>
        </div>
      </>
    );
  else if (!items) body = <p className="hint">Reading Docker Desktop…</p>;
  else if (!items.length) body = <p className="hint">Docker Desktop has no volumes or images to bring over.</p>;
  else
    body = (
      <>
        {vols.length > 0 && (
          <div className="group">
            <h4 ref={firstHeading} tabIndex={-1}>Volumes</h4>
            <p className="hint">Databases and uploads live here. They can't be downloaded again.{unnamed ? ` ${unnamed} unnamed volume${unnamed === 1 ? "" : "s"} left out.` : ""}</p>
            <ul className="bring-list" role="list">{vols.map(line)}</ul>
          </div>
        )}
        {imgs.length > 0 && (
          <div className="group">
            <h4 ref={vols.length ? undefined : firstHeading} tabIndex={-1}>Images</h4>
            <p className="hint">Colima downloads these again when you need them. Pick only the ones you built yourself.</p>
            <ul className="bring-list" role="list">{imgs.map(line)}</ul>
          </div>
        )}
        {!result && <p className="hint">Docker Desktop keeps its copy. Nothing Colima already has is replaced. A container that writes to a picked volume is stopped first.</p>}
        {tight && !busy && free !== null && <p className="hint bring-room">These need about {formatBytes(total)}; Colima has about {formatBytes(free)} free.</p>}
        {result && (
          <div id={ids.result} className={`bring-result${result.failed.length ? " bad" : " ok"}`}>
            <p><Icon name={result.failed.length ? "alert" : "check"} size={14} /> <span><Ticks text={result.text} /></span></p>
            {result.halted.length > 0 && <button className="small" aria-disabled={restarting || undefined} onClick={() => !restarting && startAgain(result.halted)}>{restarting ? `Starting ${result.halted.join(" and ")}…` : `Start ${result.halted.join(" and ")} again`}</button>}
          </div>
        )}
        <div className="actions">
          {roomFirst && <button className="primary" onClick={onProfiles}>Open Profiles</button>}
          <span id={ids.hint} className="hint bring-pick">{button.off ? "Pick a volume or an image." : ""}</span>
          <button ref={action} className={button.primary ? "primary" : undefined} aria-disabled={button.off || undefined} aria-describedby={button.off ? ids.hint : result && !busy && !result.failed.length ? ids.result : undefined} onClick={() => !button.off && button.go()}>{button.label}</button>
        </div>
      </>
    );

  return (
    <Drawer label="Bring over from Docker Desktop" title={<>Bring over from Docker Desktop</>} onClose={onClose} closeDisabled={busy} closeWhy="Stop the copy to close.">
      <p className="sr-only" role="status" aria-live="polite">{said}</p>
      <p className="sr-only" role="alert">{alarm}</p>
      {body}
    </Drawer>
  );
}

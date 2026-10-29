import { useEffect, useId, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Profile, ctxFor, docker, dockerJson, openUrl } from "./api";
import { formatBytes } from "./containerInfo";
import { Item, Outcome, Replaced, backupName, defaultPick, diskFull, doneLines, fits, inventory, key, order, picked, plainError, replaceNote, replaceSize, replaceable, stopQuestion, toStop, toStopColima, unpickedNote, whatText, writeError } from "./lib/bringOver";
import { useResizeEnv } from "./Resize";
import { setBringBusy } from "./bringBusy";
import { parseDiskUsage } from "./lib/disk";
import { markBroughtOver } from "./Setup";
import { useConfirm } from "./ui";
import Drawer from "./ui/Drawer";
import Ticks, { plain } from "./ui/Ticks";
import { Icon } from "./ui/icons";

type DesktopState = { installed: boolean; running: boolean; disk_bytes: number };
type Props = { ctx: string; onClose: () => void; onDone: () => void; onProfiles: () => void };
// step: a replace's current step (backup, empty, copy, check, restore, start); none for a plain copy.
type Row = { state: "waiting" | "copying" | "done" | "failed"; bytes: number; why?: string; step?: string };
// What desktop_replace answers: the outcome of replacing Colima's nearly empty copy.
type ReplaceResult = Replaced & { ok: boolean; bytes: number; why: string; not_started: string[] };
type Result = { lines: string[]; failed: Outcome[]; halted: string[]; colimaHalted: string[]; started: { desktop?: string; colima?: string } };

const ticks = (names: string[]) => names.map((n) => `\`${n}\``).join(" and ");
const stoppedIn = (names: string[], where: string) => `${ticks(names)} ${names.length === 1 ? "is" : "are"} stopped in ${where}.`;
// The result's lines, with what each side's Start button changed.
const resultLines = (r: Result) => [
  ...r.lines,
  r.halted.length ? stoppedIn(r.halted, "Docker Desktop") : r.started.desktop ?? "",
  r.colimaHalted.length ? stoppedIn(r.colimaHalted, "Colima") : r.started.colima ?? "",
].filter(Boolean);
// The restore-failed alert was already said in its own words; the summary doesn't repeat it.
const alarmSet = (failed: Outcome[]) => failed.some((o) => o.replaced?.colima === "in-backup");
// What a replace is doing, in the size column.
const STEP: Record<string, string> = { backup: "Backing up Colima's copy…", empty: "Emptying…", check: "Checking…", restore: "Putting Colima's copy back…" };

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
  // halted: Docker Desktop containers the copy stopped, so the line can say so and start them again. colimaHalted:
  // Colima containers a replace stopped that didn't start again on their own (or were left stopped on purpose).
  // started: the line that replaces "is stopped in …" once that side's Start button worked.
  const [result, setResult] = useState<Result | null>(null);
  const [free, setFree] = useState<number | null>(null);
  // After a write error inside Colima, restarting the VM comes first. It goes through the app's VM runner, so every
  // other VM button locks and follows it. idle, running, done, or the error text.
  const env = useResizeEnv();
  const [vmRestart, setVmRestart] = useState<string>("idle");
  // Which side's Start button is running; both wait while either does.
  const [restarting, setRestarting] = useState<"desktop" | "colima" | null>(null);
  const ids = { result: useId(), hint: useId(), note: useId() };
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

  // keep: the picks to hold on to after a run, so a box the user cleared stays clear and a failed one stays picked.
  async function read(keep?: Set<string>) {
    setSaid("Reading Docker Desktop…");
    const [desktopDf, desktopImages, desktopRunning, colimaDf, colimaPs, have] = await Promise.all([
      invoke<string>("desktop_docker", { args: DF }),
      invoke<string>("desktop_docker", { args: ["images", "--format", "json"] }),
      invoke<string>("desktop_docker", { args: ["ps", "--filter", "status=running", "--format", "json"] }).catch(() => ""),
      docker(ctx, DF).catch(() => ""),
      docker(ctx, ["ps", "-a", "--format", "{{json .}}"]).catch(() => ""),
      dockerJson<{ Repository: string; Tag: string }>(ctx, ["images"]),
    ]);
    // The VM's disk minus what Docker uses: an estimate, but enough to warn before a long copy fails.
    const [profiles, df] = await Promise.all([invoke<Profile[]>("list_profiles").catch(() => []), docker(ctx, ["system", "df", "--format", "{{json .}}"]).catch(() => "")]);
    const disk = profiles.find((p) => ctxFor(p.name) === ctx)?.disk;
    const used = parseDiskUsage(df).reduce((n, r) => n + (r.size ?? 0), 0);
    setFree(disk && df ? Math.max(0, disk - used) : null);
    const inv = inventory({ desktopDf, desktopImages, desktopRunning, colimaDf, colimaPs, colimaImages: have.map((i) => `${i.Repository}:${i.Tag}`) });
    setItems(inv.items);
    setUnnamed(inv.unnamed);
    setPick(keep ? new Set(inv.items.map(key).filter((k) => keep.has(k))) : defaultPick(inv.items));
    setSaid(`Docker Desktop has ${inv.items.length} volumes and images.`);
  }

  useEffect(() => {
    void check();
    const off = listen<{ name: string; bytes: number }>("desktop-progress", (e) => {
      const at = current.current;
      if (at && at.endsWith(`:${e.payload.name}`)) setRows((m) => new Map(m).set(at, { ...m.get(at), state: "copying", bytes: e.payload.bytes }));
    });
    const offStep = listen<{ name: string; step: string }>("desktop-step", (e) => {
      const at = current.current;
      if (at && at.endsWith(`:${e.payload.name}`)) setRows((m) => new Map(m).set(at, { state: "copying", bytes: 0, step: e.payload.step }));
      // The steps that protect Colima's data are said out loud, so a screen reader hears the backup happen.
      if (e.payload.step === "backup") setSaid(`Backing up Colima's copy of ${e.payload.name}`);
      if (e.payload.step === "restore") setSaid(`Putting Colima's copy of ${e.payload.name} back`);
    });
    return () => { void off.then((f) => f()); void offStep.then((f) => f()); };
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
    const stoppingHere = toStopColima(todo);
    // Named before the confirm, so the confirm and the result say the same backup.
    const now = new Date();
    const backups = new Map(todo.filter(replaceable).map((i) => [key(i), backupName(i.name, now)]));
    const replaces = todo.filter(replaceable).map((item) => ({ item, backup: backups.get(key(item))! }));
    if (stopping.length || stoppingHere.length || replaces.length) {
      const ok = await confirm(stopQuestion(stopping, stoppingHere, replaces), stopping.length || stoppingHere.length ? "Stop and bring over" : "Replace and bring over", { safe: true });
      if (!ok) return;
    }
    stopped.current = false;
    await invoke("desktop_copy_stop", { stop: false });
    setBusy(true);
    setBringBusy(true);
    setResult(null);
    setAlarm("");
    setRows(new Map(todo.map((i) => [key(i), { state: "waiting", bytes: 0 }])));
    const outcomes: Outcome[] = [];
    const tried: Item[] = [];
    const leftStopped: string[] = [];
    try {
      for (const item of todo) {
        if (stopped.current) break;
        tried.push(item);
        current.current = key(item);
        setSaid(`Copying ${item.name}`);
        setRows((m) => new Map(m).set(key(item), { state: "copying", bytes: 0 }));
        try {
          if (replaceable(item)) {
            const stopUsers = item.users.length > 0 || (item.colimaUsers ?? []).length > 0;
            const r = await invoke<ReplaceResult>("desktop_replace", { name: item.name, context: ctx, backup: backups.get(key(item)), stopUsers, bytes: Math.round(item.bytes) });
            leftStopped.push(...r.not_started.filter((n) => !leftStopped.includes(n)));
            const replaced = { colima: r.colima, backup: r.backup };
            if (r.ok) {
              outcomes.push({ item, ok: true, bytes: r.bytes, replaced });
              setRows((m) => new Map(m).set(key(item), { state: "done", bytes: r.bytes }));
              continue;
            }
            // Stopped, and Colima's copy is as it was: nothing to report for this one.
            if (stopped.current && r.colima !== "in-backup") {
              setRows((m) => new Map(m).set(key(item), { state: "waiting", bytes: 0 }));
              break;
            }
            outcomes.push({ item, ok: false, why: r.why, replaced });
            setRows((m) => new Map(m).set(key(item), { state: "failed", bytes: 0, why: r.why }));
            const still = r.not_started.length ? ` ${r.not_started.map((n) => `\`${n}\``).join(" and ")} ${r.not_started.length === 1 ? "stays" : "stay"} stopped.` : "";
            setAlarm(plain(r.colima === "in-backup" ? `\`${item.name}\` failed. Colima's copy is safe in \`${r.backup}\`.${still}` : `${item.name} failed: ${plainError(r.why)}`));
            // Something went wrong inside Colima; the rest waits for the user instead of running into it too.
            break;
          }
          const bytes = await invoke<number>("desktop_copy", { kind: item.kind, name: item.name, context: ctx, stopUsers: item.users.length > 0, bytes: Math.round(item.bytes) });
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
    } finally {
      setBringBusy(false);
    }
    current.current = null;
    const failed = outcomes.filter((o) => !o.ok);
    const halted = toStop(tried);
    // Not reached because a replace failed (a Stop says so itself); they stay picked for the retry.
    const untried = stopped.current ? [] : todo.filter((i) => !tried.includes(i));
    if (untried.length) setRows((m) => { const n = new Map(m); untried.forEach((i) => n.delete(key(i))); return n; });
    // Colima's containers a replace stopped and started itself (not when Colima's copy is only in the backup).
    const restarted = [...new Set(outcomes.filter((o) => o.replaced && o.replaced.colima !== "in-backup").flatMap((o) => o.item.colimaUsers ?? []))].filter((n) => !leftStopped.includes(n));
    const lines = doneLines(outcomes, stopped.current, untried, restarted);
    // Read the lists again before showing the end, so the button never flashes the old picks.
    await read(pick).catch(() => {});
    setBusy(false);
    const next = { lines, failed, halted, colimaHalted: leftStopped, started: {} };
    setResult(next);
    // A failure is announced at once; a success is read with the button that now has focus, so it is heard once.
    if (failed.length && !alarmSet(failed)) setAlarm(plain(resultLines(next).join(" ")));
    setSaid("");
    if (outcomes.some((o) => o.ok)) markBroughtOver();
    onDone();
    setTimeout(() => action.current?.focus(), 0);
  }

  // inColima: the containers are Colima's (a replace left them stopped), not Docker Desktop's.
  async function startAgain(names: string[], inColima = false) {
    const side = inColima ? "colima" : "desktop";
    const where = inColima ? "Colima" : "Docker Desktop";
    setRestarting(side);
    try {
      await invoke("desktop_start", inColima ? { names, context: ctx } : { names });
      // The button that had focus goes away; focus returns to the action button and the change is said.
      const running = `${names.join(" and ")} ${names.length === 1 ? "is" : "are"} running again in ${where}.`;
      setSaid(running);
      setTimeout(() => action.current?.focus(), 0);
      setResult((r) => r && { ...r, started: { ...r.started, [side]: running }, ...(inColima ? { colimaHalted: [] } : { halted: [] }) });
    } catch (e) {
      const why = `${names.join(" and ")} didn't start in ${where}: ${String(e).split("\n")[0]}`;
      setAlarm(why);
      setResult((r) => r && { ...r, lines: [...r.lines, why] });
    } finally {
      setRestarting(null);
    }
  }

  async function restartVm() {
    if (!env?.profile || env.locked || vmRestart === "running") return;
    setVmRestart("running");
    setSaid("Restarting the VM. This takes about a minute.");
    const err = await env.runVm("restarting", "restart_profile", { name: env.profile.name });
    setVmRestart(err ? `The VM didn't restart: ${err.split("\n")[0]}` : "done");
    setSaid(err ? "" : "The VM restarted. Try again when you're ready.");
    if (err) setAlarm(`The VM didn't restart: ${err.split("\n")[0]}`);
    setTimeout(() => action.current?.focus(), 0);
  }

  async function stop() {
    stopped.current = true;
    await invoke("desktop_copy_stop", { stop: true });
  }

  const toggle = (i: Item) => setPick((s) => { const n = new Set(s); n.has(key(i)) ? n.delete(key(i)) : n.add(key(i)); return n; });
  const chosen = picked(items ?? [], pick);
  const total = chosen.reduce((n, i) => n + i.bytes, 0);
  // A replace also keeps Colima's old copy, as a backup, on the same disk.
  const room = total + chosen.filter(replaceable).reduce((n, i) => n + (i.colimaBytes ?? 0), 0);
  const vols = (items ?? []).filter((i) => i.kind === "volume");
  const imgs = (items ?? []).filter((i) => i.kind === "image");
  const full = result?.failed.some((o) => !o.ok && diskFull(o.why));
  const tight = !fits(room, free);
  // The picks hold something that just failed: the button says it is a retry (with what wasn't reached, if picked).
  const retry = !!result?.failed.length && chosen.some((i) => result.failed.some((o) => key(o.item) === key(i)));

  const codes = (names: string[]) => names.map((u, n) => <span key={u}>{n ? " and " : ""}<code>{u}</code></span>);
  const stepText = (i: Item, step: string) => (step === "start" ? `Starting ${(i.colimaUsers ?? []).join(" and ")}…` : STEP[step]);
  const line = (i: Item) => {
    const r = rows.get(key(i));
    const swap = replaceable(i);
    const settled = (i.inColima && !swap) || r?.state === "done";
    // A replace shows its step; bytes and the bar only while Docker Desktop's data streams in.
    const streaming = r?.state === "copying" && (!r.step || r.step === "copy");
    const status = r?.state === "copying" && !streaming ? stepText(i, r.step!)
      : streaming ? `${formatBytes(r!.bytes)} of about ${formatBytes(i.bytes)}`
      : r?.state === "done" ? "Copied"
      : r?.state === "failed" ? "Failed"
      : r?.state === "waiting" && busy ? "Waiting"
      : swap ? replaceSize(i, pick.has(key(i)))
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
          <span className="bring-mark mark">{mark ?? <input type="checkbox" checked={pick.has(key(i))} disabled={busy} aria-describedby={swap && !r ? `${ids.note}-${i.name}` : undefined} onChange={() => toggle(i)} />}</span>
          <span className="bring-name" title={i.name}>{i.name}</span>
          <span className="hint bring-size">{r?.state === "failed" && <Icon name="close" size={12} />} {status}</span>
        </Line>
        {streaming && <div className="bar" role="progressbar" aria-label={`Copying ${i.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={status}><i style={{ width: `${pct}%` }} /></div>}
        {/* Docker's own words stay in the code font; a message the app wrote does not. */}
        {r?.state === "failed" && <Why why={r.why ?? ""} />}
        {/* One note: picked, who stops where; not picked, what picking it would do. */}
        {swap && !r && <p id={`${ids.note}-${i.name}`} className="hint bring-note"><Ticks text={pick.has(key(i)) ? replaceNote(i) : unpickedNote(i)} /></p>}
        {!i.inColima && !r && pick.has(key(i)) && i.users.length > 0 && <p className="hint bring-note">{codes(i.users)} {i.users.length === 1 ? "uses" : "use"} it in Docker Desktop and will be stopped first, for a clean copy.</p>}
      </li>
    );
  };

  // One button for the whole run: Bring, then Stop while copying, then Done once nothing is left to pick.
  const label = retry ? `Try ${chosen.map((i) => i.name).join(" and ")} again (${formatBytes(total)})` : `Bring ${whatText(chosen)} over (${formatBytes(total)})`;
  // When the disk is full or too small, the way out is a bigger disk; the copy stays one click away.
  const roomFirst = !busy && chosen.length > 0 && (full || tight);
  const writeErr = !!result?.failed.some((o) => !o.ok && writeError(o.why));
  // After a write error the VM restart is the main button; the retry stays beside it.
  const restartFirst = !busy && writeErr && vmRestart !== "done";
  const nextStep = !writeErr ? "" : vmRestart === "done" ? "The VM restarted. Try again." : vmRestart === "idle" || vmRestart === "running" ? "Restart the VM, then try again." : vmRestart;
  const button = busy
    ? { label: "Stop", primary: false, go: stop, off: false }
    : chosen.length
      ? { label, primary: !roomFirst && !restartFirst, go: bring, off: false }
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
        {!result && <p className="hint">Docker Desktop keeps its copy. {vols.some(replaceable) ? "Colima's copy is backed up before it is replaced." : "Nothing Colima already has is replaced."} A container that writes to a picked volume is stopped first.</p>}
        {tight && !busy && free !== null && <p className="hint bring-room">These need about {formatBytes(total)}; Colima has about {formatBytes(free)} free.</p>}
        {result && (
          <div id={ids.result} className={`bring-result${result.failed.length ? " bad" : " ok"}`}>
            {[...resultLines(result), nextStep].filter(Boolean).map((l, n) => <p key={n}>{n === 0 && <Icon name={result.failed.length ? "alert" : "check"} size={14} />}<span><Ticks text={l} /></span></p>)}
            {/* Under the line that asks for it; the retry stays the panel's own button. */}
            {restartFirst && <button className="small primary" aria-disabled={vmRestart === "running" || !!env?.locked || undefined} onClick={() => void restartVm()}>{vmRestart === "running" ? "Restarting the VM…" : "Restart the VM"}</button>}
            {result.halted.length > 0 && <button className="small" aria-disabled={!!restarting || undefined} onClick={() => !restarting && startAgain(result.halted)}>{restarting === "desktop" ? `Starting ${result.halted.join(" and ")}…` : `Start ${result.halted.join(" and ")} in Docker Desktop`}</button>}
            {result.colimaHalted.length > 0 && <button className="small" aria-disabled={!!restarting || undefined} onClick={() => !restarting && startAgain(result.colimaHalted, true)}>{restarting === "colima" ? `Starting ${result.colimaHalted.join(" and ")}…` : `Start ${result.colimaHalted.join(" and ")} in Colima`}</button>}
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

// A failure in plain words. Docker's own text, when it says something else, is behind Show output.
function Why({ why }: { why: string }) {
  const said = plainError(why);
  const raw = why.split("\n")[0];
  if (said === raw) return <p className="hint bring-why raw">{said}</p>;
  return (
    <div className="bring-why">
      <p className="hint">{said}</p>
      <details className="how bring-output">
        <summary><Icon name="chevron" size={12} />Show output</summary>
        <pre>{why}</pre>
      </details>
    </div>
  );
}

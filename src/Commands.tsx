// What the app just did to Docker, as the command you'd type. A toast after each click, and every command of this
// session in one list. Now and then the toast hides the command and asks you to recall it first.
import { useEffect, useState, useSyncExternalStore } from "react";
import Drawer from "./ui/Drawer";
import { Icon } from "./ui/icons";
import { activity } from "./lib/activity";
import type { Entry } from "./lib/activity";

export const useActivity = () => useSyncExternalStore(activity.subscribe, activity.snapshot);
// A recall waits until you answer it; a plain one goes after a few seconds.
const SHOW_MS = 6000;
const what = (kind: string) => ({ rm: "remove", rmi: "remove", "compose up": "start", "compose stop": "stop", "compose restart": "restart", "compose down": "take down", prune: "clean up", exec: "open a shell in" } as Record<string, string>)[kind] ?? kind;
const PAST: Record<string, string> = { start: "Started", stop: "Stopped", restart: "Restarted", rm: "Removed", rmi: "Removed", pause: "Paused", unpause: "Resumed", "compose up": "Started", "compose stop": "Stopped", "compose restart": "Restarted", "compose down": "Took down", delete: "Deleted", force_stop: "Stopped", force_restart: "Restarted", exec: "Opened a shell in" };
// "Stopped web", "Couldn't stop web": what happened, before the command that did it.
const said = (e: Entry) => {
  if (!e.what) return null;
  if (e.ok === false) return `Couldn't ${what(e.kind)} ${e.what}`;
  return e.ok ? `${PAST[e.kind] ?? "Done:"} ${e.what}` : `${e.what}…`;
};

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className="icon-btn" aria-label={label} title={done ? "Copied" : "Copy"} onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }, () => {})}>
      <Icon name={done ? "check" : "copy"} size={13} />
    </button>
  );
}

export function CommandToast({ onOpenLog }: { onOpenLog: () => void }) {
  const { entries } = useActivity();
  const last = entries[0];
  const [gone, setGone] = useState<number | null>(null);
  useEffect(() => {
    if (!last || last.recall || last.ok === null) return;
    const t = setTimeout(() => setGone(last.id), SHOW_MS);
    return () => clearTimeout(t);
  }, [last?.id, last?.recall, last?.ok]);
  if (!last || gone === last.id) return null;
  const close = () => setGone(last.id);
  if (last.recall)
    return (
      <div className="cmd-toast recall" role="status">
        <Icon name="info" size={14} />
        <span>
          <b>Quick one:</b> you just asked to {what(last.kind)} {last.what ?? "it"}. What would you type to do that yourself?
        </span>
        <span className="actions-inline">
          <button onClick={() => activity.reveal(last.id)}>Show me</button>
          <button className="link" onClick={() => { activity.setTips(false); close(); }}>Don't ask again</button>
          <button className="icon-btn" aria-label="Close" title="Close" onClick={close}><Icon name="close" size={13} /></button>
        </span>
      </div>
    );
  return (
    <div className={`cmd-toast${last.ok === false ? " bad" : ""}`} role="status">
      <Icon name={last.ok === false ? "close" : last.ok ? "check" : "terminal"} size={14} />
      {said(last) && <span className="cmd-said">{said(last)}</span>}
      <code className="mono">{last.cmd}</code>
      <span className="actions-inline">
        <Copy text={last.cmd} label="Copy the command" />
        <button className="link" onClick={onOpenLog}>All commands</button>
        <button className="icon-btn" aria-label="Close" title="Close" onClick={close}><Icon name="close" size={13} /></button>
      </span>
    </div>
  );
}

const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function CommandLog({ onClose }: { onClose: () => void }) {
  const { entries, tips } = useActivity();
  return (
    <Drawer label="Commands" title={<>Commands</>} onClose={onClose}>
      <p className="hint">What each click ran, newest first. Type these in Terminal to do the same.</p>
      <label className="check-row">
        <input type="checkbox" checked={tips} onChange={(e) => activity.setTips(e.target.checked)} />
        Now and then, ask me to recall the command first
      </label>
      {!entries.length && <p className="hint">Nothing yet. Start, stop or fix something and its command shows here.</p>}
      <ul className="cmd-log">
        {entries.map((e: Entry) => (
          <li key={e.id} className={e.ok === false ? "bad" : undefined}>
            <span className="hint">{time(e.at)}</span>
            <code className="mono">{e.cmd}</code>
            <span className="hint">{e.ok === null ? "running" : e.ok ? "" : "failed"}</span>
            <Copy text={e.cmd} label={`Copy ${e.cmd}`} />
          </li>
        ))}
      </ul>
    </Drawer>
  );
}

// What the app just did to Docker, as the command you'd type. A toast after each click, and every command of this
// session in one list. Now and then the toast hides the command and asks you to recall it first.
import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "./ui/icons";
import { Button } from "./ui/op/Button";
import { activity } from "./lib/activity";
import type { Entry } from "./lib/activity";

export const useActivity = () => useSyncExternalStore(activity.subscribe, activity.snapshot);
// A recall waits until you answer it; a plain one goes after a few seconds.
const SHOW_MS = 6000;
const what = (kind: string) => ({ rm: "remove", rmi: "remove", "compose up": "start", "compose stop": "stop", "compose restart": "restart", "compose down": "take down", "compose build": "rebuild", "compose pull": "update the images of", prune: "clean up", exec: "open a shell in", debug: "open a toolbox shell next to", apply_resources: "apply new settings to" } as Record<string, string>)[kind] ?? kind;
const PAST: Record<string, string> = { start: "Started", stop: "Stopped", restart: "Restarted", rm: "Removed", rmi: "Removed", pause: "Paused", unpause: "Resumed", "compose up": "Started", "compose stop": "Stopped", "compose restart": "Restarted", "compose down": "Took down", delete: "Deleted", force_stop: "Stopped", force_restart: "Restarted", exec: "Opened a shell in", "compose build": "Rebuilt", "compose pull": "Updated the images of", prune: "Cleaned up", apply_resources: "Applied new settings to" };
// "Stopped web", "Couldn't stop web": what happened, before the command that did it.
export const said = (e: Entry) => {
  if (!e.what) return null;
  if (e.ok === false) return `Couldn't ${what(e.kind)} ${e.what}`;
  // Said in full, because the user asked for a shell and got something else.
  if (e.kind === "debug") return e.ok ? `${e.what} has no shell (normal for small images), so a toolbox shell opened next to it` : `${e.what}…`;
  return e.ok ? `${PAST[e.kind] ?? "Done:"} ${e.what}` : `${e.what}…`;
};

// Fixed at the bottom, centred, with room between its parts. The width is the text's, capped at max-w-xl.
// Its right edge is set in components.css, so an open sheet pushes it left of the sheet instead of under it.
const toastShell = "cmd-toast fixed left-4 bottom-4 z-50 mx-auto flex w-fit max-w-xl items-center gap-3 rounded-md border border-line bg-bg-raised py-2 pl-3 pr-2 text-meta text-fg shadow-floating";

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="ghost" size="xs" iconOnly icon={done ? "check" : "copy"} aria-label={label} title={done ? "Copied" : "Copy"} onClick={() => navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1200); }, () => {})} />
  );
}

export function CommandToast({ onOpenLog }: { onOpenLog: () => void }) {
  const { entries } = useActivity();
  // The newest entry that wants a toast; a quiet one (the VM size fix) is reported by its own row.
  const last = entries.find((e) => !e.quiet);
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
      <div className={toastShell} role="status">
        <Icon name="info" size={14} />
        <span className="min-w-0">
          <b>Quick one:</b> you just asked to {what(last.kind)} {last.what ?? "it"}. What would you type to do that yourself?
        </span>
        <span className="flex shrink-0 items-center gap-1">
          <Button variant="primary" size="xs" onClick={() => activity.reveal(last.id)}>Show me</Button>
          <Button variant="ghost" size="xs" onClick={() => { activity.setTips(false); close(); }}>Don't ask again</Button>
          <Button variant="ghost" size="xs" iconOnly icon="close" aria-label="Close" title="Close" onClick={close} />
        </span>
      </div>
    );
  return (
    <div className={`${toastShell}${last.ok === false ? " border-bad" : ""}`} role="status">
      <Icon name={last.ok === false ? "close" : last.ok ? "check" : "terminal"} size={14} />
      <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
        {said(last) && <span className="cmd-said break-words text-fg-muted">{said(last)}</span>}
        <code className="cmd-pill max-w-full break-words rounded-sm bg-bg-canvas px-1.5 py-0.5 font-mono" title={last.cmd}>{last.cmd}</code>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <Copy text={last.cmd} label="Copy the command" />
        <Button variant="ghost" size="xs" onClick={onOpenLog}>All commands</Button>
        <Button variant="ghost" size="xs" iconOnly icon="close" aria-label="Close" title="Close" onClick={close} />
      </span>
    </div>
  );
}



import { ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";
import Ticks from "./ui/Ticks";
import { Icon } from "./ui/icons";

// safe: the action changes nothing that can't be undone (a fix with backups), so its button is the normal green one.
type Ask = (message: string, confirmLabel?: string, opts?: { safe?: boolean }) => Promise<boolean>;
const ConfirmCtx = createContext<Ask>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

// window.confirm() is not reliable inside the desktop webview, so confirmations are drawn by the app.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<{ message: string; label: string; safe?: boolean } | null>(null);
  const resolver = useRef<(ok: boolean) => void>();
  // Focus goes back where it was, so a keyboard or VoiceOver user lands on the button that asked.
  const opener = useRef<HTMLElement | null>(null);
  const ask = useCallback<Ask>(
    (message, label = "Remove", opts) =>
      new Promise((resolve) => {
        opener.current = document.activeElement as HTMLElement | null;
        resolver.current = resolve;
        setReq({ message, label, safe: opts?.safe });
      }),
    [],
  );
  const close = (ok: boolean) => {
    resolver.current?.(ok);
    setReq(null);
    opener.current?.focus?.();
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {req && (
        <>
          <div className="scrim scrim-top" onClick={() => close(false)} />
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={req.message.includes("\n") ? "confirm-body" : undefined} onKeyDown={(e) => e.key === "Escape" && close(false)}>
            {req.message.includes("\n") ? (
              <>
                <p className="modal-title" id="confirm-title"><Ticks text={req.message.slice(0, req.message.indexOf("\n"))} /></p>
                <div id="confirm-body"><Body text={req.message.slice(req.message.indexOf("\n") + 1)} /></div>
              </>
            ) : <p id="confirm-title">{req.message}</p>}
            <div className="actions">
              <button autoFocus onClick={() => close(false)}>Cancel</button>
              <button className={req.safe ? "primary" : "primary danger-fill"} onClick={() => close(true)}>{req.label}</button>
            </div>
          </div>
        </>
      )}
    </ConfirmCtx.Provider>
  );
}

// A confirm's body: "• " lines become a list (so a long line wraps under its own text), "! " lines a notice set apart
// with a warning mark (something the action leaves out), other lines paragraphs.
// Names in `backticks` show in the code font.
function Body({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let items: string[] = [];
  const flush = () => { if (items.length) blocks.push(<ul key={blocks.length}>{items.map((t) => <li key={t}><Ticks text={t} /></li>)}</ul>); items = []; };
  for (const line of text.split("\n")) {
    if (line.startsWith("• ")) items.push(line.slice(2));
    else if (line.startsWith("! ")) { flush(); blocks.push(<p key={blocks.length} className="confirm-notice"><Icon name="alert" size={14} /><span><Ticks text={line.slice(2)} /></span></p>); }
    else { flush(); if (line.trim()) blocks.push(<p key={blocks.length}><Ticks text={line} /></p>); }
  }
  flush();
  return <>{blocks}</>;
}

export function Banner({ error, onClose }: { error: string | null; onClose?: () => void }) {
  if (!error) return null;
  return (
    <div className="error" role="alert">
      <pre>{error}</pre>
      {onClose && <button onClick={onClose}>Dismiss</button>}
    </div>
  );
}

export { Empty as EmptyState };
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      <p className="hint">{children}</p>
      {action}
    </div>
  );
}

import { Empty as OpEmpty } from "./ui/op/Empty";
import { ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";
import { Icon } from "./ui/icons";
import Ticks from "./ui/Ticks";

// A simple confirmation dialog, app-wide. The opener gets focus back so a
// keyboard or VoiceOver user lands on the button that asked.
//
// @deprecated Use Dialog from "@/ui/components/Dialog" instead.
// This confirm implementation is deprecated in favor of a single modal/confirm
// implementation in src/ui/components/. New code should use Dialog; existing
// callers will be migrated incrementally.
type Ask = (message: string, confirmLabel?: string, opts?: { safe?: boolean }) => Promise<boolean>;
const ConfirmCtx = createContext<Ask>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<{ message: string; label: string; safe?: boolean } | null>(null);
  const resolver = useRef<(ok: boolean) => void>();
  const opener = useRef<HTMLElement | null>(null);
  const ask = useCallback<Ask>(
    (message, label = "Remove", opts) =>
      new Promise((resolve) => {
        opener.current = document.activeElement as HTMLElement;
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
        // .legacy carries the .modal and .scrim styles in src/ui/legacy.css; it is display: contents, so it adds no box.
        <div className="legacy">
          <div className="scrim scrim-top" onClick={() => close(false)} />
          <div className="modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={req.message.includes("\n") ? "confirm-body" : undefined} onKeyDown={(e) => e.key === "Escape" && close(false)}>
            {req.message.includes("\n") ? (
              <>
                <p className="modal-title" id="confirm-title"><Ticks text={req.message.slice(0, req.message.indexOf("\n"))} /></p>
                <div id="confirm-body"><Body text={req.message.slice(req.message.indexOf("\n") + 1)} /></div>
              </>
            ) : <p id="confirm-title"><Ticks text={req.message} /></p>}
            <div className="actions">
              <button autoFocus onClick={() => close(false)}>Cancel</button>
              <button className={req.safe ? "primary" : "danger-fill"} onClick={() => close(true)}>{req.label}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

// A confirm's body: "• " lines become a list, "! " lines a notice with a warning mark, other lines paragraphs.
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

export type EmptySize = "sm" | "md" | "lg";

interface EmptyProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  size?: EmptySize;
  children?: ReactNode;
}

// The legacy Empty now draws the op Empty, so every empty state looks the same (it used inline styles before).
export function Empty({ title, description, action, children }: EmptyProps) {
  return (
    <OpEmpty icon="info" title={title ?? ""} actions={action} className="" >
      {description}
      {children}
    </OpEmpty>
  );
}

// Alias for backward compatibility
export { Empty as EmptyState };
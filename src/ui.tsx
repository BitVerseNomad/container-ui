import { ReactNode, createContext, useCallback, useContext, useRef, useState } from "react";

type Ask = (message: string, confirmLabel?: string) => Promise<boolean>;
const ConfirmCtx = createContext<Ask>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

// window.confirm() is not reliable inside the desktop webview, so confirmations are drawn by the app.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<{ message: string; label: string } | null>(null);
  const resolver = useRef<(ok: boolean) => void>();
  const ask = useCallback<Ask>(
    (message, label = "Remove") =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setReq({ message, label });
      }),
    [],
  );
  const close = (ok: boolean) => {
    resolver.current?.(ok);
    setReq(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      {req && (
        <>
          <div className="scrim scrim-top" onClick={() => close(false)} />
          <div className="modal" role="alertdialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && close(false)}>
            <p>{req.message}</p>
            <div className="actions">
              <button autoFocus onClick={() => close(false)}>Cancel</button>
              <button className="primary danger-fill" onClick={() => close(true)}>{req.label}</button>
            </div>
          </div>
        </>
      )}
    </ConfirmCtx.Provider>
  );
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

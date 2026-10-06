import { KeyboardEvent, ReactNode, useEffect, useRef } from "react";

type Props = { label: string; title: ReactNode; onClose: () => void; closeDisabled?: boolean; children: ReactNode };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A modal side panel: focus moves in on open, Tab stays inside, Escape closes, focus returns to the opener.
export default function Drawer({ label, title, onClose, closeDisabled = false, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // Captured during the first render: an `autoFocus` child steals focus before any effect runs.
  const opener = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea") ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => opener.current?.focus?.();
  }, []);

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape" && !closeDisabled) {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== "Tab" || !ref.current) return;
    const items = [...ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
    if (!items.length) return;
    const [firstEl, lastEl] = [items[0], items[items.length - 1]];
    if (e.shiftKey && document.activeElement === firstEl) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && document.activeElement === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  }

  return (
    <>
      <div className="scrim" onClick={() => !closeDisabled && onClose()} />
      <div ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={label} onKeyDown={onKeyDown}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button disabled={closeDisabled} onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </>
  );
}

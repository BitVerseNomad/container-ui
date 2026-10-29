import { KeyboardEvent, ReactNode, useEffect, useId, useRef } from "react";

// closeWhy: said with a Close that waits, so the reason is heard, not only a dimmed button.
type Props = { label: string; title: ReactNode; onClose: () => void; closeDisabled?: boolean; closeWhy?: string; children: ReactNode };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// A modal side panel: focus moves in on open, Tab stays inside, Escape closes, focus returns to the opener.
export default function Drawer({ label, title, onClose, closeDisabled = false, closeWhy, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const whyId = useId();
  // Captured during the first render: an `autoFocus` child steals focus before any effect runs.
  const opener = useRef<HTMLElement | null>(document.activeElement as HTMLElement | null);

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea") ?? ref.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => opener.current?.focus?.();
  }, []);

  // A button that disables itself on click (Scan again, Start) drops focus to the page, out of reach of onKeyDown.
  useEffect(() => {
    const lost = (e: globalThis.KeyboardEvent) => {
      // Only the panel opened last closes, so one Escape never closes two.
      const top = [...document.querySelectorAll(".drawer")].pop();
      if (e.key === "Escape" && !closeDisabled && document.activeElement === document.body && top === ref.current) onClose();
    };
    document.addEventListener("keydown", lost);
    return () => document.removeEventListener("keydown", lost);
  }, [closeDisabled, onClose]);

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
          {/* aria-disabled keeps Close in the Tab order while it waits, so focus has a place to stay. */}
          <button aria-disabled={closeDisabled || undefined} aria-describedby={closeDisabled && closeWhy ? whyId : undefined} title={closeDisabled ? closeWhy : undefined} onClick={() => !closeDisabled && onClose()}>Close</button>
          {closeDisabled && closeWhy && <span id={whyId} className="sr-only">{closeWhy}</span>}
        </div>
        {children}
      </div>
    </>
  );
}

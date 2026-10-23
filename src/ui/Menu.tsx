// A small button menu: opens below its button, closes on choice, Escape or a click outside,
// and puts focus back on its button so a drawer opened from it returns focus somewhere real.
import { ReactNode, useEffect, useRef, useState } from "react";

export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void; hint?: string };

export default function Menu({ label, children, items, primary }: { label: string; children: ReactNode; items: MenuItem[]; primary?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    root.current?.querySelector<HTMLButtonElement>("[role=menuitem]")?.focus();
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const move = (e: React.KeyboardEvent) => {
    const all = [...(root.current?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") all[(i + 1) % all.length]?.focus();
    else if (e.key === "ArrowUp") all[(i - 1 + all.length) % all.length]?.focus();
    else return;
    e.preventDefault();
  };
  return (
    <span className="menu" ref={root} onKeyDown={move}>
      <button ref={button} className={primary ? "primary" : undefined} aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {children}
      </button>
      {open && (
        <div className="menu-pop" role="menu" aria-label={label}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" onClick={() => { close(); it.onSelect(); }}>
              {it.icon}
              <span>{it.label}</span>
              {it.hint && <span className="hint menu-hint">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

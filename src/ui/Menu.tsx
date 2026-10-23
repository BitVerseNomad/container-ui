// A small button menu: opens below its button, closes on choice, Escape or a click outside,
// and puts focus back on its button so a drawer opened from it returns focus somewhere real.
import { ReactNode, useEffect, useRef, useState } from "react";
import { Icon } from "./icons";

// checked marks the current choice (a radio item); divider draws a line above the item;
// side is a second, smaller action on the same row (for example Start next to a profile).
type Side = { label: string; ariaLabel: string; onSelect: () => void; disabled?: boolean };
export type MenuItem = { label: string; icon?: ReactNode; onSelect: () => void; hint?: string; checked?: boolean; divider?: boolean; side?: Side };

type Props = { label: string; children: ReactNode; items: MenuItem[]; primary?: boolean; className?: string; align?: "left" | "right"; title?: string };

export default function Menu({ label, children, items, primary, className, align = "right", title }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", away);
    (root.current?.querySelector<HTMLButtonElement>("[aria-checked=true]") ?? root.current?.querySelector<HTMLButtonElement>("[role^=menuitem]"))?.focus();
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const close = () => {
    setOpen(false);
    button.current?.focus();
  };
  const move = (e: React.KeyboardEvent) => {
    const all = [...(root.current?.querySelectorAll<HTMLButtonElement>("[role^=menuitem]") ?? [])];
    const i = all.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") close();
    else if (e.key === "ArrowDown") all[(i + 1) % all.length]?.focus();
    else if (e.key === "ArrowUp") all[(i - 1 + all.length) % all.length]?.focus();
    else return;
    e.preventDefault();
  };
  return (
    <span className="menu" ref={root} onKeyDown={move}>
      <button ref={button} className={[primary ? "primary" : "", className ?? ""].join(" ").trim() || undefined} aria-label={label} title={title} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {children}
      </button>
      {open && (
        <div className={align === "left" ? "menu-pop left" : "menu-pop"} role="menu" aria-label={label}>
          {items.map((it) => (
            <div key={it.label} role="none" className={it.divider ? "menu-row menu-divider" : "menu-row"}>
              <button role={it.checked === undefined ? "menuitem" : "menuitemradio"} aria-checked={it.checked} onClick={() => { close(); it.onSelect(); }}>
                {it.icon}
                <span>{it.label}</span>
                {it.hint && <span className="hint menu-hint">{it.hint}</span>}
                {it.checked !== undefined && <span className="menu-check">{it.checked && <Icon name="tick" size={13} />}</span>}
              </button>
              {it.side && (
                <button role="menuitem" className="menu-side" aria-label={it.side.ariaLabel} title={it.side.ariaLabel} disabled={it.side.disabled} onClick={() => { close(); it.side?.onSelect(); }}>
                  {it.side.label}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

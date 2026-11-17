import * as Dialog from "@radix-ui/react-dialog";
import React, { Fragment, useState, useCallback, useEffect, useMemo } from "react";
import { Dot, DotState } from "./Dot";
import { Icon } from "./Icon";
import { usePortalContainer } from "./Portal";

export type PaletteEntry = { id: string; label: string; hint?: string; dot?: DotState; kbd?: string; enter?: string };
export type PaletteSection = { group: string; items: PaletteEntry[] };
export type PaletteProps = { open: boolean; onClose: () => void; query: string; onQuery: (query: string) => void; sections: PaletteSection[]; onRun: (id: string) => void };

export function Palette(props: PaletteProps) {
  const { open, onClose, query, onQuery, sections, onRun } = props;
  const [highlighted, setHighlighted] = useState(0);
  const flatEntries = useMemo(() => sections.flatMap((s, si) => s.items.map((i, ei) => ({ sectionIndex: si, entryIndex: ei, entry: i }))), [sections]);

  useEffect(() => {
    setHighlighted(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setHighlighted((h) => Math.min(h + 1, flatEntries.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHighlighted((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); onRun(flatEntries[highlighted]?.entry.id ?? ""); }
  }, [flatEntries, highlighted, onRun]);

  if (!open) return null;

  const activeEntry = flatEntries[highlighted]?.entry;
  const activeId = activeEntry?.id;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal container={usePortalContainer()}>
        <Dialog.Overlay className="fixed inset-0 bg-bg-overlay" />
        <Dialog.Content className="palette" aria-label="Command palette">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-line px-4 py-3">
            <Icon name="search" />
            <input
              role="combobox"
              aria-label="Search commands and containers"
              aria-expanded="true"
              aria-controls="palette-results"
              aria-activedescendant={activeId ? `palette-${activeId}` : undefined}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              autoFocus
              onKeyDown={handleKeyDown}
            />
            <span className="inline-flex min-w-5 items-center justify-center rounded-xs border border-edge bg-tile px-1.5 font-mono text-micro text-fg-muted">esc</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1" id="palette-results" role="listbox">
            {flatEntries.length === 0 && query.trim() !== "" && (
              <div className="empty"><div className="text">Nothing matches "{query}".</div></div>
            )}
            {sections.map((section, si) => section.items.length === 0 ? null : (
              <Fragment key={section.group}>
                <div className="menu-cap">{section.group}</div>
                {section.items.map((entry, ei) => {
                  const idx = flatEntries.findIndex((f) => f.sectionIndex === si && f.entryIndex === ei);
                  const isHighlighted = idx === highlighted;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      role="option"
                      id={`palette-${entry.id}`}
                      className="menu-item"
                      aria-selected={isHighlighted}
                      data-highlighted={isHighlighted || undefined}
                      onClick={() => onRun(entry.id)}
                      onMouseEnter={() => setHighlighted(idx)}
                    >
                      <span className="top">
                        {entry.dot && <Dot state={entry.dot} />}
                        <span>{entry.label}</span>
                        {entry.hint && <span className="text-meta text-fg-muted">{entry.hint}</span>}
                        {entry.kbd && <span className="inline-flex min-w-5 items-center justify-center rounded-xs border border-edge bg-tile px-1.5 font-mono text-micro text-fg-muted">{entry.kbd}</span>}
                        {isHighlighted && entry.enter && <span className="inline-flex min-w-5 items-center justify-center rounded-xs border border-edge bg-tile px-1.5 font-mono text-micro text-fg-muted">{entry.enter}</span>}
                      </span>
                    </button>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

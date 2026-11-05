import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Icon, IconName } from "./ui/icons";
import { useKeyboardShortcuts, KeyboardShortcut } from "./hooks/useKeyboardShortcuts";
import { Button } from "./ui/components/Button";

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: IconName;
  keywords?: string[];
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
  section?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: Command[];
  onShortcut?: (shortcut: string) => void;
}

export default function CommandPalette({
  isOpen,
  onClose,
  commands,
  onShortcut,
}: CommandPaletteProps) {
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const itemsRef = useRef<(HTMLLIElement | null)[]>([]);

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const query = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(query) ||
        cmd.description?.toLowerCase().includes(query) ||
        cmd.keywords?.some((k) => k.toLowerCase().includes(query)) ||
        cmd.shortcut?.toLowerCase().includes(query)
    );
  }, [search, commands]);

  const visibleCommands = filteredCommands.filter((c) => !c.disabled);
  const highlightedCommand = visibleCommands[highlightedIndex];

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  useEffect(() => {
    if (highlightedCommand && itemsRef.current[highlightedIndex]) {
      itemsRef.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, highlightedCommand]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement> | KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, visibleCommands.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (highlightedCommand) {
          highlightedCommand.action();
          onClose();
        }
      } else if (e.key === "Tab") {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % visibleCommands.length);
      }
    }, [visibleCommands, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal((
    <div
      className="command-palette-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div className="command-palette" role="search" aria-label="Command Palette">
        <div className="command-palette-header">
          <Icon name="search" size={18} aria-hidden="true" />
          <input
            type="text"
            className="command-palette-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type a command or search…"
            autoFocus
            aria-label="Search commands"
            aria-autocomplete="list"
            aria-controls="command-list"
            aria-activedescendant={highlightedCommand ? `cmd-${highlightedCommand.id}` : undefined}
            onKeyDown={handleKeyDown}
          />
          <kbd className="command-palette-hint">⌘K</kbd>
        </div>

        <ul
          ref={listRef}
          id="command-list"
          className="command-palette-list"
          role="listbox"
          aria-label="Available commands"
        >
          {visibleCommands.length === 0 ? (
            <li className="command-palette-empty" role="option" aria-disabled="true">
              No commands found
            </li>
          ) : (
            visibleCommands.map((cmd, index) => (
              <li
                key={cmd.id}
                ref={(el) => { itemsRef.current[index] = el; }}
                role="option"
                id={`cmd-${cmd.id}`}
                className={`command-palette-item ${index === highlightedIndex ? "highlighted" : ""} ${cmd.disabled ? "disabled" : ""}`}
                aria-selected={index === highlightedIndex}
                aria-disabled={cmd.disabled}
                onClick={() => {
                  if (!cmd.disabled) {
                    cmd.action();
                    onClose();
                  }
                }}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {cmd.icon && <Icon name={cmd.icon} size={16} className="cmd-icon" aria-hidden="true" />}
                <div className="cmd-content">
                  <span className="cmd-label">{cmd.label}</span>
                  {cmd.description && <span className="cmd-description">{cmd.description}</span>}
                </div>
                {cmd.shortcut && <kbd className="cmd-shortcut">{cmd.shortcut}</kbd>}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  ), document.body);
}
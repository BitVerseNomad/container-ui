import { useEffect, useCallback } from "react";
import { isTypingTarget } from "../lib/shortcuts";

export type KeyboardShortcut = {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description?: string;
  preventDefault?: boolean;
};

export type Command = {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  keywords?: string[];
  action: () => void;
  shortcut?: string;
  disabled?: boolean;
  section?: string;
};

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;

      for (const shortcut of shortcuts) {
        // A key typed in a text field is never a shortcut, except Cmd combinations and Escape.
        if (isTypingTarget(target) && !shortcut.meta && e.key !== "Escape") continue;

        const metaMatch = shortcut.meta ? e.metaKey : !e.metaKey;
        const ctrlMatch = shortcut.ctrl ? e.ctrlKey : !e.ctrlKey;
        // When the shortcut key is "?", ignore shiftKey so Shift+? matches a plain "?" shortcut.
        const shiftMatch = shortcut.key === "?" ? true : (shortcut.shift ? e.shiftKey : !e.shiftKey);
        const altMatch = shortcut.alt ? e.altKey : !e.altKey;
        const keyMatch = shortcut.key.toLowerCase() === e.key.toLowerCase();

        if (metaMatch && ctrlMatch && shiftMatch && altMatch && keyMatch) {
          if (shortcut.preventDefault !== false) e.preventDefault();
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown, enabled]);
}

export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = [];
  if (shortcut.meta) parts.push("⌘");
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.shift) parts.push("⇧");
  if (shortcut.alt) parts.push("⌥");
  parts.push(shortcut.key.toUpperCase());
  return parts.join(" + ");
}

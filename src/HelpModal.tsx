import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon, IconName } from "./ui/icons";
import { Button } from "./ui/components/Button";
import { useKeyboardShortcuts, KeyboardShortcut } from "./hooks/useKeyboardShortcuts";

const SHORTCUTS: KeyboardShortcut[] = [
  { key: "k", meta: true, action: () => {}, description: "Abrir Command Palette" },
  { key: "1", meta: true, action: () => {}, description: "Aba Containers" },
  { key: "2", meta: true, action: () => {}, description: "Aba Images" },
  { key: "3", meta: true, action: () => {}, description: "Aba Volumes" },
  { key: "4", meta: true, action: () => {}, description: "Aba Networks" },
  { key: "5", meta: true, action: () => {}, description: "Aba Kubernetes" },
  { key: "6", meta: true, action: () => {}, description: "Aba Doctor" },
  { key: "7", meta: true, action: () => {}, description: "Aba Profiles" },
  { key: "b", meta: true, action: () => {}, description: "Toggle Sidebar" },
  { key: "Escape", action: () => {}, description: "Fechar painéis/modais" },
  { key: "ArrowDown", action: () => {}, description: "Próximo item/lista" },
  { key: "ArrowUp", action: () => {}, description: "Item anterior/lista" },
  { key: "Enter", action: () => {}, description: "Confirmar/Ação principal" },
  { key: "a", meta: true, shift: true, action: () => {}, description: "AI Assistant" },
  { key: "n", meta: true, action: () => {}, description: "Novo container" },
  { key: "p", meta: true, action: () => {}, description: "Pull image" },
  { key: "n", meta: true, shift: true, action: () => {}, description: "Novo profile" },
  { key: "d", meta: true, action: () => {}, description: "Doctor checks" },
];

const CATEGORIES = [
  { name: "Navegação", shortcuts: [0, 1, 2, 3, 4, 5, 6, 9] },
  { name: "Ações", shortcuts: [0, 10, 11, 12, 13, 14, 15] },
  { name: "Navegação em Listas", shortcuts: [7, 8] },
];

function formatShortcut(s: KeyboardShortcut): string {
  const parts: string[] = [];
  if (s.meta) parts.push("⌘");
  if (s.ctrl) parts.push("Ctrl");
  if (s.shift) parts.push("⇧");
  if (s.alt) parts.push("⌥");
  parts.push(s.key.length === 1 ? s.key.toUpperCase() : s.key);
  return parts.join(" + ");
}

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [isOpen]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return createPortal(
    <div className="help-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="help-modal" role="document">
        <div className="help-header">
          <h2 id="help-title">Atalhos de Teclado</h2>
          <button className="help-close" onClick={onClose} aria-label="Close" type="button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="help-content">
          {[
            { name: "Navegação", shortcuts: [0, 1, 2, 3, 4, 5, 6, 9] },
            { name: "Ações", shortcuts: [0, 10, 11, 12, 13, 14, 15] },
            { name: "Navegação em Listas", shortcuts: [7, 8] },
          ].map((cat, i) => (
            <div key={i} className="help-category">
              <h3 className="help-category-title">{cat.name}</h3>
              <dl className="help-shortcuts-list">
                {cat.shortcuts.map((idx) => {
                  const s = SHORTCUTS[idx];
                  return (
                    <div key={`${s.key}-${s.meta}-${s.shift}-${idx}`} className="help-shortcut-row">
                      <kbd className="help-shortcut">{formatShortcut(s)}</kbd>
                      <dd className="help-shortcut-desc">{s.description}</dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>
        <div className="help-footer">
          <Button variant="primary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}


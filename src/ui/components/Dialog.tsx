import { ReactNode, useEffect, useRef, useCallback } from "react";
import { Portal } from "./Portal";
import { Icon, IconName } from "../icons";
import { Button } from "./Button";
import { FocusTrap } from "./FocusTrap";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: DialogSize;
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  footer?: ReactNode;
}

const sizeClasses: Record<DialogSize, string> = {
  sm: "max-w-[360px]",
  md: "max-w-[480px]",
  lg: "max-w-[640px]",
  xl: "max-w-[800px]",
  full: "max-w-[calc(100%-48px)]",
};

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  footer,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && closeOnEscape) {
      onClose();
    }
  }, [closeOnEscape]);

  useEffect(() => {
    if (!isOpen) return;
    previousActiveElement.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-bg-overlay p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget && closeOnOverlayClick) onClose();
        }}
        role="presentation"
      >
        <div
          ref={dialogRef}
          className={`dialog flex max-h-full w-full flex-col overflow-hidden rounded-xl bg-bg-raised shadow-floating ${sizeClasses[size]}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "dialog-title" : undefined}
          aria-describedby={description ? "dialog-description" : undefined as string | undefined}
        >
          {(title || showCloseButton) && (
            <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
              {title && <h2 id="dialog-title" className="text-title font-semibold text-fg">{title}</h2>}
              {description && <p id="dialog-description" className="mt-1 text-body text-fg-muted">{description}</p>}
              {showCloseButton && (
                <button
                  className="shrink-0 rounded-md p-1 text-fg-muted hover:bg-tile-hover hover:text-fg"
                  onClick={onClose}
                  aria-label="Close"
                  type="button"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  position?: DrawerPosition;
  size?: DrawerSize;
  footer?: ReactNode;
}

type DrawerSize = "sm" | "md" | "lg" | "full";
type DrawerPosition = "right" | "left" | "bottom";

const drawerSizeClasses: Record<DrawerSize, string> = {
  sm: "w-[320px]",
  md: "w-[400px]",
  lg: "w-[560px]",
  full: "w-full max-w-[calc(100%-24px)]",
} as const;

const drawerPositionClasses: Record<DrawerPosition, string> = {
  right: "right-0",
  left: "left-0",
  bottom: "bottom-0",
} as const;

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  position = "right",
  size = "md",
  footer,
}: DrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    previousActiveElement.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 bg-bg-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="presentation"
      >
        <div
          ref={drawerRef}
          className={`drawer flex flex-col bg-bg-raised shadow-floating ${drawerPositionClasses[position]} ${drawerSizeClasses[size]}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "drawer-title" : undefined}
        >
          {(title) && (
            <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4">
              <h2 id="drawer-title" className="text-title font-semibold text-fg">{title}</h2>
              <button className="shrink-0 rounded-md p-1 text-fg-muted hover:bg-tile-hover hover:text-fg" onClick={onClose} aria-label="Close" type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
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
        className="dialog-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget && closeOnOverlayClick) onClose();
        }}
        role="presentation"
      >
        <div
          ref={dialogRef}
          className={`dialog ${sizeClasses[size]}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "dialog-title" : undefined}
          aria-describedby={description ? "dialog-description" : undefined as string | undefined}
        >
          {(title || showCloseButton) && (
            <div className="dialog-header">
              {title && <h2 id="dialog-title" className="dialog-title">{title}</h2>}
              {description && <p id="dialog-description" className="dialog-description">{description}</p>}
              {showCloseButton && (
                <button
                  className="dialog-close"
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
          <div className="dialog-content">{children}</div>
          {footer && <div className="dialog-footer">{footer}</div>}
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
        className="drawer-overlay"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        role="presentation"
      >
        <div
          ref={drawerRef}
          className={`drawer ${drawerPositionClasses[position]} ${drawerSizeClasses[size]}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "drawer-title" : undefined}
        >
          {(title) && (
            <div className="drawer-header">
              <h2 id="drawer-title" className="drawer-title">{title}</h2>
              <button className="drawer-close" onClick={onClose} aria-label="Close" type="button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <div className="drawer-content">{children}</div>
          {footer && <div className="drawer-footer">{footer}</div>}
        </div>
      </div>
    </Portal>
  );
}
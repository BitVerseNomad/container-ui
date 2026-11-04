import { useEffect, useRef, useCallback } from "react";

interface FocusTrapProps {
  children: React.ReactNode;
  enabled?: boolean;
  onEscape?: () => void;
  clickOutsideToClose?: boolean;
}

export function FocusTrap({
  children,
  enabled = true,
  onEscape,
  clickOutsideToClose,
}: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;
    if (e.key === "Tab") {
      const focusableElements = containerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements?.[0];
      const lastElement = focusableElements?.[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    }
    if (e.key === "Escape" && onEscape) {
      onEscape();
    }
  }, [enabled, onEscape]);

  useEffect(() => {
    if (!enabled) return;
    previousActiveElement.current = document.activeElement as HTMLElement;
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousActiveElement.current?.focus();
    };
  }, [enabled, handleKeyDown]);

  return (
    <div
      ref={containerRef}
      onClick={(e) => {
        if (clickOutsideToClose && e.target === e.currentTarget) {
          // Handled by parent
        }
      }}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
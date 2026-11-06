import { Fragment, HTMLAttributes, ReactNode, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { clsx } from "clsx";
import { X } from "./icons";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export interface DialogTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  asChild?: boolean;
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
};

export function Dialog({
  open,
  onOpenChange,
  children,
  title,
  description,
  size = "md",
}: DialogProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (open) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = "hidden";
      // Focus trap
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onOpenChange(false);
        }
        if (e.key === "Tab" && contentRef.current) {
          const focusableElements = contentRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      // Focus first focusable element or close button
      // Use requestAnimationFrame to ensure portal has mounted
      requestAnimationFrame(() => {
        const firstFocusable = contentRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      });
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
        previousActiveElement.current?.focus();
      };
    }
  }, [open, onOpenChange]);

  if (!open) return null;

  return createPortal(
    <Fragment>
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[var(--z-modal)] animate-fade-in"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[calc(var(--z-modal)+1)] w-full max-h-[90vh] overflow-hidden animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
      >
        <div className={clsx("bg-[var(--color-bg-primary)] rounded-xl shadow-[var(--color-shadow-xl)] w-full", sizes[size])}>
          {(title || description) && (
            <div className="px-6 py-4 border-b border-[var(--color-border-light)] flex items-start justify-between gap-4">
              <div>
                {title && (
                  <h2
                    id="dialog-title"
                    className="text-lg font-semibold text-[var(--color-fg-primary)]"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="dialog-description" className="text-sm text-[var(--color-fg-tertiary)] mt-1">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="p-1 rounded-lg text-[var(--color-fg-tertiary)] hover:text-[var(--color-fg-primary)] hover:bg-[var(--color-bg-hover)] transition-colors flex-shrink-0"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}
          <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">{children}</div>
        </div>
      </div>
    </Fragment>,
    document.body
  );
}

export function DialogContent({ children, className, ...props }: DialogContentProps) {
  return <div className={clsx(className)} {...props}>{children}</div>;
}

export function DialogHeader({ children, className, ...props }: DialogHeaderProps) {
  return <div className={clsx("mb-4", className)} {...props}>{children}</div>;
}

export function DialogTitle({ children, className, ...props }: DialogTitleProps) {
  return <h3 className={clsx("text-lg font-semibold text-[var(--color-fg-primary)]", className)} {...props}>{children}</h3>;
}

export function DialogDescription({ children, className, ...props }: DialogDescriptionProps) {
  return <p className={clsx("text-sm text-[var(--color-fg-tertiary)] mt-1", className)} {...props}>{children}</p>;
}

export function DialogFooter({ children, className, ...props }: DialogFooterProps) {
  return (
    <div
      className={clsx("mt-6 flex items-center justify-end gap-3", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function DialogTrigger({ children, className, asChild, ...props }: DialogTriggerProps) {
  if (asChild) {
    return children;
  }
  return <button type="button" className={clsx(className)} {...props}>{children}</button>;
}
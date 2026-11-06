import { ReactNode, useState, useEffect, useCallback, createContext, useContext, useMemo } from "react";
import { createPortal } from "react-dom";
import { Icon, IconName } from "../icons";

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  onClose: (id: string) => void;
}

const typeStyles: Record<ToastType, { bg: string; icon: IconName; border: string }> = {
  success: { bg: "color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent)", icon: "tick", border: "var(--md-sys-color-primary)" },
  error: { bg: "color-mix(in srgb, var(--md-sys-color-error) 12%, transparent)", icon: "alert", border: "var(--md-sys-color-error)" },
  warning: { bg: "color-mix(in srgb, var(--md-sys-color-warning) 12%, transparent)", icon: "alert", border: "var(--md-sys-color-warning)" },
  info: { bg: "color-mix(in srgb, var(--md-sys-color-primary) 12%, transparent)", icon: "info", border: "var(--md-sys-color-primary)" },
};

function ToastItem({ toast, onClose }: { toast: ToastState; onClose: (id: string) => void }) {
  const { type, title, message, action, duration = 5000 } = toast;
  const style = typeStyles[type];

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(toast.id), duration);
      return () => clearTimeout(timer);
    }
  }, [toast.id, duration, onClose]);

  return (
    <div className="toast" role="alert" aria-live="polite" style={{ borderLeft: `4px solid ${style.border}` }}>
      <div className="toast-content">
        <Icon name={style.icon} size={20} className="toast-icon" style={{ color: style.border }} aria-hidden="true" />
        <div className="toast-text">
          <div className="toast-title">{title}</div>
          {message && <div className="toast-message">{message}</div>}
        </div>
        {action && (
          <button className="toast-action" onClick={action.onClick}>
            {action.label}
          </button>
        )}
      </div>
      <button className="toast-close" onClick={() => onClose(toast.id)} aria-label="Dismiss">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastState[];
  onClose: (id: string) => void;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left" | "top-center" | "bottom-center";
}

const positionClasses = {
  "top-right": "top-4 right-4",
  "top-left": "top-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
};

export function ToastContainer({ toasts, onClose, position = "top-right" }: ToastContainerProps) {
  if (typeof window === "undefined") return null;

  const container = document.getElementById("toast-container");
  if (!container) {
    const div = document.createElement("div");
    div.id = "toast-container";
    div.className = `fixed z-[var(--z-60)] ${positionClasses[position]} flex flex-col gap-2 pointer-events-none`;
    document.body.appendChild(div);
  }

  if (toasts.length === 0) return null;

  return createPortal(
    <div id="toast-container-inner" className="flex flex-col gap-2 pointer-events-auto" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={onClose} />
      ))}
    </div>,
    document.getElementById("toast-container") || document.body
  );
}

export interface ToastState {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
  onClose: (id: string) => void;
}

interface ToastContextValue {
  toasts: ToastState[];
  show: (toast: Omit<ToastState, "id" | "onClose">) => string;
  close: (id: string) => void;
  success: (title: string, message?: string, action?: { label: string; onClick: () => void }) => string;
  error: (title: string, message?: string, action?: { label: string; onClick: () => void }) => string;
  warning: (title: string, message?: string, action?: { label: string; onClick: () => void }) => string;
  info: (title: string, message?: string, action?: { label: string; onClick: () => void }) => string;
}

// Default no-op context for tests and components outside provider
const noopToastContext: ToastContextValue = {
  toasts: [],
  show: () => "",
  close: () => {},
  success: () => "",
  error: () => "",
  warning: () => "",
  info: () => "",
};

const ToastContext = createContext<ToastContextValue>(noopToastContext);

export function ToastProvider({ children, position = "top-right" }: { children: ReactNode; position?: ToastContainerProps["position"] }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);

  const close = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((toast: Omit<ToastState, "id" | "onClose">) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { ...toast, id, onClose: close }]);
    return id;
  }, [close]);

  const success = useCallback((title: string, message?: string, action?: { label: string; onClick: () => void }) => show({ type: "success", title, message, action, duration: 5000 }), [show]);
  const error = useCallback((title: string, message?: string, action?: { label: string; onClick: () => void }) => show({ type: "error", title, message, action, duration: 8000 }), [show]);
  const warning = useCallback((title: string, message?: string, action?: { label: string; onClick: () => void }) => show({ type: "warning", title, message, action, duration: 6000 }), [show]);
  const info = useCallback((title: string, message?: string, action?: { label: string; onClick: () => void }) => show({ type: "info", title, message, action, duration: 5000 }), [show]);

  const value = useMemo<ToastContextValue>(() => ({ toasts, show, close, success, error, warning, info }), [toasts, show, close, success, error, warning, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onClose={close} position={position} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  return context;
}

export type { ToastProps };
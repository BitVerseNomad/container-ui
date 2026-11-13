import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import { usePortalContainer } from "./Portal";

export type ToastOptions = { text: string; action?: { label: string; onSelect: () => void } };

type Toast = (options: ToastOptions) => void;

const ToastContext = createContext<Toast | null>(null);

export function ToastProvider(props: { children: React.ReactNode }): React.JSX.Element {
  const [toast, setToast] = useState<{ options: ToastOptions; id: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(0);
  const remaining = useRef(6000);
  const pausedRef = useRef(false);
  const container = usePortalContainer();

  const show = useCallback<Toast>((options) => {
    remaining.current = 6000;
    pausedRef.current = false;
    setPaused(false);
    nextId.current += 1;
    setToast({ options, id: nextId.current });
  }, []);

  useEffect(() => {
    if (!toast || paused) return;
    const left = remaining.current;
    const start = Date.now();
    const timer = setTimeout(() => setToast(null), left);
    return () => {
      clearTimeout(timer);
      if (pausedRef.current) remaining.current = Math.max(0, left - (Date.now() - start));
    };
  }, [toast, paused]);

  function setPause(next: boolean): void {
    pausedRef.current = next;
    setPaused(next);
  }

  return (
    <ToastContext.Provider value={show}>
      {props.children}
      {toast &&
        createPortal(
          <div
            className="toast"
            role="status"
            onMouseEnter={() => setPause(true)}
            onMouseLeave={() => setPause(false)}
          >
            <span>{toast.options.text}</span>
            {toast.options.action && (
              <Button
                size="xs"
                onClick={() => {
                  toast.options.action?.onSelect();
                  setToast(null);
                }}
              >
                {toast.options.action.label}
              </Button>
            )}
          </div>,
          container ?? document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast(): Toast {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast must be used inside ToastProvider");
  return toast;
}
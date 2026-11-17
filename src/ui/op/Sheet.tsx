import React, { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { clsx } from "clsx";
import { Button } from "./Button";
import { usePortalContainer } from "./Portal";

export function Sheet(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  hideTitle?: boolean;
  fact?: string;
  busy?: boolean;
  stack?: boolean;
  footer?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  const { open, onClose, title, hideTitle, fact, busy, stack, footer, children } = props;
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const container = usePortalContainer();

  useEffect(() => {
    if (open) return;
    restoreRef.current?.focus();
    restoreRef.current = null;
  }, [open]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) onClose();
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bg-overlay" />
        <Dialog.Content
          className="sheet z-50"
          aria-describedby={undefined}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (busy) event.preventDefault();
          }}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            restoreRef.current = document.activeElement as HTMLElement | null;
            const first = bodyRef.current?.querySelector<HTMLElement>("input, select, textarea");
            (first ?? closeRef.current)?.focus();
          }}
        >
          <div className="flex h-header shrink-0 items-center gap-2 border-b border-line px-4">
            <Dialog.Title className={hideTitle ? "sr-only" : undefined}>{title}</Dialog.Title>
            {fact && <span className="text-fg-muted font-mono">{fact}</span>}
            <span className="grow" />
            <Dialog.Close asChild>
              <Button ref={closeRef} variant="ghost" iconOnly icon="close" aria-label="Close" />
            </Dialog.Close>
          </div>
          <div ref={bodyRef} className={clsx("sheet-body", stack && "stack")}>
            {children}
          </div>
          {footer && <div className="sheet-foot flex shrink-0 items-center justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
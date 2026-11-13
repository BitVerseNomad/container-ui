import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Button } from "./Button";
import { Checkbox } from "./Checkbox";
import { Command } from "./Command";
import { usePortalContainer } from "./Portal";

export type ConfirmOptions = {
  title: string;
  body: React.ReactNode;
  command?: string;
  confirm: string;
  danger?: boolean;
  option?: { label: string; checked: boolean; onChange: (checked: boolean) => void };
};

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

export function ConfirmProvider(props: { children: React.ReactNode }): React.JSX.Element {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [optionChecked, setOptionChecked] = useState(false);
  const resolver = useRef<((answer: boolean) => void) | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const container = usePortalContainer();

  const finish = useCallback((answer: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setOptions(null);
    resolve?.(answer);
  }, []);

  const confirm = useCallback<Confirm>((nextOptions) => {
    resolver.current?.(false);
    setOptions(nextOptions);
    setOptionChecked(nextOptions.option?.checked ?? false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {props.children}
      {options && (
        <AlertDialog.Root open onOpenChange={(open) => { if (!open) finish(false); }}>
          <AlertDialog.Portal container={container}>
            <AlertDialog.Overlay className="overlay" />
            <AlertDialog.Content
              className="dialog"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                (options.danger ? cancelRef.current : confirmRef.current)?.focus();
              }}
            >
              <AlertDialog.Title asChild>
                <h2>{options.title}</h2>
              </AlertDialog.Title>
              <AlertDialog.Description asChild>
                <p>{options.body}</p>
              </AlertDialog.Description>
              {options.option && (
                <Checkbox
                  checked={optionChecked}
                  onChange={(checked) => {
                    setOptionChecked(checked);
                    options.option?.onChange(checked);
                  }}
                >
                  {options.option.label}
                </Checkbox>
              )}
              {options.command && <Command text={options.command} />}
              <div className="foot">
                <AlertDialog.Cancel asChild>
                  <Button ref={cancelRef} size="md" onClick={() => finish(false)}>Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button
                    ref={confirmRef}
                    size="md"
                    variant={options.danger ? "danger" : "primary"}
                    onClick={() => finish(true)}
                  >
                    {options.confirm}
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside ConfirmProvider");
  return confirm;
}
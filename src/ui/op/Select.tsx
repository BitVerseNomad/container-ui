import React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { clsx } from "clsx";
import { Icon } from "./Icon";

export type SelectOption = { value: string; label: string; hint?: string };

export function Select(props: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  "aria-label": string;
  size?: "sm" | "md";
  width?: "pick" | "num";
  disabled?: boolean;
  className?: string;
}): React.JSX.Element {
  const { value, onChange, options, size = "sm", width, disabled, className, ...rest } = props;
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger data-op="" className={clsx("field select-field", size === "md" && "md", width, className)} {...rest}>
        <SelectPrimitive.Value />
        <Icon name="chev-down" size="sm" />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-50 min-w-32 overflow-hidden rounded-md border border-edge bg-bg-raised p-1 shadow-floating">
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item key={option.value} className="menu-item" value={option.value}>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                {option.hint && <span className="text-meta text-fg-muted">{option.hint}</span>}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

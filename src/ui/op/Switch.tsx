import React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import { clsx } from "clsx";

export function Switch(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  "aria-labelledby": string;
  disabled?: boolean;
  className?: string;
}): React.JSX.Element {
  const { checked, onChange, disabled, className, ...rest } = props;
  return (
    <SwitchPrimitive.Root
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className={clsx("switch", className)}
      {...rest}
    />
  );
}

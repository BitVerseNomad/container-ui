import React from "react";
import { clsx } from "clsx";

export function Checkbox(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  const { checked, onChange, disabled, children, className } = props;
  return (
    <label data-op="" className={clsx("checkline", className)}>
      <input
        type="checkbox"
        className="check"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}

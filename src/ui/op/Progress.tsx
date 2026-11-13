import React from "react";
import { clsx } from "clsx";

export function Progress(props: { value: number | null; max?: number; "aria-label": string; className?: string }): React.JSX.Element {
  const { value, max = 1, className, ...rest } = props;
  return (
    <progress
      className={clsx("progress", className)}
      value={value ?? undefined}
      max={max}
      {...rest}
    />
  );
}

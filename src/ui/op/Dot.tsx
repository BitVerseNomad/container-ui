import React from "react";
import { clsx } from "clsx";

export type DotState = "ok" | "warn" | "bad" | "busy" | "off";

export function Dot(props: { state: DotState; label?: string; className?: string }): React.JSX.Element {
  const { state, label, className } = props;
  return (
    <span
      className={clsx("dot", state !== "off" && state, className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
    />
  );
}

import React, { forwardRef } from "react";
import { clsx } from "clsx";
import { Icon, type IconName } from "./Icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "xs" | "sm" | "md";
  icon?: IconName;
  iconOnly?: boolean;
  busy?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "sm", icon, iconOnly, busy, className, children, onClick, ...rest },
  ref,
) {
  const dev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV;
  if (dev && iconOnly && !rest["aria-label"]) console.error("Button: iconOnly needs aria-label");
  return (
    <button
      {...rest}
      ref={ref}
      type="button"
      className={clsx("btn", variant !== "default" && variant, size !== "sm" && size, iconOnly && "icon-only", className)}
      aria-busy={busy ? "true" : undefined}
      onClick={(event) => {
        if (busy) return;
        onClick?.(event);
      }}
    >
      {busy ? <span className="spinner" /> : icon ? <Icon name={icon} size="sm" /> : null}
      {!iconOnly && children}
    </button>
  );
});

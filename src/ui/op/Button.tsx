import React, { forwardRef } from "react";
import { clsx } from "clsx";
import { cn } from "../utils";
import { Icon, type IconName } from "./Icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "danger-quiet" | "ghost";
  size?: "xs" | "sm" | "md";
  icon?: IconName;
  iconOnly?: boolean;
  busy?: boolean;
};

// container-ui.css sets `button` and `a` colours outside any layer, so they beat plain utilities. The ! variants win over them.
const variants = {
  variant: {
    default: "bg-bg-raised text-fg !text-fg shadow-btn",
    primary: "primary bg-accent text-on-accent !text-on-accent shadow-control",
    danger: "bg-bad-fill text-bad !text-bad shadow-danger",
    "danger-quiet": "danger-quiet text-bad !text-bad hover:bg-bad-fill",
    ghost: "text-fg-muted !text-fg-muted hover:bg-tile-hover",
  },
  size: {
    xs: "h-h-xs px-8 rounded-sm text-micro",
    sm: "h-h-sm px-10 rounded-radius-md rounded-md text-meta",
    md: "h-h-md px-12 rounded-md text-body",
  },
} as const;

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
      data-op=""
      className={clsx(
        cn("inline-flex items-center justify-center gap-6 whitespace-nowrap", variants.size[size]),
        variants.variant[variant],
        iconOnly && "w-h-sm px-0",
        className,
      )}
      aria-busy={busy ? "true" : undefined}
      onClick={(event) => {
        if (busy) return;
        onClick?.(event);
      }}
    >
      {busy ? <span className="inline-block size-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" /> : icon ? <Icon name={icon} size="sm" /> : null}
      {!iconOnly && children}
    </button>
  );
});

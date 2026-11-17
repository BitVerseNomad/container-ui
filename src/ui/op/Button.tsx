import React, { forwardRef } from "react";
import { clsx } from "clsx";
import { cn } from "../utils";
import { Icon, type IconName } from "./Icon";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "danger" | "ghost";
  size?: "xs" | "sm" | "md";
  icon?: IconName;
  iconOnly?: boolean;
  busy?: boolean;
};

const variants = {
  variant: {
    default: "bg-bg-raised text-fg shadow-btn",
    primary: "bg-accent text-on-accent shadow-control",
    danger: "bg-bad-fill text-bad shadow-danger",
    ghost: "text-fg-muted hover:bg-tile-hover",
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

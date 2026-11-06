import { HTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info" | "outline";
  size?: "sm" | "md";
  dot?: boolean;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "md", dot, children, ...props }, ref) => {
    const variants = {
      default: "bg-[var(--color-bg-tertiary)] text-[var(--color-fg-secondary)]",
      success: "bg-[var(--color-brand-success)]/15 text-[var(--color-brand-success)] border-[var(--color-brand-success)]/30",
      warning: "bg-[var(--color-brand-warning)]/15 text-[var(--color-brand-warning)] border-[var(--color-brand-warning)]/30",
      danger: "bg-[var(--color-brand-danger)]/15 text-[var(--color-brand-danger)] border-[var(--color-brand-danger)]/30",
      info: "bg-[var(--color-brand-info)]/15 text-[var(--color-brand-info)] border-[var(--color-brand-info)]/30",
      outline: "bg-transparent text-[var(--color-fg-secondary)] border-[var(--color-border-medium)]",
    };

    const sizes = {
      sm: "px-2 py-0.5 text-xs gap-1",
      md: "px-2.5 py-1 text-xs gap-1.5",
    };

    return (
      <span
        ref={ref}
        className={clsx(
          "inline-flex items-center font-medium rounded-full border",
          "transition-colors duration-150",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              variant === "success" && "bg-[var(--color-brand-success)]",
              variant === "warning" && "bg-[var(--color-brand-warning)]",
              variant === "danger" && "bg-[var(--color-brand-danger)]",
              variant === "info" && "bg-[var(--color-brand-info)]",
              variant === "default" && "bg-[var(--color-fg-tertiary)]",
              variant === "outline" && "bg-[var(--color-fg-tertiary)]",
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);
Badge.displayName = "Badge";
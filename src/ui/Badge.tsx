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
      default: "bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[var(--color-accent)]/20",
      success: "bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border border-[var(--color-success)]/20",
      warning: "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border border-[var(--color-warning)]/20",
      danger: "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border border-[var(--color-danger)]/20",
      info: "bg-[var(--color-info-bg)] text-[var(--color-info-fg)] border border-[var(--color-info)]/20",
      outline: "bg-transparent text-[var(--color-fg)] border border-[var(--color-border)]",
    };

    const sizes = {
      sm: "px-2 py-0.5 text-xs gap-1",
      md: "px-2.5 py-1 text-xs gap-1.5",
    };

    return (
      <span
        ref={ref}
        className={clsx(
          "inline-flex items-center font-medium rounded-sm border",
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
              variant === "success" && "bg-[var(--color-success)]",
              variant === "warning" && "bg-[var(--color-warning)]",
              variant === "danger" && "bg-[var(--color-danger)]",
              variant === "info" && "bg-[var(--color-info)]",
              variant === "default" && "bg-[var(--color-accent)]",
              variant === "outline" && "bg-[var(--color-fg-muted)]",
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
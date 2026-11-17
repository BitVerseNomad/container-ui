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
      default: "bg-accent-fill text-accent border border-accent/20",
      success: "bg-ok-fill text-ok border border-ok/20",
      warning: "bg-warn-fill text-warn border border-warn/20",
      danger: "bg-bad-fill text-bad border border-bad/20",
      info: "bg-info-fill text-info border border-info/20",
      outline: "bg-transparent text-fg border border-line",
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
              variant === "success" && "bg-ok",
              variant === "warning" && "bg-warn",
              variant === "danger" && "bg-bad",
              variant === "info" && "bg-info",
              variant === "default" && "bg-accent",
              variant === "outline" && "bg-fg-muted",
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
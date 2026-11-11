import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[var(--color-accent)]/20",
        secondary:
          "bg-[var(--color-border)] text-[var(--color-fg)] border border-[var(--color-border)]",
        destructive:
          "bg-[var(--color-danger-bg)] text-[var(--color-danger-fg)] border border-[var(--color-danger)]/20",
        outline: "text-[var(--color-fg)] border border-[var(--color-border)]",
        success:
          "bg-[var(--color-success-bg)] text-[var(--color-success-fg)] border border-[var(--color-success)]/20",
        warning:
          "bg-[var(--color-warning-bg)] text-[var(--color-warning-fg)] border border-[var(--color-warning)]/20",
        info:
          "bg-[var(--color-info-bg)] text-[var(--color-info-fg)] border border-[var(--color-info)]/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
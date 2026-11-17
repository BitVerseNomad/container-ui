import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-accent-fill text-accent border border-accent/20",
        secondary:
          "bg-line text-fg border border-line",
        destructive:
          "bg-bad-fill text-bad border border-bad/20",
        outline: "text-fg border border-line",
        success:
          "bg-ok-fill text-ok border border-ok/20",
        warning:
          "bg-warn-fill text-warn border border-warn/20",
        info:
          "bg-info-fill text-info border border-info/20",
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
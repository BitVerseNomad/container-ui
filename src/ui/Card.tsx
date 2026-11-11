import { forwardRef, HTMLAttributes } from "react";
import { clsx } from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "outlined" | "elevated";
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", padding = "md", children, ...props }, ref) => {
    const variants = {
      default: "bg-[var(--color-bg-elevated)] border border-[var(--color-border)]",
      outlined: "bg-transparent border-2 border-[var(--color-border)]",
      elevated: "bg-[var(--color-bg-elevated)] shadow-[0_4px_8px_rgba(0,0,0,0.08)] border-none",
    };

    const paddings = {
      none: "",
      sm: "p-3",
      md: "p-4",
      lg: "p-6",
    };

    return (
      <div
        ref={ref}
        className={clsx(
          "rounded-md transition-all duration-200",
          variants[variant],
          paddings[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx("mb-3", className)}
      {...props}
    >
      {children}
    </div>
  )
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3
      ref={ref}
      className={clsx("text-heading leading-none", className)}
      {...props}
    >
      {children}
    </h3>
  )
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement>>(
  ({ className, children, ...props }, ref) => (
    <p
      ref={ref}
      className={clsx("text-[var(--color-fg-muted)] text-body-sm", className)}
      {...props}
    >
      {children}
    </p>
  )
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div ref={ref} className={clsx(className)} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx("mt-4 pt-4 border-t border-[var(--color-border)] flex items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  )
);
CardFooter.displayName = "CardFooter";

export default Card;
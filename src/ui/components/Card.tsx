import { ReactNode, HTMLAttributes, forwardRef } from "react";

export type CardVariant = "elevated" | "outlined" | "filled";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const variantClasses: Record<CardVariant, string> = {
  elevated: "bg-[var(--md-sys-color-surface)] shadow-[var(--shadow-2)] border-transparent",
  outlined: "bg-[var(--md-sys-color-surface)] border-[var(--md-sys-color-outline)] shadow-none",
  filled: "bg-[var(--md-sys-color-surface-variant)] border-transparent shadow-none",
};

type PaddingValue = "none" | "sm" | "md" | "lg";

const paddingClasses: Record<PaddingValue, string> = {
  none: "",
  sm: "p-[var(--space-3)]",
  md: "p-[var(--space-4)]",
  lg: "p-[var(--space-5)]",
};

function getPaddingClass(padding: PaddingValue | undefined): string {
  return padding ? paddingClasses[padding] : "";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = "elevated", interactive, padding = "md", className = "", style, onClick, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          rounded-[var(--radius-lg)] transition-all duration-150 ease-[var(--motion-ease)]
          ${variantClasses[variant]} ${getPaddingClass(padding)} ${className}
          ${interactive ? "cursor-pointer hover:shadow-[var(--shadow-3)] active:shadow-[var(--shadow-1)]" : ""}
        `}
        style={style}
        onClick={onClick}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={(e) => { if (interactive && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick?.(e as any); } }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {}
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = "", ...props }, ref) => (
    <div ref={ref} className={`mb-[var(--space-3)] ${className}`} {...props}>{children}</div>
  )
);
CardHeader.displayName = "CardHeader";

export interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {}
export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className = "", ...props }, ref) => (
    <h3 ref={ref} className={`text-[var(--text-xl)] font-semibold text-[var(--md-sys-color-on-surface)] ${className}`} {...props}>{children}</h3>
  )
);
CardTitle.displayName = "CardTitle";

export interface CardDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}
export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ children, className = "", ...props }, ref) => (
    <p ref={ref} className={`text-[var(--text-sm)] text-[var(--md-sys-color-on-surface-variant)] mt-1 ${className}`} {...props}>{children}</p>
  )
);
CardDescription.displayName = "CardDescription";

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {}
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = "", ...props }, ref) => (
    <div ref={ref} className={className} {...props}>{children}</div>
  )
);
CardContent.displayName = "CardContent";

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {}
export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = "", ...props }, ref) => (
    <div ref={ref} className={`flex items-center gap-[var(--space-2)] mt-[var(--space-4)] pt-[var(--space-3)] border-t border-[var(--md-sys-color-outline-variant)] ${className}`} {...props}>{children}</div>
  )
);
CardFooter.displayName = "CardFooter";

export type { CardProps };
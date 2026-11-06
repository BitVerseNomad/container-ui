import { forwardRef, ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, fullWidth, disabled, children, ...props }, ref) => {
    const baseStyles = [
      "inline-flex items-center justify-center font-medium rounded-lg",
      "transition-colors duration-150 ease",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      "disabled:opacity-50 disabled:pointer-events-none",
      "active:scale-[0.98]",
    ];

    const variants = {
      primary: [
        "bg-[var(--color-brand-primary)] text-white",
        "hover:bg-[var(--color-brand-primary-hover)]",
        "focus-visible:ring-[var(--color-brand-primary)]",
      ],
      secondary: [
        "bg-[var(--color-bg-tertiary)] text-[var(--color-fg-primary)]",
        "hover:bg-[var(--color-bg-hover)]",
        "focus-visible:ring-[var(--color-border-medium)]",
      ],
      outline: [
        "border border-[var(--color-border-medium)] bg-transparent",
        "hover:bg-[var(--color-bg-hover)]",
        "focus-visible:ring-[var(--color-border-medium)]",
      ],
      ghost: [
        "bg-transparent",
        "hover:bg-[var(--color-bg-hover)]",
        "focus-visible:ring-[var(--color-border-medium)]",
      ],
      danger: [
        "bg-[var(--color-brand-danger)] text-white",
        "hover:bg-[var(--color-brand-danger)]/90",
        "focus-visible:ring-[var(--color-brand-danger)]",
      ],
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm gap-1.5",
      md: "px-4 py-2 text-sm gap-2",
      lg: "px-6 py-3 text-base gap-2",
      icon: "p-2",
    };

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], fullWidth && "w-full", className)}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
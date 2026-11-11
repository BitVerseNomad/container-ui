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
      "inline-flex items-center justify-center font-medium rounded-sm",
      "transition-colors duration-150 ease",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      "focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-[var(--color-bg)]",
      "disabled:opacity-50 disabled:pointer-events-none",
      "active:scale-[0.98]",
    ];

    const variants = {
      primary: [
        "bg-[var(--color-accent)] text-white",
        "hover:bg-[var(--color-accent-hover)]",
      ],
      secondary: [
        "bg-[var(--color-border)] text-[var(--color-fg)]",
        "hover:bg-[var(--color-border)]/80",
      ],
      outline: [
        "border border-[var(--color-border)] bg-transparent",
        "hover:bg-[var(--color-accent-muted)] hover:text-[var(--color-accent)]",
      ],
      ghost: [
        "bg-transparent",
        "hover:bg-[var(--color-border)] hover:text-[var(--color-fg)]",
      ],
      danger: [
        "bg-[var(--color-danger)] text-white",
        "hover:bg-[var(--color-danger)]/90",
      ],
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-sm gap-2",
      lg: "h-10 px-6 text-base gap-2",
      icon: "h-9 w-9",
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
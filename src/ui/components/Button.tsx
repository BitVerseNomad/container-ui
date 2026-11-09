import { ReactNode, ButtonHTMLAttributes, forwardRef } from "react";
import { Icon, IconName } from "../icons";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "text";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconOnly?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-[var(--color-brand-primary)] text-[var(--color-on-primary)] border-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] active:bg-[var(--color-brand-primary)]",
  secondary: "bg-[var(--color-bg-tertiary)] text-[var(--color-fg-primary)] border-[var(--color-border-medium)] hover:bg-[var(--color-bg-hover)] active:bg-[var(--color-bg-active)]",
  ghost: "bg-transparent text-[var(--color-brand-primary)] border-transparent hover:bg-[var(--color-brand-primary-light)] active:bg-[var(--color-brand-primary-light)]",
  danger: "bg-[var(--color-brand-danger)] text-[var(--color-on-primary)] border-[var(--color-brand-danger)] hover:bg-[var(--color-brand-danger)]/90 active:bg-[var(--color-brand-danger)]",
  text: "bg-transparent text-[var(--color-brand-primary)] border-transparent hover:bg-[var(--color-brand-primary-light)] active:bg-[var(--color-brand-primary-light)] px-0",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5 min-h-[32px]",
  md: "px-4 py-2 text-sm gap-2 min-h-[40px]",
  lg: "px-5 py-2.5 text-base gap-2.5 min-h-[48px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = "primary", size = "md", icon, iconOnly, loading, fullWidth, disabled, className = "", style, ...props }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type="button"
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center font-medium rounded-[var(--radius-md)]
          border transition-colors duration-150 ease-[var(--motion-ease)]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]
          focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--md-sys-color-surface)]
          disabled:opacity-50 disabled:cursor-not-allowed
          ${fullWidth ? "w-full" : ""}
          ${variantClasses[variant]} ${sizeClasses[size]} ${className}
        `}
        style={{ ...style, ...(iconOnly ? { padding: "0", width: "var(--space-4)" } : {}) }}
        aria-busy={loading}
        aria-disabled={isDisabled}
        {...props}
      >
        {loading ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : icon && !iconOnly ? (
          <Icon name={icon} size={size === "sm" ? 12 : size === "md" ? 14 : 16} aria-hidden="true" />
        ) : icon && iconOnly ? (
          <Icon name={icon} size={size === "sm" ? 14 : size === "md" ? 16 : 18} aria-hidden="true" />
        ) : null}
        {children && !iconOnly && <span>{children}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

export type { ButtonProps };
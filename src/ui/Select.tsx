import { forwardRef, SelectHTMLAttributes, LabelHTMLAttributes } from "react";
import { clsx } from "clsx";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
  options: { value: string; label: string; disabled?: boolean }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, fullWidth, options, placeholder, id, ...props }, ref) => {
    const selectId = id || props.name;

    return (
      <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-[var(--color-fg-secondary)]"
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            "w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)]",
            "border rounded-lg transition-colors duration-150 appearance-none",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:opacity-50 disabled:pointer-events-none",
            error
              ? "border-[var(--color-brand-danger)] focus:ring-[var(--color-brand-danger)]"
              : "border-[var(--color-border-medium)] focus:ring-[var(--color-brand-primary)]",
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-xs text-[var(--color-brand-danger)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${selectId}-hint`} className="text-xs text-[var(--color-fg-tertiary)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
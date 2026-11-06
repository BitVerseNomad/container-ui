import { forwardRef, InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, fullWidth, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[var(--color-fg-secondary)]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)]",
            "border rounded-lg transition-colors duration-150",
            "placeholder:text-[var(--color-fg-tertiary)]",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:opacity-50 disabled:pointer-events-none",
            error
              ? "border-[var(--color-brand-danger)] focus:ring-[var(--color-brand-danger)]"
              : "border-[var(--color-border-medium)] focus:ring-[var(--color-brand-primary)]",
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-[var(--color-brand-danger)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-[var(--color-fg-tertiary)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, fullWidth, id, ...props }, ref) => {
    const textareaId = id || props.name;

    return (
      <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-[var(--color-fg-secondary)]"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            "w-full px-3 py-2 text-sm bg-[var(--color-bg-primary)] font-mono",
            "border rounded-lg transition-colors duration-150 resize-y min-h-[80px]",
            "placeholder:text-[var(--color-fg-tertiary)]",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:opacity-50 disabled:pointer-events-none",
            error
              ? "border-[var(--color-brand-danger)] focus:ring-[var(--color-brand-danger)]"
              : "border-[var(--color-border-medium)] focus:ring-[var(--color-brand-primary)]",
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="text-xs text-[var(--color-brand-danger)]" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="text-xs text-[var(--color-fg-tertiary)]">
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => (
    <label
      ref={ref}
      className={clsx("text-sm font-medium text-[var(--color-fg-secondary)] flex items-center gap-1", className)}
      {...props}
    >
      {children}
      {required && <span className="text-[var(--color-brand-danger)]" aria-hidden="true">*</span>}
    </label>
  )
);
Label.displayName = "Label";
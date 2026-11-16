import { forwardRef, InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes, useId } from "react";
import { clsx } from "clsx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, fullWidth, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id || props.name || generatedId;

    return (
      <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-fg-muted"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            "w-full px-3 py-2 text-sm bg-bg",
            "border rounded-lg transition-colors duration-150",
            "placeholder:text-fg-faint",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:opacity-50 disabled:pointer-events-none",
            error
              ? "border-bad focus:ring-bad"
              : "border-edge focus:ring-accent",
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-bad" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-fg-faint">
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
    const generatedId = useId();
    const textareaId = id || props.name || generatedId;

    return (
      <div className={clsx("flex flex-col gap-1.5", fullWidth && "w-full")}>
        {label && (
          <label
            htmlFor={textareaId}
            className="text-sm font-medium text-fg-muted"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={clsx(
            "w-full px-3 py-2 text-sm bg-bg font-mono",
            "border rounded-lg transition-colors duration-150 resize-y min-h-[80px]",
            "placeholder:text-fg-faint",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:opacity-50 disabled:pointer-events-none",
            error
              ? "border-bad focus:ring-bad"
              : "border-edge focus:ring-accent",
            className
          )}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${textareaId}-error` : hint ? `${textareaId}-hint` : undefined}
          {...props}
        />
        {error && (
          <p id={`${textareaId}-error`} className="text-xs text-bad" role="alert">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${textareaId}-hint`} className="text-xs text-fg-faint">
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
      className={clsx("text-sm font-medium text-fg-muted flex items-center gap-1", className)}
      {...props}
    >
      {children}
      {required && <span className="text-bad" aria-hidden="true">*</span>}
    </label>
  )
);
Label.displayName = "Label";
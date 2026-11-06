import { forwardRef, LabelHTMLAttributes } from "react";
import { clsx } from "clsx";

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
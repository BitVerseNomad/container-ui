import React, { forwardRef, useId } from "react";
import { clsx } from "clsx";
import { Icon, type IconName } from "./Icon";

export type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: "sm" | "md";
  icon?: IconName;
  invalid?: string;
  onClear?: () => void;
  width?: "search" | "filter" | "port" | "num";
};

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { size = "sm", icon, invalid, onClear, width, className, id, onKeyDown, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = `${inputId}-error`;
  return (
    <>
      <label className={clsx("field", size === "md" && "md", width, className)} aria-invalid={invalid ? "true" : undefined}>
        {icon && <Icon name={icon} size="sm" />}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          aria-invalid={invalid ? "true" : undefined}
          aria-describedby={invalid ? errorId : undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape" && onClear) {
              event.preventDefault();
              onClear();
            }
            onKeyDown?.(event);
          }}
        />
      </label>
      {invalid && <span className="hint" id={errorId}>{invalid}</span>}
    </>
  );
});

export function FormRow(props: { label: string; hint?: string; htmlFor: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="form-row">
      <label className="label" htmlFor={props.htmlFor}>{props.label}</label>
      {props.children}
      {props.hint && <div className="hint">{props.hint}</div>}
    </div>
  );
}

export function Fields(props: { children: React.ReactNode }): React.JSX.Element {
  return <div className="fields">{props.children}</div>;
}

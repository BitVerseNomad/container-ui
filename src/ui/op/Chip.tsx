import React from "react";
import { clsx } from "clsx";
import { Icon, type IconName } from "./Icon";

export function Chip(props: React.HTMLAttributes<HTMLSpanElement>): React.JSX.Element {
  const { className, ...rest } = props;
  return <span className={clsx("chip", className)} {...rest} />;
}

export function ChipButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { pressed?: boolean; icon?: IconName }): React.JSX.Element {
  const { pressed, icon, className, children, ...rest } = props;
  return (
    <button
      data-op=""
      {...rest}
      type="button"
      className={clsx("chip", className)}
      aria-pressed={pressed === undefined ? undefined : pressed}
    >
      {icon && <Icon name={icon} size="sm" />}
      {children}
    </button>
  );
}

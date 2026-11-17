import React from "react";
import { clsx } from "clsx";
import { Icon, type IconName } from "./Icon";

export function NavItem(props: {
  href: string;
  icon?: IconName;
  label: string;
  current?: boolean;
  count?: number;
  countBad?: boolean;
  countLabel?: string;
  className?: string;
}): React.JSX.Element {
  const { href, icon, label, current, count, countBad, countLabel, className } = props;
  return (
    <a className={clsx("nav-item !no-underline", current ? "!text-on-accent" : "!text-fg-muted hover:!text-fg", className)} href={href} aria-current={current ? "page" : undefined}>
      {icon && <Icon name={icon} size="sm" />}
      <span>{label}</span>
      {count !== undefined && <span className={clsx("count", countBad && "bad")} aria-label={countLabel}>{count}</span>}
    </a>
  );
}

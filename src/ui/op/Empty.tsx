import React from "react";
import { clsx } from "clsx";
import { Icon, type IconName } from "./Icon";

export function Empty(props: { icon: IconName; title: string; children?: React.ReactNode; actions?: React.ReactNode; className?: string }): React.JSX.Element {
  const { icon, title, children, actions, className } = props;
  return (
    <div className={clsx("empty", className)}>
      <Icon name={icon} />
      <div className="title">{title}</div>
      <div className="text">{children}</div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

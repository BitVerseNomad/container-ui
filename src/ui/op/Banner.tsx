import React from "react";
import { clsx } from "clsx";
import { Sev } from "./Sev";

export function Banner(props: { tone: "bad" | "warn" | "info"; title?: string; children?: React.ReactNode; actions?: React.ReactNode; className?: string }): React.JSX.Element {
  const { tone, title, children, actions, className } = props;
  return (
    <div className={clsx("banner", tone, !title && "line", className)} role={tone === "bad" ? "alert" : "status"}>
      <Sev level={tone} />
      {title ? (
        <div>
          <div className="title">{title}</div>
          <div className="body selectable">{children}</div>
        </div>
      ) : (
        <div className="body selectable">{children}</div>
      )}
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}

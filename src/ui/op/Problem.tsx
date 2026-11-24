import React from "react";
import { clsx } from "clsx";
import { Sev } from "./Sev";

export function Problem(props: {
  level: "bad" | "warn" | "ok" | "info" | "busy";
  text: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  child?: boolean;
  // A long reason wraps instead of cutting off with an ellipsis.
  wrap?: boolean;
  onOpen?: () => void;
}): React.JSX.Element {
  const { level, text, title, action, child, wrap, onOpen } = props;

  function handleClick(event: React.MouseEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest(".act")) return;
    onOpen?.();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen?.();
    }
  }

  const mark = level === "busy" ? <span className="spinner inline-block size-3 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" /> : <Sev level={level} />;

  return (
    <div
      className={clsx("subrow", child && "child")}
      role="row"
      tabIndex={onOpen ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {mark}
      <span className={clsx("what min-w-0 flex-1", wrap ? "break-words" : "truncate")} title={title}>{text}</span>
      <span className="act">{action}</span>
    </div>
  );
}

import React from "react";
import { clsx } from "clsx";
import { Sev } from "./Sev";

export function Problem(props: {
  level: "bad" | "warn";
  text: string;
  action?: React.ReactNode;
  child?: boolean;
  onOpen?: () => void;
}): React.JSX.Element {
  const { level, text, action, child, onOpen } = props;

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

  return (
    <div
      className={clsx("subrow", child && "child")}
      role="row"
      tabIndex={onOpen ? 0 : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <Sev level={level} />
      <span className="what truncate">{text}</span>
      <span className="act">{action}</span>
    </div>
  );
}
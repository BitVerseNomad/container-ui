import React, { useState } from "react";
import { clsx } from "clsx";

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return "";
}

function focusRow(row: HTMLElement, direction: 1 | -1): void {
  const list = row.closest(".list");
  if (!list) return;
  const rows = Array.from(list.querySelectorAll<HTMLElement>('[role="row"][tabindex="0"]'));
  const index = rows.indexOf(row);
  rows[index + direction]?.focus();
}

export function List(props: { "aria-label": string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="list" role="table" aria-label={props["aria-label"]}>
      {props.children}
    </div>
  );
}

export function RowHead(props: { children: React.ReactNode; menuGap?: boolean }): React.JSX.Element {
  return (
    <div className="row th" role="row">
      {props.children}
      {props.menuGap && <span className="ml-1 inline-block w-6" />}
    </div>
  );
}

export type RowProps = {
  lead: React.ReactNode;
  dot?: React.ReactNode;
  name: React.ReactNode;
  nameClass?: string;
  title?: string;
  ariaLabel?: string;
  meta?: React.ReactNode;
  metaSelectable?: boolean;
  tall?: boolean;
  children?: React.ReactNode;
  action?: React.ReactNode;
  menu?: React.ReactNode;
  child?: boolean;
  onOpen?: () => void;
  onMenuKey?: () => void;
  selected?: boolean;
  onSelect?: (selected: boolean) => void;
  expanded?: boolean;
  onToggle?: () => void;
};

export function Row(props: RowProps): React.JSX.Element {
  const {
    lead, dot, name, nameClass, title, ariaLabel, meta, metaSelectable, tall, children, action, menu,
    child, onOpen, onMenuKey, selected, onSelect, expanded, onToggle,
  } = props;
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const numberLead = typeof lead === "number";
  const showCheck = onSelect !== undefined && (hovered || focused || selected === true);
  const check = (
    <input
      type="checkbox"
      className="check size-3.5 accent-accent"
      aria-label={`Select ${textOf(name)}`}
      checked={selected === true}
      onChange={(event) => onSelect?.(event.target.checked)}
      onClick={(event) => event.stopPropagation()}
    />
  );
  const leadContent = showCheck && !dot ? check : lead;

  function handleClick(event: React.MouseEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement;
    if (target.closest('.act, [aria-haspopup="menu"], [role="menu"], .check')) return;
    onOpen?.();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      onMenuKey?.();
      return;
    } else if (event.key === "Enter") {
      event.preventDefault();
      onOpen?.();
    } else if (event.key === " ") {
      event.preventDefault();
      onSelect?.(!selected);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      focusRow(event.currentTarget, event.key === "ArrowDown" ? 1 : -1);
    } else if (event.key === "ArrowLeft" && expanded === true) {
      event.preventDefault();
      onToggle?.();
    } else if (event.key === "ArrowRight" && expanded === false) {
      event.preventDefault();
      onToggle?.();
    }
  }

  return (
    <div
      className={clsx("row", child && "child", tall && "tall")}
      role="row"
      tabIndex={0}
      aria-selected={selected}
      aria-expanded={expanded === true ? "true" : expanded === false ? "false" : undefined}
      title={title}
      aria-label={ariaLabel}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      <span className={clsx("lead", numberLead && "num")}>{leadContent}</span>
      {dot && (showCheck ? check : dot)}
      {tall ? (
        <>
          <span className="grow">
            <div className="name">{name}</div>
            <div className="meta select-text">{meta}</div>
          </span>
          {children}
          <span className="side flex shrink-0 items-center gap-2">{action}</span>
        </>
      ) : (
        <>
          <span className={clsx("name", "truncate", nameClass)}>{name}</span>
          <span className={clsx("meta", "truncate", "grow", metaSelectable && "selectable")}>{meta}</span>
          {children}
          <span className="act">{action}</span>
        </>
      )}
      {menu}
    </div>
  );
}

export type ColKind =
  | "ports" | "stats" | "state" | "state-wide" | "state-words" | "size" | "age" | "age-short"
  | "id" | "subnet" | "ready" | "restarts" | "inside" | "mac" | "cpu";

const COL_CLASSES: Record<ColKind, string> = {
  ports: "ports",
  stats: "stats",
  state: "state",
  "state-wide": "state wide",
  "state-words": "state words",
  size: "size",
  age: "age",
  "age-short": "age short",
  id: "id",
  subnet: "subnet",
  ready: "ready",
  restarts: "restarts",
  inside: "inside",
  mac: "mac",
  cpu: "cpu",
};

export function Col(props: { kind?: ColKind; mono?: boolean; children?: React.ReactNode }): React.JSX.Element {
  return (
    <span className={clsx("col", props.kind && COL_CLASSES[props.kind], props.mono && "mono")}>
      {props.children}
    </span>
  );
}

export function Dim(props: { children: React.ReactNode }): React.JSX.Element {
  return <span className="dim text-fg-faint">{props.children}</span>;
}

export function Members(props: { children: React.ReactNode }): React.JSX.Element {
  return <span className="grow min-w-0 truncate text-fg-muted">{props.children}</span>;
}
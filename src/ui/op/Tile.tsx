import React from "react";

export function Tiles(props: { children: React.ReactNode }): React.JSX.Element {
  return <div className="tiles">{props.children}</div>;
}

export function Tile(props: { label: string; value: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="tile flex flex-col gap-1 rounded-lg border border-line bg-bg-raised p-3">
      <span className="text-meta text-fg-muted">{props.label}</span>
      <span className="v">{props.value}</span>
      <div className="text-meta text-fg-faint">{props.children}</div>
    </div>
  );
}

import React from "react";

export function Tiles(props: { children: React.ReactNode }): React.JSX.Element {
  return <div className="tiles">{props.children}</div>;
}

export function Tile(props: { label: string; value: string; children?: React.ReactNode }): React.JSX.Element {
  return (
    <div className="tile">
      <span className="k">{props.label}</span>
      <span className="v">{props.value}</span>
      <div className="foot">{props.children}</div>
    </div>
  );
}

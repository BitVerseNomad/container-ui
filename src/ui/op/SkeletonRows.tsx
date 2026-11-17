import React from "react";

const WIDTHS = ["a", "b", "c", "d"] as const;
const WIDTH_CLASS: Record<(typeof WIDTHS)[number], string> = { a: "w-3/4", b: "w-1/2", c: "w-2/3", d: "w-5/12" };

export function SkeletonRows(props: { rows?: number }): React.JSX.Element {
  const rows = props.rows ?? 4;
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div className="row" key={index}>
          <span className="lead"></span>
          <span className={`skeleton block h-3 animate-pulse rounded-xs bg-tile-active ${WIDTH_CLASS[WIDTHS[index % WIDTHS.length]]}`}></span>
          <span className="grow"></span>
          <span className="skeleton block h-3 w-10 animate-pulse rounded-xs bg-tile-active"></span>
        </div>
      ))}
    </div>
  );
}

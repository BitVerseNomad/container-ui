import React from "react";

const WIDTHS = ["a", "b", "c", "d"] as const;

export function SkeletonRows(props: { rows?: number }): React.JSX.Element {
  const rows = props.rows ?? 4;
  return (
    <div aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div className="row" key={index}>
          <span className="lead"></span>
          <span className={`skeleton ${WIDTHS[index % WIDTHS.length]}`}></span>
          <span className="grow"></span>
          <span className="skeleton short"></span>
        </div>
      ))}
    </div>
  );
}

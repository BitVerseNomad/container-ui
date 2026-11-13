import React from "react";

export function Sparkline(props: { points: number[] | null; label: string }): React.JSX.Element {
  const { points, label } = props;
  if (!points || points.length === 0) return <span className="spark" aria-hidden="true"></span>;

  const max = Math.max(1, ...points);
  const coords = points.map((value, index) => {
    const x = points.length === 1 ? 0 : index * (86 / (points.length - 1));
    const y = 18 - 2 - (value / max) * 14;
    return `${x},${y}`;
  });

  return (
    <svg className="spark" viewBox="0 0 86 18" role="img" aria-label={label}>
      <polyline points={coords.join(" ")} />
    </svg>
  );
}
import React from "react";
import { clsx } from "clsx";

export type Meter = { label: "CPU" | "Memory" | "Disk"; share: number; text: string; hot?: boolean };

export function Meters(props: { meters: Meter[]; onOpen?: () => void }): React.JSX.Element | null {
  const { meters, onOpen } = props;
  if (meters.length === 0) return null;

  return (
    <button type="button" className="flex w-full flex-col gap-1 rounded-sm p-1 text-left hover:bg-tile" aria-label="Machine use. Open machine settings" onClick={onOpen}>
      {meters.map((meter) => (
        <span
          key={meter.label}
          className={clsx("meter", meter.hot && "hot")}
          style={{ "--v": `${Math.round(meter.share * 100)}%` } as React.CSSProperties}
        >
          {meter.label} <i></i> {meter.text}
        </span>
      ))}
    </button>
  );
}
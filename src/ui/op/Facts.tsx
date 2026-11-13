import React from "react";

export function Facts(props: { items: { label: string; value: React.ReactNode }[] }): React.JSX.Element {
  return (
    <div className="facts">
      {props.items.map((item) => (
        <span className="selectable" key={item.label}>
          <span className="sr-only">{item.label}: </span>
          {item.value}
        </span>
      ))}
    </div>
  );
}

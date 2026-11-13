import React from "react";

export function GroupCaption(props: { children: React.ReactNode; count?: number }): React.JSX.Element {
  return (
    <div className="group-cap">
      {props.children}
      {props.count !== undefined && <span className="count"> · {props.count}</span>}
    </div>
  );
}

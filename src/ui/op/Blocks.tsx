import React from "react";
import { clsx } from "clsx";

export type BlockState = "ok" | "warn" | "bad" | "off";

export function Blocks(props: { services: { name: string; state: BlockState; label: string }[] }): React.JSX.Element {
  const { services } = props;
  const shown = services.length > 9 ? services.slice(0, 8) : services;
  const running = services.filter((service) => service.state === "ok").length;

  return (
    <span className="blocks" role="img" aria-label={`${running} of ${services.length} running`}>
      {shown.map((service, index) => (
        <u
          key={`${service.name}-${index}`}
          className={clsx(service.state !== "ok" && service.state)}
          title={`${service.name}: ${service.label}`}
        />
      ))}
      {services.length > 9 && <u className="off">+{services.length - 8}</u>}
    </span>
  );
}
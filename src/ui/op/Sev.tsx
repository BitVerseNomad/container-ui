import React from "react";
import { clsx } from "clsx";
import { Icon, type IconName } from "./Icon";

export type SevLevel = "bad" | "warn" | "info" | "ok";

const ICONS: Record<SevLevel, IconName> = { bad: "error", warn: "alert", info: "info", ok: "check" };

export function Sev(props: { level: SevLevel; className?: string }): React.JSX.Element {
  return <Icon name={ICONS[props.level]} size="sm" className={clsx("sev", props.level, props.className)} />;
}

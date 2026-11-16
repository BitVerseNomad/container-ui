import React, { createContext, useContext } from "react";
import type { DotState } from "./ui/op";
import { Button } from "./ui/op";
import { Dot } from "./ui/op";
import { Meters, type Meter } from "./ui/op";
import { go } from "./lib/router";
import { metersOf, type MachineUsage } from "./lib/liveStats.ts";

export const MachineUsageContext = createContext<MachineUsage | null>(null);

export function MachineUsageProvider(props: { value: MachineUsage | null; children: React.ReactNode }): React.JSX.Element {
  return <MachineUsageContext.Provider value={props.value}>{props.children}</MachineUsageContext.Provider>;
}

export function useMachineUsage(): MachineUsage | null {
  return useContext(MachineUsageContext);
}

export type HeaderProps = {
  title: string;
  summary?: string;
  back?: { label: string; onBack: () => void };
  stateDot?: DotState;
  stateText?: string;
  meters?: boolean;
  children?: React.ReactNode;
};

export function Header(props: HeaderProps): React.JSX.Element {
  const { title, summary, back, stateDot, stateText, meters, children } = props;
  const usage = useMachineUsage();
  return (
    <header className="header" data-tauri-drag-region>
      {back && <Button variant="ghost" iconOnly icon="back" aria-label={back.label} onClick={back.onBack} />}
      <h1>{title}</h1>
      {stateDot && <Dot state={stateDot} />}
      {summary && <span className="text-meta text-fg-muted">{summary}</span>}
      {stateText && <span className="text-meta text-fg-muted">{stateText}</span>}
      <span className="grow" />
      {meters !== false && usage && <Meters meters={metersOf(usage)} onOpen={() => go("#/settings/machines")} />}
      {children}
    </header>
  );
}

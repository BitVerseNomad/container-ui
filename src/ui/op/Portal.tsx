import React, { createContext, useContext } from "react";

const PortalContext = createContext<HTMLElement | null | undefined>(undefined);

export function PortalProvider(props: { container: HTMLElement | null; children: React.ReactNode }): React.JSX.Element {
  return <PortalContext.Provider value={props.container}>{props.children}</PortalContext.Provider>;
}

export function usePortalContainer(): HTMLElement | undefined {
  return useContext(PortalContext) ?? undefined;
}
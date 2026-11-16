import React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

export const TooltipProvider = TooltipPrimitive.Provider;

export function Tooltip(props: { text: string; shortcut?: string; children: React.ReactElement }): React.JSX.Element {
  return (
    <TooltipPrimitive.Root delayDuration={500}>
      <TooltipPrimitive.Trigger asChild>{props.children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="tooltip z-50 rounded-sm border border-line bg-bg-raised px-2 py-1 text-meta text-fg shadow-floating" sideOffset={4}>
          {props.text}
          {props.shortcut && <span className="ml-2 rounded-xs border border-line px-1 font-mono text-micro text-fg-muted">{props.shortcut}</span>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

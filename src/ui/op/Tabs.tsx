import React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { clsx } from "clsx";

export type TabItem = { value: string; label: string };

export function Tabs(props: {
  value: string;
  onChange: (value: string) => void;
  items: TabItem[];
  "aria-label": string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  const { value, onChange, items, aside, children, className, ...rest } = props;
  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange}>
      <TabsPrimitive.List className={clsx("tabs", className)} {...rest}>
        {items.map((item) => (
          <TabsPrimitive.Trigger key={item.value} data-op="" className="chip" value={item.value}>
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
        {aside && (
          <>
            <span className="grow" />
            {aside}
          </>
        )}
      </TabsPrimitive.List>
      {children}
    </TabsPrimitive.Root>
  );
}

export function TabPanel(props: { value: string; children: React.ReactNode }): React.JSX.Element {
  return <TabsPrimitive.Content value={props.value}>{props.children}</TabsPrimitive.Content>;
}

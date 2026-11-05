import { ReactNode } from "react";

// Rendered as "panel": ".card" is already the Stats tab's tile style.
export default function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`panel ${className}`.trim()}>{children}</div>;
}

import React, { forwardRef } from "react";
import { clsx } from "clsx";

export type CanvasLine = { text: string; time?: string; service?: string; level?: "w" | "e" };

type CanvasProps = Omit<React.HTMLAttributes<HTMLPreElement>, "children" | "className"> & {
  lines?: CanvasLine[];
  children?: React.ReactNode;
  "aria-label": string;
  fill?: boolean;
  wrap?: boolean;
  className?: string;
};

export const Canvas = forwardRef<HTMLPreElement, CanvasProps>(function Canvas(
  { lines, children, fill, wrap, className, ...rest },
  ref,
) {
  return (
    <pre
      {...rest}
      ref={ref}
      tabIndex={0}
      className={clsx("canvas", "selectable", fill && "fill", wrap && "wrap", className)}
    >
      {lines
        ? lines.map((line, index) => (
            <div className={clsx("ln", line.level)} key={index}>
              {line.time && <span className="t">{line.time}</span>}
              {line.service && <span className="ml-1.5 font-mono text-meta text-fg-faint">{line.service}</span>}
              {line.text}
            </div>
          ))
        : children}
    </pre>
  );
});

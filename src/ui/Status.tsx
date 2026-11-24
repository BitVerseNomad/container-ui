// One way to show a state everywhere: a dot for the level and the word for the detail. The dot is the same one the
// sidebar uses, so one level means one colour: on is green, busy is the accent, off is neutral.
import { Dot, type DotState } from "./op/Dot";

export type Level = "on" | "warn" | "bad" | "off" | "busy";

const DOT: Record<Level, DotState> = { on: "ok", warn: "warn", bad: "bad", off: "off", busy: "busy" };

export default function Status({ level, children, title }: { level: Level; children: string; title?: string }) {
  return (
    <span className="status" title={title}>
      <Dot state={DOT[level]} />
      {children}
    </span>
  );
}

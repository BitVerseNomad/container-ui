// One way to show a state everywhere: a dot for the level and the word for the detail.
export type Level = "on" | "warn" | "bad" | "off";

export default function Status({ level, children, title }: { level: Level; children: string; title?: string }) {
  return (
    <span className="status" title={title}>
      <span className={level === "off" ? "sdot" : `sdot ${level}`} aria-hidden="true" />
      {children}
    </span>
  );
}

// Text with `backticks` around paths, settings and commands, shown in the code font the way the Mac shows them.
// The same text for a tooltip, where markup can't go.
export const plain = (text: string) => text.split("`").join("");

export default function Ticks({ text }: { text: string }) {
  return <>{text.split("`").map((part, i) => (i % 2 ? <code key={i}>{part}</code> : part))}</>;
}

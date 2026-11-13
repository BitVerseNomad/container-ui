import React from "react";
import { clsx } from "clsx";
import { Button } from "./Button";

export function Command(props: { text: string; onCopied?: () => void; className?: string }): React.JSX.Element {
  const { text, onCopied, className } = props;
  return (
    <div className={clsx("cmd", className)}>
      <code className="selectable">{text}</code>
      <Button
        variant="ghost"
        size="xs"
        iconOnly
        icon="copy"
        aria-label="Copy the command"
        onClick={() => {
          void navigator.clipboard.writeText(text).then(() => onCopied?.());
        }}
      />
    </div>
  );
}

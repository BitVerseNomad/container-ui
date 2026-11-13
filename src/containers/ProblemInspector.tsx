import * as React from "react";
import { Button } from "../ui/op/Button";
import { Command } from "../ui/op/Command";
import { Inspector } from "../ui/op/Inspector";
import type { InspectorContent } from "../lib/inspectorContent";

export type ProblemInspectorProps = {
  content: InspectorContent | null;
  onClose: () => void;
  onFix: () => void;
  onLogs: () => void;
  onShell: () => void;
};

export function ProblemInspector(props: ProblemInspectorProps): JSX.Element {
  const { content, onClose, onFix, onLogs, onShell } = props;
  if (!content) return <Inspector open={false} onClose={onClose} crumb="" title="" lede="" actions={null} />;

  const actions = (
    <>
      <Button variant="primary" size="md" onClick={content.primary.kind === "fix" ? onFix : onLogs}>
        {content.primary.label}
      </Button>
      {content.also.includes("logs") && <Button size="md" onClick={onLogs}>Open logs</Button>}
      {content.also.includes("shell") && <Button size="md" onClick={onShell}>Open a shell</Button>}
    </>
  );

  return (
    <Inspector
      open={true}
      onClose={onClose}
      crumb={content.crumb}
      title={content.title}
      lede={content.lede}
      evidence={content.evidence}
      findings={content.findings}
      command={content.command}
      actions={actions}
    />
  );
}

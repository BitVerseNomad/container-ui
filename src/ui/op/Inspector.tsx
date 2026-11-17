import React from "react";
import { Command } from "./Command";
import { Sheet } from "./Sheet";

export type InspectorProps = {
  open: boolean;
  onClose: () => void;
  crumb: string;
  title: string;
  lede: string;
  evidence?: { text: string; bad?: boolean }[];
  findings?: string[];
  actions: React.ReactNode;
  command?: string;
};

export function Inspector(props: InspectorProps): React.JSX.Element {
  const { open, onClose, crumb, title, lede, evidence, findings, actions, command } = props;

  return (
    <Sheet open={open} onClose={onClose} title={title} hideTitle>
      <div className="ins">
        <div className="text-meta text-fg-muted">{crumb}</div>
        <h2>{title}</h2>
        <p>{lede}</p>
        {evidence && (
          <div>
            <div className="text-micro font-medium uppercase tracking-wide text-fg-faint">What it said</div>
            <pre>
              {evidence.map((line, index) => (
                <React.Fragment key={index}>
                  {index > 0 && "\n"}
                  {line.bad ? <b>{line.text}</b> : line.text}
                </React.Fragment>
              ))}
            </pre>
          </div>
        )}
        {findings && (
          <div>
            <div className="text-micro font-medium uppercase tracking-wide text-fg-faint">What OpenPier found</div>
            <div className="steps">
              {findings.map((text, index) => (
                <div key={index}>
                  <i>{index + 1}</i>
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="acts flex flex-wrap gap-2 pt-2">{actions}</div>
        {command && <Command text={command} />}
      </div>
    </Sheet>
  );
}
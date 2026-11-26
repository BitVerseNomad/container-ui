import * as React from "react";
import { Button, useConfirm } from "../ui/op";

export type SelectionBarProps = {
  count: number;
  canStart: boolean;
  canStop: boolean;
  onStart: () => void;
  onStop: () => void;
  onRemove: () => void;
  onCancel: () => void;
  ctx: string;
};

export function SelectionBar(props: SelectionBarProps): JSX.Element {
  const { count, canStart, canStop, onStart, onStop, onRemove, onCancel, ctx } = props;
  const confirm = useConfirm();

  async function handleRemove(): Promise<void> {
    const yes = await confirm({
      title: `Remove ${count} container${count === 1 ? "" : "s"}?`,
      body: "This deletes the containers. Their images and volumes are kept, so you can run them again.",
      command: `docker --context ${ctx} rm -f {names}`,
      confirm: "Remove",
      danger: true,
    });
    if (yes) onRemove();
  }

  return (
    <>
      <span className="sub">{count} selected</span>
      <Button disabled={!canStart} onClick={onStart}>Start</Button>
      <Button disabled={!canStop} onClick={onStop}>Stop</Button>
      <Button onClick={handleRemove}>Remove…</Button>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button>
    </>
  );
}

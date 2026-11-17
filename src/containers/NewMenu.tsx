import * as React from "react";
import { Button, Menu, MenuItem } from "../ui/op";

export type NewMenuProps = {
  onRun?: () => void;
  onPull?: () => void;
  onCompose?: () => void;
};

export function NewMenu({ onRun, onPull, onCompose }: NewMenuProps = {}): JSX.Element {
  return (
    <Menu label="New" align="end" wide trigger={<Button variant="primary" icon="plus" aria-label="New" className="btn primary">New</Button>}>
      <MenuItem label="Run an image" why="Start one container from an image you have" shortcut="⌘N" onSelect={() => onRun?.()} />
      <MenuItem label="Pull an image" why="Download an image without starting it" shortcut="⌘P" onSelect={() => onPull?.()} />
      <MenuItem label="Start a Compose project" why="Pick a folder with a compose.yaml" onSelect={() => onCompose?.()} />
    </Menu>
  );
}

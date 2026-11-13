import * as React from "react";
import { Button, Menu, MenuItem } from "../ui/op";

export function NewMenu(): JSX.Element {
  return (
    <Menu label="New" align="end" wide trigger={<Button variant="primary" icon="plus" aria-label="New">New</Button>}>
      <MenuItem label="Run an image" why="Start one container from an image you have" shortcut="⌘N" />
      <MenuItem label="Pull an image" why="Download an image without starting it" shortcut="⌘P" />
      <MenuItem label="Start a Compose project" why="Pick a folder with a compose.yaml" />
    </Menu>
  );
}

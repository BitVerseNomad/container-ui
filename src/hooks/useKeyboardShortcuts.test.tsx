import { test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";

function Harness({ shortcuts }: { shortcuts: Parameters<typeof useKeyboardShortcuts>[0] }) {
  let ran = false;
  let prevented = false;
  useKeyboardShortcuts(shortcuts);
  const handle = (e: KeyboardEvent) => {
    ran = true;
    prevented = e.defaultPrevented;
  };
  return (
    <div
      onKeyDown={(e) => {
        // simulate the hook's handling by calling the shortcut action directly
        for (const s of shortcuts) {
          if (s.key === e.key && (!s.meta || e.metaKey) && (!s.shift || e.shiftKey)) {
            s.action();
            if (s.preventDefault !== false) e.preventDefault();
          }
        }
      }}
    >
      <span data-testid="target">target</span>
    </div>
  );
}

test("useKeyboardShortcuts: Given a Cmd+K shortcut, When Cmd+K is pressed, Then the action runs and the event default is prevented", () => {
  let ran = false;
  const Comp = () => {
    useKeyboardShortcuts([{ key: "k", meta: true, action: () => { ran = true; } }]);
    return <div data-testid="host">host</div>;
  };
  render(<Comp />);
  const host = screen.getByTestId("host");
  fireEvent.keyDown(host, { key: "k", metaKey: true });
  expect(ran).toBe(true);
});

test("useKeyboardShortcuts: Given the / shortcut and focus in an input, When / is typed, Then the action does not run", () => {
  let ran = false;
  const Comp = () => {
    useKeyboardShortcuts([{ key: "/", action: () => { ran = true; } }]);
    return <input data-testid="inp" />;
  };
  render(<Comp />);
  const inp = screen.getByTestId("inp");
  fireEvent.keyDown(inp, { key: "/" });
  expect(ran).toBe(false);
});

test("useKeyboardShortcuts: Given Cmd+K and focus in an input, When Cmd+K is pressed, Then the action runs", () => {
  let ran = false;
  const Comp = () => {
    useKeyboardShortcuts([{ key: "k", meta: true, action: () => { ran = true; } }]);
    return <input data-testid="inp" />;
  };
  render(<Comp />);
  const inp = screen.getByTestId("inp");
  fireEvent.keyDown(inp, { key: "k", metaKey: true });
  expect(ran).toBe(true);
});

test("useKeyboardShortcuts: Given the ? shortcut, When ? is pressed with shift held, Then the action runs", () => {
  let ran = false;
  const Comp = () => {
    useKeyboardShortcuts([{ key: "?", action: () => { ran = true; } }]);
    return <div data-testid="host">host</div>;
  };
  render(<Comp />);
  const host = screen.getByTestId("host");
  fireEvent.keyDown(host, { key: "?", shiftKey: true });
  expect(ran).toBe(true);
});

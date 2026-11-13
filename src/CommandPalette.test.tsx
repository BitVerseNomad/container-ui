import { test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import CommandPalette from "./CommandPalette";

const items = [
  { id: "c1", group: "Containers" as const, label: "kafka", hint: "confluentinc/cp-kafka", dot: "ok" as const, run: () => {} },
  { id: "c2", group: "Containers" as const, label: "kafka-ui", hint: "provectuslabs/kafka-ui", dot: "ok" as const, run: () => {} },
  { id: "g1", group: "Go to" as const, label: "Containers", run: () => {} },
];

test("CommandPalette: Given the palette is open, When it renders, Then the input has focus", () => {
  render(<CommandPalette open={true} onClose={() => {}} items={items} />);
  const input = screen.getByLabelText("Search commands and containers");
  expect(input).toHaveFocus();
});

test("CommandPalette: Given items and the query kaf, When Enter pressed, Then the first match runs and the palette closes", () => {
  let ranId: string | null = null;
  let closed = false;
  const runnableItems = items.map((i) => ({ ...i, run: () => { ranId = i.id; } }));
  render(<CommandPalette open={true} onClose={() => { closed = true; }} items={runnableItems} />);
  const input = screen.getByLabelText("Search commands and containers");
  fireEvent.change(input, { target: { value: "kaf" } });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(ranId).toBe("c1");
  expect(closed).toBe(true);
});

test("CommandPalette: Given Escape, When pressed, Then onClose is called", () => {
  let closed = false;
  render(<CommandPalette open={true} onClose={() => { closed = true; }} items={items} />);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(closed).toBe(true);
});

test("CommandPalette: Given ArrowDown, When pressed twice, Then the third item has data-highlighted", () => {
  const many = [
    { id: "g1", group: "Go to" as const, label: "container-1", run: () => {} },
    { id: "g2", group: "Go to" as const, label: "container-2", run: () => {} },
    { id: "g3", group: "Go to" as const, label: "container-3", run: () => {} },
  ];
  render(<CommandPalette open={true} onClose={() => {}} items={many} />);
  const input = screen.getByLabelText("Search commands and containers");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(screen.getByRole("option", { name: "container-3" })).toHaveAttribute("data-highlighted");
});

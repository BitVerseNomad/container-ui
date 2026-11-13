import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Button } from "./Button";
import { ToastProvider, useToast } from "./Toast";

function Harness({ onSelect }: { onSelect: () => void }) {
  const toast = useToast();
  return (
    <Button onClick={() => toast({ text: "Removed kafka-ui", action: { label: "Undo", onSelect } })}>
      Show
    </Button>
  );
}

function show(onSelect: () => void = () => {}) {
  render(
    <ToastProvider>
      <Harness onSelect={onSelect} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Show" }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("given a toast, then an element with role status holds the text", () => {
  show();
  expect(screen.getByRole("status")).toHaveTextContent("Removed kafka-ui");
});

it("given a toast, after 6000 ms it is gone", () => {
  show();
  act(() => vi.advanceTimersByTime(6000));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("given a toast action, when it is clicked, then onSelect is called and the toast is gone", () => {
  const onSelect = vi.fn();
  show(onSelect);
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
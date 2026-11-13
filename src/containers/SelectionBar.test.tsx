import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ConfirmProvider } from "../ui/op";
import { SelectionBar } from "./SelectionBar";

it("given count 2, when rendered, then 2 selected and the buttons Start, Stop, Remove…, Cancel show", () => {
  const onRemove = vi.fn();
  render(
    <ConfirmProvider>
      <SelectionBar count={2} canStart={true} canStop={true} onStart={vi.fn()} onStop={vi.fn()} onRemove={onRemove} onCancel={vi.fn()} ctx="colima" />
    </ConfirmProvider>,
  );
  expect(screen.getByText("2 selected")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Remove…" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
});

it("given Remove… is pressed, when the confirm shows, then the title is Remove 2 containers?", async () => {
  const user = userEvent.setup();
  const onRemove = vi.fn();
  render(
    <ConfirmProvider>
      <SelectionBar count={2} canStart={true} canStop={true} onStart={vi.fn()} onStop={vi.fn()} onRemove={onRemove} onCancel={vi.fn()} ctx="colima" />
    </ConfirmProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Remove…" }));
  const dialog = screen.getByRole("alertdialog");
  expect(dialog).toHaveTextContent("Remove 2 containers?");
});

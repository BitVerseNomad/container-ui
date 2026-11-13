import { useState, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

function Harness({ footer }: { footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Run" footer={footer}>
        <input aria-label="Name" />
      </Sheet>
    </>
  );
}

it("given an opener and a sheet with one input, when opened, then the input has focus", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("button", { name: "Open" }));
  await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toHaveFocus());
});

it("given a sheet, when Escape is pressed, then onClose is called", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Sheet open onClose={onClose} title="Run">
      <input aria-label="Name" />
    </Sheet>,
  );
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});

it("given a busy sheet, when Escape is pressed, then onClose is not called", async () => {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(
    <Sheet open busy onClose={onClose} title="Run">
      <input aria-label="Name" />
    </Sheet>,
  );
  await user.keyboard("{Escape}");
  expect(onClose).not.toHaveBeenCalled();
});

it("given no footer, then there is no sheet-foot", () => {
  const { container } = render(
    <Sheet open onClose={() => {}} title="Run">
      <input aria-label="Name" />
    </Sheet>,
  );
  expect(container.querySelector(".sheet-foot")).toBeNull();
});

it("given a closed sheet, then the opener has focus again", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const opener = screen.getByRole("button", { name: "Open" });
  await user.click(opener);
  await screen.findByRole("textbox", { name: "Name" });
  await user.keyboard("{Escape}");
  await waitFor(() => expect(opener).toHaveFocus());
});
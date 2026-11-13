import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Switch } from "./Switch";

it("given unchecked, when Space is pressed, then onChange is called with true", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Switch checked={false} onChange={onChange} aria-labelledby="label" />);
  await user.tab();
  await user.keyboard(" ");
  expect(onChange).toHaveBeenCalledWith(true);
});

it("given unchecked, when rendered, then role is switch and aria-checked is false", () => {
  render(<Switch checked={false} onChange={() => {}} aria-labelledby="label" />);
  const control = screen.getByRole("switch");
  expect(control).toHaveAttribute("aria-checked", "false");
});

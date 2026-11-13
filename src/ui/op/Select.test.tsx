import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Select } from "./Select";

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
];

it("given three options, when the trigger is focused and Enter, ArrowDown and Enter are pressed, then onChange is called with the second value", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(<Select value="a" onChange={onChange} options={options} aria-label="Choice" />);
  await user.tab();
  await user.keyboard("{Enter}");
  await screen.findByRole("listbox");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(onChange).toHaveBeenCalledWith("b");
});

it("given a trigger, when rendered, then it has the aria-label", () => {
  render(<Select value="a" onChange={() => {}} options={options} aria-label="Choice" />);
  expect(screen.getByRole("combobox")).toHaveAttribute("aria-label", "Choice");
});

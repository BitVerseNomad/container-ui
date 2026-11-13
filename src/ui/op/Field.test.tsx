import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Field } from "./Field";

it("given invalid, when rendered, then the input is invalid and described by the message", () => {
  render(<Field invalid="Port 8080 is in use" aria-label="Port" />);
  const input = screen.getByRole("textbox", { name: "Port" });
  expect(input).toHaveAttribute("aria-invalid", "true");
  const describedBy = input.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  expect(document.getElementById(describedBy!)).toHaveTextContent("Port 8080 is in use");
});

it("given onClear, when Escape is pressed in the input, then onClear is called", async () => {
  const user = userEvent.setup();
  const onClear = vi.fn();
  render(<Field aria-label="Search" onClear={onClear} />);
  const input = screen.getByRole("textbox", { name: "Search" });
  await user.click(input);
  await user.keyboard("{Escape}");
  expect(onClear).toHaveBeenCalledTimes(1);
});

it("given size md, when rendered, then the label has classes field md", () => {
  const { container } = render(<Field size="md" aria-label="Name" />);
  expect(container.querySelector("label")).toHaveClass("field", "md");
});

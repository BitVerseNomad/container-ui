import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Command } from "./Command";

it("given the copy button, when clicked, then navigator.clipboard.writeText is called with the text", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  render(<Command text="docker ps" />);
  await user.click(screen.getByRole("button", { name: "Copy the command" }));
  expect(writeText).toHaveBeenCalledWith("docker ps");
});

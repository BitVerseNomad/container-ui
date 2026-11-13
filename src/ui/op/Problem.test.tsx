import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Problem } from "./Problem";

it("given a problem, then the text renders and Sev has the level class", () => {
  const { container } = render(<Problem level="warn" text="Only reachable from your Mac." />);
  expect(screen.getByText("Only reachable from your Mac.")).toBeInTheDocument();
  expect(container.querySelector(".sev.warn")).not.toBeNull();
});

it("given an action, when it is clicked, then onOpen is not called", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(<Problem level="bad" text="Can't reach Kafka" action={<Button>Fix</Button>} onOpen={onOpen} />);
  await user.click(screen.getByRole("button", { name: "Fix" }));
  expect(onOpen).not.toHaveBeenCalled();
});

it("given a clickable problem, when Enter is pressed, then onOpen is called", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(<Problem level="bad" text="Can't reach Kafka" onOpen={onOpen} />);
  const row = screen.getByText("Can't reach Kafka").closest(".subrow") as HTMLElement;
  row.focus();
  await user.keyboard("{Enter}");
  expect(onOpen).toHaveBeenCalledTimes(1);
});
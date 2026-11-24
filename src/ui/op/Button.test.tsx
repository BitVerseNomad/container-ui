import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";

it("given no props, when rendered, then class is exactly btn and type is button", () => {
  render(<Button>Run</Button>);
  const button = screen.getByRole("button", { name: "Run" });
  expect(button).toHaveClass("inline-flex", "bg-bg-raised", "text-fg", "h-h-sm", "px-10", "rounded-radius-md", "text-meta");
  expect(button).toHaveAttribute("type", "button");
});

it("given variant primary and size md, when rendered, then classes are btn primary md", () => {
  render(<Button variant="primary" size="md">New</Button>);
  expect(screen.getByRole("button", { name: "New" })).toHaveClass(
    "bg-accent",
    "text-on-accent",
    "shadow-control",
    "h-h-md",
    "px-12",
    "text-body",
  );
});

it("given busy, when clicked, then onClick is not called and aria-busy is true", async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(<Button busy onClick={onClick}>Stop</Button>);
  const button = screen.getByRole("button", { name: "Stop" });
  await user.click(button);
  expect(onClick).not.toHaveBeenCalled();
  expect(button).toHaveAttribute("aria-busy", "true");
});

it("given aria-label and data-x, when rendered, then both are on the button", () => {
  render(<Button iconOnly aria-label="More actions" data-x="menu" icon="more" />);
  const button = screen.getByRole("button", { name: "More actions" });
  expect(button).toHaveAttribute("aria-label", "More actions");
  expect(button).toHaveAttribute("data-x", "menu");
});

it("given a ref, when rendered, then it points at the button", () => {
  const ref = createRef<HTMLButtonElement>();
  render(<Button ref={ref}>Start</Button>);
  expect(ref.current).toBe(screen.getByRole("button", { name: "Start" }));
});

it("given variant danger-quiet, when rendered, then it has red text and no solid red fill", () => {
  render(<Button variant="danger-quiet">Remove</Button>);
  const button = screen.getByRole("button", { name: "Remove" });
  expect(button).toHaveClass("text-bad", "!text-bad");
  expect(button).not.toHaveClass("bg-bad-solid", "bg-bad-fill", "shadow-danger");
});

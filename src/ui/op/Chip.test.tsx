import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Chip, ChipButton } from "./Chip";

it("given pressed, when rendered, then aria-pressed is true", () => {
  render(<ChipButton pressed>Follow</ChipButton>);
  expect(screen.getByRole("button", { name: "Follow" })).toHaveAttribute("aria-pressed", "true");
});

it("given no pressed, when rendered, then there is no aria-pressed attribute", () => {
  render(<ChipButton>Built in</ChipButton>);
  expect(screen.getByRole("button", { name: "Built in" })).not.toHaveAttribute("aria-pressed");
});

it("given a Chip, when rendered, then it is a span with class chip", () => {
  render(<Chip>Built in</Chip>);
  const chip = screen.getByText("Built in");
  expect(chip.tagName).toBe("SPAN");
  expect(chip).toHaveClass("chip");
});

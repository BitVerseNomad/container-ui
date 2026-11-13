import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { Progress } from "./Progress";

it("given value 0.5, when rendered, then it has value 0.5", () => {
  const { container } = render(<Progress value={0.5} aria-label="Pulling" />);
  expect(container.querySelector("progress")).toHaveAttribute("value", "0.5");
});

it("given value null, when rendered, then it has no value attribute", () => {
  const { container } = render(<Progress value={null} aria-label="Pulling" />);
  expect(container.querySelector("progress")).not.toHaveAttribute("value");
});

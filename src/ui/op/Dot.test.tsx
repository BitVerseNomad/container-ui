import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Dot } from "./Dot";

it("given state off, when rendered, then class is exactly dot", () => {
  const { container } = render(<Dot state="off" />);
  expect(container.querySelector("span")?.className).toBe("dot");
});

it("given a label, when rendered, then it has role img and the label", () => {
  render(<Dot state="ok" label="Running" />);
  expect(screen.getByRole("img", { name: "Running" })).toHaveClass("dot", "ok");
});

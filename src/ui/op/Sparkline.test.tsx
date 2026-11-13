import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Sparkline } from "./Sparkline";

it("given null, then it renders a span.spark and no svg", () => {
  const { container } = render(<Sparkline points={null} label="CPU 4 percent" />);
  const spark = container.querySelector(".spark") as HTMLElement;
  expect(spark.tagName).toBe("SPAN");
  expect(container.querySelector("svg")).toBeNull();
});

it("given three points, then the polyline has three coordinate pairs", () => {
  const { container } = render(<Sparkline points={[1, 2, 3]} label="CPU 4 percent" />);
  const points = container.querySelector("polyline")?.getAttribute("points")?.split(" ") ?? [];
  expect(points).toHaveLength(3);
  expect(points.every((pair) => pair.includes(","))).toBe(true);
});

it("then the label is the accessible name", () => {
  render(<Sparkline points={[1, 2, 3]} label="CPU 4 percent" />);
  expect(screen.getByRole("img", { name: "CPU 4 percent" })).toBeInTheDocument();
});
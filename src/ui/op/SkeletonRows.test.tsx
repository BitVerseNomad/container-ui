import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { SkeletonRows } from "./SkeletonRows";

it("given no rows prop, when rendered, then there are four rows with two skeletons each", () => {
  const { container } = render(<SkeletonRows />);
  expect(container.querySelectorAll(".row")).toHaveLength(4);
  for (const row of container.querySelectorAll(".row")) expect(row.querySelectorAll(".skeleton")).toHaveLength(2);
});

it("given no rows prop, when rendered, then the root is busy and labelled Loading", () => {
  const { container } = render(<SkeletonRows />);
  const root = container.firstElementChild!;
  expect(root).toHaveAttribute("aria-busy", "true");
  expect(root).toHaveAttribute("aria-label", "Loading");
});

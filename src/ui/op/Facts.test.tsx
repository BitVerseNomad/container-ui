import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Facts } from "./Facts";

it("given items, when rendered, then each label is sr-only and each value is visible", () => {
  const { container } = render(<Facts items={[{ label: "Created", value: "2 hours ago" }, { label: "Size", value: "200 MB" }]} />);
  expect(container.querySelector(".facts")).toBeInTheDocument();
  expect(screen.getByText(/Created:/)).toHaveClass("sr-only");
  expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  expect(screen.getByText(/Size:/)).toHaveClass("sr-only");
  expect(screen.getByText("200 MB")).toBeInTheDocument();
});

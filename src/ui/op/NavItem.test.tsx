import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { NavItem } from "./NavItem";

it("given current, when rendered, then aria-current is page", () => {
  render(<NavItem href="#containers" label="Containers" current />);
  expect(screen.getByRole("link", { name: "Containers" })).toHaveAttribute("aria-current", "page");
});

it("given not current, when rendered, then aria-current is absent", () => {
  render(<NavItem href="#images" label="Images" />);
  expect(screen.getByRole("link", { name: "Images" })).not.toHaveAttribute("aria-current");
});

it("given a count with countBad, when rendered, then the count has classes count bad", () => {
  const { container } = render(<NavItem href="#doctor" label="Doctor" count={2} countBad countLabel="2 problems" />);
  expect(container.querySelector(".count")).toHaveClass("count", "bad");
  expect(container.querySelector(".count")).toHaveAttribute("aria-label", "2 problems");
});

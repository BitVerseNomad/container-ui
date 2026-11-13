import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { Icon } from "./Icon";

it("given a name, when rendered, then there is one svg with class icon and aria-hidden true", () => {
  const { container } = render(<Icon name="search" />);
  const svgs = container.querySelectorAll("svg");
  expect(svgs).toHaveLength(1);
  expect(svgs[0]).toHaveClass("icon");
  expect(svgs[0]).toHaveAttribute("aria-hidden", "true");
});

it("given size sm, when rendered, then the class list has sm", () => {
  const { container } = render(<Icon name="plus" size="sm" />);
  expect(container.querySelector("svg")).toHaveClass("icon", "sm");
});

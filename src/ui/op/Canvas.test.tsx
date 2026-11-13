import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { Canvas } from "./Canvas";

it("given a line with level e, when rendered, then the line has class e", () => {
  const { container } = render(<Canvas aria-label="Output" lines={[{ text: "boom", level: "e" }]} />);
  expect(container.querySelector(".ln")).toHaveClass("e");
});

it("given no lines, when rendered, then the children render inside the pre", () => {
  const { container } = render(<Canvas aria-label="Output">plain text</Canvas>);
  expect(container.querySelector("pre")).toHaveTextContent("plain text");
});

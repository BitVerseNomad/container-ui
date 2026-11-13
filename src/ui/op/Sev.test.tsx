import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { Sev } from "./Sev";

it("given level bad, when rendered, then it has classes sev bad", () => {
  const { container } = render(<Sev level="bad" />);
  const svg = container.querySelector("svg");
  expect(svg).toHaveClass("sev", "bad");
});

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Status, { type Level } from "./Status";

const dotOf = (level: Level) => {
  const { container } = render(<Status level={level}>Running</Status>);
  return container.querySelector(".dot");
};

describe("Status dot", () => {
  it("given level on, when rendered, then the dot uses the green ok token like the sidebar", () => {
    expect(dotOf("on")).toHaveClass("dot", "ok");
  });

  it("given level off, when rendered, then the dot is neutral with no state colour", () => {
    expect(dotOf("off")?.className).toBe("dot");
  });

  it("given level busy, when rendered, then the dot uses the accent busy style", () => {
    expect(dotOf("busy")).toHaveClass("dot", "busy");
  });

  it("given level warn, when rendered, then the dot uses the warn token", () => {
    expect(dotOf("warn")).toHaveClass("dot", "warn");
  });
});

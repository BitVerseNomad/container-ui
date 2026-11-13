import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { GroupCaption } from "./GroupCaption";

it("given text and a count, when rendered, then the class and the count render", () => {
  const { container } = render(<GroupCaption count={3}>Used by</GroupCaption>);
  const caption = container.querySelector(".group-cap")!;
  expect(caption).toHaveTextContent("Used by");
  expect(caption.querySelector(".count")).toHaveTextContent("· 3");
});

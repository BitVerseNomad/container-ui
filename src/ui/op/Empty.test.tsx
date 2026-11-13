import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Empty } from "./Empty";

it("given a title, text and actions, when rendered, then all render inside empty", () => {
  const { container } = render(
    <Empty icon="box" title="No containers yet" actions={<button>Run an image</button>}>
      Run an image, or start a Compose project from a folder.
    </Empty>,
  );
  const root = container.querySelector(".empty")!;
  expect(root).toContainElement(screen.getByText("No containers yet"));
  expect(root).toContainElement(screen.getByText("Run an image, or start a Compose project from a folder."));
  expect(root).toContainElement(screen.getByRole("button", { name: "Run an image" }));
});

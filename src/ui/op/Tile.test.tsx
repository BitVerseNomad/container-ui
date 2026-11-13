import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Tile, Tiles } from "./Tile";

it("given Tiles, when rendered, then it has class tiles and contains its children", () => {
  const { container } = render(<Tiles><span>one</span></Tiles>);
  expect(container.querySelector(".tiles")).toContainElement(screen.getByText("one"));
});

it("given a label, value and child, when Tile is rendered, then all three render", () => {
  const { container } = render(<Tile label="Images" value="1.6 GB"><button>Remove unused</button></Tile>);
  const tile = container.querySelector(".tile")!;
  expect(tile).toContainElement(screen.getByText("Images"));
  expect(tile).toContainElement(screen.getByText("1.6 GB"));
  expect(tile).toContainElement(screen.getByRole("button", { name: "Remove unused" }));
});

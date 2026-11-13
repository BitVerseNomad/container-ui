import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Blocks, type BlockState } from "./Blocks";

const services: { name: string; state: BlockState; label: string }[] = [
  { name: "api", state: "ok", label: "Running" },
  { name: "web", state: "bad", label: "Unhealthy" },
  { name: "db", state: "off", label: "Stopped" },
];

it("given states ok, bad and off, then the u classes are empty, bad and off", () => {
  const { container } = render(<Blocks services={services} />);
  const blocks = container.querySelectorAll("u");
  expect(blocks).toHaveLength(3);
  expect(blocks[0].className).toBe("");
  expect(blocks[1]).toHaveClass("bad");
  expect(blocks[2]).toHaveClass("off");
});

it("given 11 services, then there are 9 blocks and the last has text +3", () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ name: `s${i}`, state: "ok" as const, label: "Running" }));
  const { container } = render(<Blocks services={many} />);
  const blocks = container.querySelectorAll("u");
  expect(blocks).toHaveLength(9);
  expect(blocks[8]).toHaveTextContent("+3");
});

it("then the accessible name counts the ok ones", () => {
  render(<Blocks services={services} />);
  expect(screen.getByRole("img", { name: "1 of 3 running" })).toBeInTheDocument();
});
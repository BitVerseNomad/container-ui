import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Banner } from "./Banner";

it("given tone bad, when rendered, then role is alert", () => {
  render(<Banner tone="bad" title="Could not list containers">Docker did not answer.</Banner>);
  expect(screen.getByRole("alert")).toHaveClass("banner", "bad");
});

it("given tone info, when rendered, then role is status", () => {
  render(<Banner tone="info">The image was pulled.</Banner>);
  expect(screen.getByRole("status")).toHaveClass("banner", "info");
});

it("given a title and actions, when rendered, then both render", () => {
  render(<Banner tone="warn" title="Restarting" actions={<button>See why</button>}>It stopped six times.</Banner>);
  expect(screen.getByText("Restarting")).toHaveClass("title");
  expect(screen.getByRole("button", { name: "See why" })).toBeInTheDocument();
});

it("given no title, when rendered, then the root has class line and there is no title", () => {
  const { container } = render(<Banner tone="warn">Only reachable from your Mac.</Banner>);
  expect(container.querySelector(".banner")).toHaveClass("line");
  expect(container.querySelector(".title")).toBeNull();
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Problem } from "./Problem";

it("given level busy, then there is a .spinner and no .sev", () => {
  const { container } = render(<Problem level="busy" text="Fixing…" />);
  expect(container.querySelector(".spinner")).not.toBeNull();
  expect(container.querySelector(".sev")).toBeNull();
});

it("given level ok, then Sev has class ok", () => {
  const { container } = render(<Problem level="ok" text="Fixed." />);
  expect(container.querySelector(".sev.ok")).not.toBeNull();
});

it("given text with an element inside, then it renders", () => {
  const { container } = render(<Problem level="bad" text={<>It keeps <strong>crashing</strong></>} />);
  expect(container.querySelector(".what")).toHaveTextContent("It keeps crashing");
});

it("given title, then span.what has it", () => {
  const { container } = render(<Problem level="bad" text="It keeps crashing" title="Health check is failing" />);
  expect(container.querySelector(".what")).toHaveAttribute("title", "Health check is failing");
});

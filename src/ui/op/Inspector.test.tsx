import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Inspector } from "./Inspector";

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

function renderInspector(onClose = vi.fn()) {
  const result = render(
    <Inspector
      open
      onClose={onClose}
      crumb="shop / api"
      title="Its health check is failing"
      lede="The container is running, but the checks cannot connect."
      evidence={[{ text: "ok line" }, { text: "bad line", bad: true }]}
      findings={["The logs say :3000.", "PORT is not set."]}
      actions={<><Button>Fix</Button><Button>Open logs</Button></>}
      command="docker --context colima compose -p shop up -d api"
    />,
  );
  return { ...result, onClose };
}

it("given evidence with one bad line, then that line is inside b", () => {
  const { container } = renderInspector();
  const bad = document.querySelector(".ins pre b");
  expect(bad).toHaveTextContent("bad line");
});

it("given two findings, then steps has two children and the second starts with 2", () => {
  const { container } = renderInspector();
  const steps = document.querySelector(".ins .steps") as HTMLElement;
  expect(steps.children).toHaveLength(2);
  expect(steps.children[1].textContent).toMatch(/^2/);
});

it("then the buttons are inside acts", () => {
  const { container } = renderInspector();
  const acts = document.querySelector(".ins .acts") as HTMLElement;
  expect(acts).toContainElement(screen.getByRole("button", { name: "Fix" }));
});

it("when Escape is pressed, then onClose is called", async () => {
  const user = userEvent.setup();
  const { onClose } = renderInspector();
  await user.keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
});
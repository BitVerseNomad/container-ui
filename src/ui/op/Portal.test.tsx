import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { PortalProvider } from "./Portal";
import { Sheet } from "./Sheet";

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

it("given a provider with a container, then the sheet is a descendant of that container", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(
    <PortalProvider container={host}>
      <Sheet open onClose={() => {}} title="Run">
        <span>Body</span>
      </Sheet>
    </PortalProvider>,
  );
  expect(host.querySelector(".sheet")).not.toBeNull();
  host.remove();
});

it("given no provider, then the sheet is a descendant of document.body", () => {
  const { container } = render(
    <Sheet open onClose={() => {}} title="Run">
      <span>Body</span>
    </Sheet>,
  );
  const sheet = document.querySelector(".sheet") as HTMLElement;
  expect(sheet).not.toBeNull();
  expect(container.contains(sheet)).toBe(false);
  expect(document.body.contains(sheet)).toBe(true);
});
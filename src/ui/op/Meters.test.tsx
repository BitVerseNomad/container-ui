import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Meters, type Meter } from "./Meters";

const meter: Meter = { label: "CPU", share: 0.64, text: "64%" };

it("given an empty list, then it renders nothing", () => {
  const { container } = render(<Meters meters={[]} />);
  expect(container).toBeEmptyDOMElement();
});

it("given share 0.64, then the meter sets --v to 64%", () => {
  const { container } = render(<Meters meters={[meter]} />);
  const first = container.querySelector(".meter") as HTMLElement;
  expect(first.style.getPropertyValue("--v")).toBe("64%");
});

it("given hot, then the meter has class hot", () => {
  const { container } = render(<Meters meters={[{ ...meter, hot: true }]} />);
  expect(container.querySelector(".meter")).toHaveClass("hot");
});

it("when the meters are clicked, then onOpen is called", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(<Meters meters={[meter]} onOpen={onOpen} />);
  await user.click(screen.getByRole("button", { name: "Machine use. Open machine settings" }));
  expect(onOpen).toHaveBeenCalledTimes(1);
});
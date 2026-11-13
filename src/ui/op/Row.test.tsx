import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Col, Dim, List, Row } from "./Row";

function pressShiftF10(row: HTMLElement): void {
  row.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
}

it("given onMenuKey, when Shift+F10 is pressed on the row, then it is called once and onOpen is not", () => {
  const onMenuKey = vi.fn();
  const onOpen = vi.fn();
  render(<Row lead={null} name="kafka" meta="apache/kafka:3.8" onOpen={onOpen} onMenuKey={onMenuKey} />);
  const row = screen.getByText("kafka").closest(".row") as HTMLElement;
  pressShiftF10(row);
  expect(onMenuKey).toHaveBeenCalledTimes(1);
  expect(onOpen).not.toHaveBeenCalled();
});

it("given the ContextMenu key, then onMenuKey is called", () => {
  const onMenuKey = vi.fn();
  render(<Row lead={null} name="kafka" onMenuKey={onMenuKey} />);
  const row = screen.getByText("kafka").closest(".row") as HTMLElement;
  row.dispatchEvent(new KeyboardEvent("keydown", { key: "ContextMenu", bubbles: true }));
  expect(onMenuKey).toHaveBeenCalledTimes(1);
});

it("given onMenuKey, when Shift+F10 is pressed inside the action button, then onMenuKey is not called", async () => {
  const user = userEvent.setup();
  const onMenuKey = vi.fn();
  render(<Row lead={null} name="kafka" action={<Button>Stop</Button>} onMenuKey={onMenuKey} />);
  await user.click(screen.getByRole("button", { name: "Stop" }));
  const btn = screen.getByRole("button", { name: "Stop" });
  btn.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
  expect(onMenuKey).not.toHaveBeenCalled();
});

it("given onOpen, when the row is clicked, then it is called once", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(<Row lead={null} name="kafka" meta="apache/kafka:3.8" onOpen={onOpen} />);
  const row = screen.getByText("kafka").closest(".row") as HTMLElement;
  await user.click(row);
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it("given a row with an action button, when the button is clicked, then onOpen is not called", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(<Row lead={null} name="kafka" action={<Button>Stop</Button>} onOpen={onOpen} />);
  await user.click(screen.getByRole("button", { name: "Stop" }));
  expect(onOpen).not.toHaveBeenCalled();
});

it("given a focused row, when Enter is pressed, then onOpen is called", async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(<Row lead={null} name="kafka" onOpen={onOpen} />);
  const row = screen.getByText("kafka").closest(".row") as HTMLElement;
  row.focus();
  await user.keyboard("{Enter}");
  expect(onOpen).toHaveBeenCalledTimes(1);
});

it("given three rows in a list, when ArrowDown is pressed on the first, then the second has focus", async () => {
  const user = userEvent.setup();
  render(
    <List aria-label="Containers">
      <Row lead={null} name="one" />
      <Row lead={null} name="two" />
      <Row lead={null} name="three" />
    </List>,
  );
  const rows = screen.getAllByRole("row");
  rows[0].focus();
  await user.keyboard("{ArrowDown}");
  expect(rows[1]).toHaveFocus();
});

it("given an expanded row, when ArrowLeft is pressed, then onToggle is called", async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  render(<Row lead={null} name="shop" expanded onToggle={onToggle} />);
  const row = screen.getByText("shop").closest(".row") as HTMLElement;
  row.focus();
  await user.keyboard("{ArrowLeft}");
  expect(onToggle).toHaveBeenCalledTimes(1);
});

it("given onSelect, when Space is pressed, then onSelect is called with true", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<Row lead={null} name="kafka" selected={false} onSelect={onSelect} />);
  const row = screen.getByText("kafka").closest(".row") as HTMLElement;
  row.focus();
  await user.keyboard(" ");
  expect(onSelect).toHaveBeenCalledWith(true);
});

it("given tall, then the root has classes row tall and the action is inside side", () => {
  render(<Row tall lead={null} name="Doctor" meta="3 problems" action={<Button>Fix</Button>} />);
  const row = screen.getByText("Doctor").closest(".row") as HTMLElement;
  expect(row).toHaveClass("row", "tall");
  expect(screen.getByRole("button", { name: "Fix" }).parentElement).toHaveClass("side");
});

it("given a name with a Dim part, then the name cell holds a dim with that text", () => {
  const { container } = render(<Row lead={null} name={<>mysql<Dim>:8</Dim></>} />);
  const name = container.querySelector(".row .name") as HTMLElement;
  expect(name.querySelector(".dim")).toHaveTextContent(":8");
});

it("given a state-words column, then it has classes col state words", () => {
  const { container } = render(<Col kind="state-words">Running</Col>);
  expect(container.firstElementChild).toHaveClass("col", "state", "words");
});

it("given a number lead, then the lead cell has classes lead num", () => {
  const { container } = render(<Row lead={3} name="Choose a folder" />);
  expect(container.querySelector(".lead")).toHaveClass("lead", "num");
});

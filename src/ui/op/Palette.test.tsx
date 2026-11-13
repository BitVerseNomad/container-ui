import { test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import { Palette } from "./Palette";
import { usePortalContainer, PortalProvider } from "./Portal";

test("Palette: Given two sections, When rendered, Then the captions show and the input has focus", () => {
  const sections = [
    { group: "Go to", items: [{ id: "c1", label: "Containers", kbd: "⌘2" }] },
    { group: "Actions", items: [{ id: "a1", label: "Run Doctor", kbd: "⌘D" }] },
  ];
  render(<Palette open={true} onClose={() => {}} query="" onQuery={() => {}} sections={sections} onRun={() => {}} />);
  expect(screen.getByText("Go to")).toBeInTheDocument();
  expect(screen.getByText("Actions")).toBeInTheDocument();
  const input = screen.getByLabelText("Search commands and containers");
  expect(input).toHaveFocus();
});

test("Palette: Given three entries, When ArrowDown is pressed twice and Enter, Then onRun gets the third id", () => {
  let ranId: string | null = null;
  const sections = [
    { group: "Go to", items: [
      { id: "c1", label: "Containers" },
      { id: "c2", label: "Images" },
      { id: "c3", label: "Volumes" },
    ] },
  ];
  render(<Palette open={true} onClose={() => {}} query="" onQuery={() => {}} sections={sections} onRun={(id) => { ranId = id; }} />);
  const input = screen.getByLabelText("Search commands and containers");
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "ArrowDown" });
  fireEvent.keyDown(input, { key: "Enter" });
  expect(ranId).toBe("c3");
});

test("Palette: Given a click on the second entry, Then onRun gets its id", () => {
  let ranId: string | null = null;
  const sections = [
    { group: "Go to", items: [
      { id: "c1", label: "Containers" },
      { id: "c2", label: "Images" },
    ] },
  ];
  render(<Palette open={true} onClose={() => {}} query="" onQuery={() => {}} sections={sections} onRun={(id) => { ranId = id; }} />);
  fireEvent.click(screen.getByText("Images"));
  expect(ranId).toBe("c2");
});

test("Palette: Given the first entry has enter ↵ Open, Then that text shows while it is highlighted", () => {
  const sections = [
    { group: "Go to", items: [{ id: "c1", label: "Containers", enter: "↵ Open" }] },
  ];
  render(<Palette open={true} onClose={() => {}} query="" onQuery={() => {}} sections={sections} onRun={() => {}} />);
  // highlighted starts at 0, so the first entry is highlighted and enter text shows
  expect(screen.getByText("↵ Open")).toBeInTheDocument();
});

test("Palette: Given two sections A (one entry) and B (two entries), When rendered, Then the order of captions and options in the list is A, a1, B, b1, b2", () => {
  const sections = [
    { group: "A", items: [{ id: "a1", label: "a1" }] },
    { group: "B", items: [{ id: "b1", label: "b1" }, { id: "b2", label: "b2" }] },
  ];
  render(<Palette open={true} onClose={() => {}} query="" onQuery={() => {}} sections={sections} onRun={() => {}} />);
  const roles = screen.getAllByRole("option");
  const captions = screen.getAllByText(/^[AB]$/);
  // Order in DOM: caption A, option a1, caption B, option b1, option b2
  const allTexts = Array.from(document.querySelectorAll(".menu-cap, .menu-item")).map((el) => el.textContent?.trim()).filter(Boolean);
  expect(allTexts).toEqual(["A", "a1", "B", "b1", "b2"]);
});

test("Palette: Given a section with no entries, When rendered, Then its caption does not show", () => {
  const sections = [
    { group: "Empty", items: [] },
    { group: "Has items", items: [{ id: "x1", label: "x1" }] },
  ];
  render(<Palette open={true} onClose={() => {}} query="" onQuery={() => {}} sections={sections} onRun={() => {}} />);
  expect(screen.getByText("Has items")).toBeInTheDocument();
  expect(screen.queryByText("Empty")).not.toBeInTheDocument();
});

test("Palette: Given Escape, Then onClose is called", () => {
  let closed = false;
  render(<Palette open={true} onClose={() => { closed = true; }} query="" onQuery={() => {}} sections={[]} onRun={() => {}} />);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(closed).toBe(true);
});

test("Palette: Given a typed letter, Then onQuery gets the new text", () => {
  let query = "";
  render(<Palette open={true} onClose={() => {}} query="" onQuery={(q) => { query = q; }} sections={[]} onRun={() => {}} />);
  const input = screen.getByLabelText("Search commands and containers");
  fireEvent.change(input, { target: { value: "a" } });
  expect(query).toBe("a");
});

test("Palette: Given no sections and the query zzz, Then the text Nothing matches zzz. shows", () => {
  render(<Palette open={true} onClose={() => {}} query="zzz" onQuery={() => {}} sections={[]} onRun={() => {}} />);
  expect(screen.getByText('Nothing matches "zzz".')).toBeInTheDocument();
});

test("Palette: Given a PortalProvider with a div, When open, Then the palette is inside that div", () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(
    <PortalProvider container={host}>
      <Palette open={true} onClose={() => {}} query="" onQuery={() => {}} sections={[]} onRun={() => {}} />
    </PortalProvider>,
  );
  expect(host.querySelector(".palette")).toBeInTheDocument();
  document.body.removeChild(host);
});

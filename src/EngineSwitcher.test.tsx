import React from "react";
import { describe, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import EngineSwitcher from "./EngineSwitcher";
import type { ColimaEngine } from "./lib/engineModel.ts";

const GB = 1024 ** 3;

const engines: ColimaEngine[] = [
  {
    id: "default",
    context: "colima",
    caption: "Colima",
    name: "default",
    label: "Colima · default",
    state: "running",
    managed: true,
    cpus: 4,
    memoryGb: 8,
    kubernetes: true,
  },
  {
    id: "dev",
    context: "colima-dev",
    caption: "Colima",
    name: "dev",
    label: "Colima · dev",
    state: "stopped",
    managed: true,
    cpus: 2,
    memoryGb: 4,
    kubernetes: false,
  },
];

function renderSwitcher(overrides: Partial<EngineSwitcherProps> = {}) {
  const props: EngineSwitcherProps = {
    engines,
    selectedId: "default",
    open: true,
    onOpenChange: () => {},
    onSelect: () => {},
    onStart: () => {},
    onStop: () => {},
    onMachines: () => {},
    ...overrides,
  };
  return render(<EngineSwitcher {...props} />);
}

test("Given two engines and the menu open, when rendered, then the caption 'Colima' shows once and two radio items show", () => {
  renderSwitcher();
  const captions = screen.getAllByText("Colima");
  expect(captions).toHaveLength(1);
  const radios = screen.getAllByRole("menuitemradio");
  expect(radios).toHaveLength(2);
});

test("Given the stopped engine, when its Start button is pressed, then onStart gets its id and onSelect is not called", () => {
  const onStart = vi.fn();
  const onSelect = vi.fn();
  renderSwitcher({ selectedId: "default", onStart, onSelect });
  // Click Start on the dev (stopped) engine
  const startButtons = screen.getAllByRole("button", { name: "Start" });
  expect(startButtons).toHaveLength(1);
  fireEvent.click(startButtons[0]);
  expect(onStart).toHaveBeenCalledWith("dev");
  expect(onSelect).not.toHaveBeenCalled();
});

test("Given the selected engine is running, when open, then 'Stop default' is offered; given it is stopped, then it is not", () => {
  // Running default -> "Stop default" offered
  renderSwitcher({ selectedId: "default" });
  expect(screen.getByRole("menuitem", { name: /Stop default/ })).toBeInTheDocument();

  // Stopped dev -> "Stop dev" not offered
  renderSwitcher({ selectedId: "dev" });
  expect(screen.queryByRole("menuitem", { name: /Stop dev/ })).not.toBeInTheDocument();
});

test("Given an item is chosen, when pressed, then onSelect gets its id", () => {
  const onSelect = vi.fn();
  renderSwitcher({ selectedId: "default", onSelect });
  const devItem = screen.getByRole("menuitemradio", { name: /dev/ });
  fireEvent.click(devItem);
  expect(onSelect).toHaveBeenCalledWith("dev");
});

test("Given no engines, when rendered, then the button says 'No engine' and the menu offers only 'Machines…'", () => {
  renderSwitcher({ engines: [], selectedId: null });
  expect(screen.getByText("No engine")).toBeInTheDocument();
  expect(screen.getByRole("menuitem", { name: /Machines…/ })).toBeInTheDocument();
});

test("Given the menu is open, when Escape is pressed, then onOpenChange(false) is called", () => {
  const onOpenChange = vi.fn();
  renderSwitcher({ open: true, onOpenChange });
  fireEvent.keyDown(document.activeElement, { key: "Escape" });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

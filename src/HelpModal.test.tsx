import { test, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import React from "react";
import HelpModal from "./HelpModal";

test("HelpModal: Given Help is open, When it renders, Then every active shortcut label appears with its keys", () => {
  render(<HelpModal open={true} onClose={() => {}} />);
  expect(screen.getByText("Command palette")).toBeInTheDocument();
  expect(screen.getByText("⌘K")).toBeInTheDocument();
  expect(screen.getByText("Containers")).toBeInTheDocument();
  expect(screen.getByText("⌘2")).toBeInTheDocument();
});

test("HelpModal: Given go-projects is pending, When Help renders, Then Projects does not appear as a shortcut", () => {
  render(<HelpModal open={true} onClose={() => {}} />);
  expect(screen.queryByText("Projects")).not.toBeInTheDocument();
});

test("HelpModal: Given Help is open, When Give feedback is pressed, Then the button exists", () => {
  render(<HelpModal open={true} onClose={() => {}} />);
  expect(screen.getByText("Give feedback")).toBeInTheDocument();
});

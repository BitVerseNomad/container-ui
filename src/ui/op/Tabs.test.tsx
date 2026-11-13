import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { TabPanel, Tabs } from "./Tabs";

const items = [
  { value: "one", label: "One" },
  { value: "two", label: "Two" },
];

it("given two tabs, when ArrowRight is pressed on the first, then onChange is called with the second value", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(
    <Tabs value="one" onChange={onChange} items={items} aria-label="Views">
      <TabPanel value="one">First</TabPanel>
      <TabPanel value="two">Second</TabPanel>
    </Tabs>,
  );
  const first = screen.getByRole("tab", { name: "One" });
  first.focus();
  await user.keyboard("{ArrowRight}");
  expect(onChange).toHaveBeenCalledWith("two");
});

it("given a selected tab, when rendered, then its trigger has aria-selected true", () => {
  render(
    <Tabs value="one" onChange={() => {}} items={items} aria-label="Views">
      <TabPanel value="one">First</TabPanel>
    </Tabs>,
  );
  expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tab", { name: "Two" })).toHaveAttribute("aria-selected", "false");
});

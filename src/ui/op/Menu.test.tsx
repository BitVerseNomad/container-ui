import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Menu, MenuItem, MoreButton } from "./Menu";

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

it("given a menu, when the trigger has focus and Enter is pressed, then the first item has focus", async () => {
  const user = userEvent.setup();
  render(
    <Menu trigger={<Button>Actions</Button>} label="Actions">
      <MenuItem label="Logs" onSelect={() => {}} />
      <MenuItem label="Restart" onSelect={() => {}} />
    </Menu>,
  );
  const trigger = screen.getByRole("button", { name: "Actions" });
  trigger.focus();
  await user.keyboard("{Enter}");
  const first = await screen.findByRole("menuitem", { name: "Logs" });
  await waitFor(() => expect(first).toHaveFocus());
});

it("given a menu, when ArrowDown and Enter are pressed, then the second item is selected and the menu closes", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(
    <Menu trigger={<Button>Actions</Button>} label="Actions">
      <MenuItem label="Logs" onSelect={() => {}} />
      <MenuItem label="Restart" onSelect={onSelect} />
    </Menu>,
  );
  const trigger = screen.getByRole("button", { name: "Actions" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await screen.findByRole("menuitem", { name: "Logs" });
  await user.keyboard("{ArrowDown}{Enter}");
  await waitFor(() => expect(onSelect).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
});

it("given MoreButton name kafka, then its accessible name is More actions for kafka", () => {
  render(<MoreButton name="kafka" />);
  expect(screen.getByRole("button", { name: "More actions for kafka" })).toBeInTheDocument();
});

it("given a danger item, when the menu opens, then the item has class danger", async () => {
  const user = userEvent.setup();
  render(
    <Menu trigger={<Button>Actions</Button>} label="Actions">
      <MenuItem label="Remove…" danger onSelect={() => {}} />
    </Menu>,
  );
  await user.click(screen.getByRole("button", { name: "Actions" }));
  const item = await screen.findByRole("menuitem", { name: "Remove…" });
  expect(item).toHaveClass("danger");
});
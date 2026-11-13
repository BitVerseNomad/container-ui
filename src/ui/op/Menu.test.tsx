import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";
import { Menu, MenuItem, MoreButton, MenuRadioGroup, MenuRadioItem } from "./Menu";
import { EngineButton } from "./EngineButton";

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

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

it("given open is true, when rendered, then the menu content is on screen without a click", () => {
  render(
    <Menu trigger={<Button>Actions</Button>} label="Actions" open>
      <MenuItem label="Logs" onSelect={() => {}} />
    </Menu>,
  );
  expect(screen.getByRole("menuitem", { name: "Logs" })).toBeInTheDocument();
});

it("given a controlled menu, when Escape is pressed, then onOpenChange is called with false", async () => {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(
    <Menu trigger={<Button>Actions</Button>} label="Actions" open onOpenChange={onOpenChange}>
      <MenuItem label="Logs" onSelect={() => {}} />
    </Menu>,
  );
  await user.keyboard("{Escape}");
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("given contentClassName 'engines', when open, then the content has classes pop and engines", () => {
  render(
    <Menu trigger={<Button>Actions</Button>} label="Actions" open contentClassName="engines">
      <MenuItem label="Logs" onSelect={() => {}} />
    </Menu>,
  );
  const content = screen.getByRole("menu");
  expect(content).toHaveClass("pop");
  expect(content).toHaveClass("engines");
});

it("given a MenuRadioGroup with value 'a' and items a and b, when rendered open, then item a has role menuitemradio and aria-checked 'true' and item b has 'false'", () => {
  render(
    <Menu trigger={<Button>Actions</Button>} label="Actions" open>
      <MenuRadioGroup value="a" onValueChange={() => {}}>
        <MenuRadioItem value="a">Item A</MenuRadioItem>
        <MenuRadioItem value="b">Item B</MenuRadioItem>
      </MenuRadioGroup>
    </Menu>,
  );
  const a = screen.getByRole("menuitemradio", { name: "Item A" });
  const b = screen.getByRole("menuitemradio", { name: "Item B" });
  expect(a).toHaveAttribute("aria-checked", "true");
  expect(b).toHaveAttribute("aria-checked", "false");
});

it("given an item b, when it is clicked, then onValueChange is called with 'b'", async () => {
  const user = userEvent.setup();
  const onValueChange = vi.fn();
  render(
    <Menu trigger={<Button>Actions</Button>} label="Actions" open>
      <MenuRadioGroup value="a" onValueChange={onValueChange}>
        <MenuRadioItem value="a">Item A</MenuRadioItem>
        <MenuRadioItem value="b">Item B</MenuRadioItem>
      </MenuRadioGroup>
    </Menu>,
  );
  await user.click(screen.getByRole("menuitemradio", { name: "Item B" }));
  expect(onValueChange).toHaveBeenCalledWith("b");
});

it("given an EngineButton as the trigger of a Menu, when Enter is pressed on it, then the menu opens", async () => {
  const user = userEvent.setup();
  render(
    <Menu
      trigger={<EngineButton dot="ok" name="Colima · default" state="Running · 4 CPU · 8 GB" aria-label="Engine: Colima, default. Running" />}
      label="Engines"
    >
      <MenuItem label="Machines…" onSelect={() => {}} />
    </Menu>,
  );
  const trigger = screen.getByRole("button", { name: "Engine: Colima, default. Running" });
  trigger.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("menuitem", { name: "Machines…" })).toBeInTheDocument();
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
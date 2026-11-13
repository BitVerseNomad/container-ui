import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { Button } from "./Button";
import { ConfirmProvider, useConfirm, type ConfirmOptions } from "./ConfirmDialog";

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

let answer: Promise<boolean> | null = null;

function Harness({ options }: { options: ConfirmOptions }) {
  const confirm = useConfirm();
  return <Button onClick={() => { answer = confirm(options); }}>Ask</Button>;
}

async function open(options: ConfirmOptions) {
  const user = userEvent.setup();
  render(
    <ConfirmProvider>
      <Harness options={options} />
    </ConfirmProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Ask" }));
  await screen.findByRole("alertdialog");
  return user;
}

const base: ConfirmOptions = {
  title: "Remove kafka-ui?",
  body: "This deletes the container. Its image and volumes are kept.",
  confirm: "Remove",
  danger: true,
};

it("given danger, when opened, then Cancel has focus", async () => {
  await open(base);
  await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus());
});

it("given not danger, when opened, then the confirm button has focus", async () => {
  await open({ ...base, danger: false, confirm: "Restart" });
  await waitFor(() => expect(screen.getByRole("button", { name: "Restart" })).toHaveFocus());
});

it("when confirm is clicked, then the promise resolves true", async () => {
  const user = await open(base);
  await user.click(screen.getByRole("button", { name: "Remove" }));
  await expect(answer).resolves.toBe(true);
});

it("when Escape is pressed, then the promise resolves false", async () => {
  const user = await open(base);
  await user.keyboard("{Escape}");
  await expect(answer).resolves.toBe(false);
});

it("given a command, then its text is on screen", async () => {
  await open({ ...base, command: "docker --context colima rm -f kafka-ui" });
  expect(screen.getByText("docker --context colima rm -f kafka-ui")).toBeInTheDocument();
});

it("given an option, when its checkbox is clicked, then option.onChange(true) is called", async () => {
  const onChange = vi.fn();
  const user = await open({ ...base, option: { label: "Only unnamed volumes", checked: false, onChange } });
  await user.click(screen.getByRole("checkbox", { name: "Only unnamed volumes" }));
  expect(onChange).toHaveBeenCalledWith(true);
});

it("then the two buttons are inside foot", async () => {
  await open(base);
  const dialog = screen.getByRole("alertdialog");
  const foot = dialog.querySelector(".foot") as HTMLElement;
  expect(foot).toContainElement(screen.getByRole("button", { name: "Cancel" }));
  expect(foot).toContainElement(screen.getByRole("button", { name: "Remove" }));
});
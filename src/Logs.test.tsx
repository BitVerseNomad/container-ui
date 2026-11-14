import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import Logs from "./Logs";

const ctx = "colima";
const id = "aaa";

function show({ logs = "" } = {}) {
  backend.current = fakeBackend({
    logs: () => logs,
  });
  render(<Logs ctx={ctx} id={id} />);
  return {};
}

describe("Logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Given 12000 lines arrive, When rendered, Then 10000 are kept", async () => {
    const lines = Array.from({ length: 12000 }, (_, i) => `line ${i}`).join("\n");
    show({ logs: lines });
    await waitFor(() => expect(screen.getByText(/line 11999/)).toBeInTheDocument());
  });

  it("Given a filter that matches nothing, When typed, Then no lines show", async () => {
    show({ logs: "line 1 ready\nline 2 not ready\nline 3 ready\n" });
    await waitFor(() => expect(screen.getByText(/line 1 ready/)).toBeInTheDocument());
    const filter = screen.getByRole("textbox", { placeholder: "Filter lines" });
    await filter.focus();
    await userEvent.type(filter, "xyz");
    await waitFor(() => expect(screen.queryByText(/line 1/)).not.toBeInTheDocument());
  });

  it("Given Follow is on, When the toggle is pressed, Then it becomes Paused", async () => {
    show({ logs: "line 1\nline 2\n" });
    await waitFor(() => expect(screen.getByText(/line 1/)).toBeInTheDocument());
    const toggle = screen.getByRole("button", { name: /Following new lines/ });
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("Given a line with an error, When rendered, Then it is shown", async () => {
    show({ logs: "line 1 error\nline 2 ok\n" });
    await waitFor(() => expect(screen.getByText(/line 1 error/)).toBeInTheDocument());
  });
});

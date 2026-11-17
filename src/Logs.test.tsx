import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import Logs from "./Logs";
import { ChipButton, Field, ToastProvider } from "./ui/op";

const ctx = "colima";
const id = "aaa";

// The page keeps the filter and Follow state and passes them down, as ContainerDetail does.
function Harness({ onCopy }: { onCopy: (copy: () => void) => void }) {
  const [filter, setFilter] = useState("");
  const [follow, setFollow] = useState(true);
  return (
    <ToastProvider>
      <Field placeholder="Filter lines" aria-label="Filter lines" value={filter} onChange={(e) => setFilter(e.target.value)} />
      <ChipButton pressed={follow} onClick={() => setFollow((f) => !f)}>Follow</ChipButton>
      <Logs ctx={ctx} id={id} name="api" filter={filter} follow={follow} onFollowChange={setFollow} registerCopy={onCopy} />
    </ToastProvider>
  );
}

function show({ logs = "" } = {}) {
  backend.current = fakeBackend({ logs: () => logs });
  const copies: Array<() => void> = [];
  render(<Harness onCopy={(copy) => copies.push(copy)} />);
  return { copy: () => copies.at(-1)?.() };
}

describe("Logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Given 12000 lines arrive, When rendered, Then only the last 10000 are kept", async () => {
    const lines = Array.from({ length: 12000 }, (_, i) => `line ${i}`).join("\n");
    show({ logs: lines });
    await waitFor(() => expect(screen.getByText(/line 11999/)).toBeInTheDocument());
    expect(document.querySelectorAll(".canvas .ln")).toHaveLength(10000);
    expect(screen.queryByText("line 1999")).not.toBeInTheDocument();
  }, 30_000);

  it("Given a filter that matches nothing, When typed, Then no lines show", async () => {
    show({ logs: "line 1 ready\nline 2 not ready\nline 3 ready\n" });
    await waitFor(() => expect(screen.getByText(/line 1 ready/)).toBeInTheDocument());
    const filter = screen.getByRole("textbox", { name: "Filter lines" });
    await userEvent.type(filter, "xyz");
    await waitFor(() => expect(screen.queryByText(/line 1/)).not.toBeInTheDocument());
  });

  it("Given Follow is on, When the user scrolls up, Then Follow is no longer pressed", async () => {
    show({ logs: "line 1\nline 2\n" });
    await waitFor(() => expect(screen.getByText(/line 1/)).toBeInTheDocument());
    const chip = screen.getByRole("button", { name: "Follow" });
    expect(chip).toHaveAttribute("aria-pressed", "true");
    const pane = screen.getByLabelText("Logs of api");
    pane.scrollTop = 100;
    fireEvent.scroll(pane);
    pane.scrollTop = 50;
    fireEvent.scroll(pane);
    await waitFor(() => expect(chip).toHaveAttribute("aria-pressed", "false"));
  });

  it("Given a line with an error, When rendered, Then it carries the error class", async () => {
    show({ logs: "line 1 error\nline 2 ok\n" });
    await waitFor(() => expect(screen.getByText(/line 1 error/)).toBeInTheDocument());
    expect(document.querySelector(".ln.e")).toHaveTextContent("line 1 error");
  });

  it("Given lines are shown, When Copy logs is pressed, Then the visible lines are copied and confirmed", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    const page = show({ logs: "line 1 ready\nline 2 not ready\n" });
    await waitFor(() => expect(screen.getByText(/line 2/)).toBeInTheDocument());
    page.copy();
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("line 2 not ready")));
    expect(await screen.findByText("Copied logs")).toBeInTheDocument();
  });
});

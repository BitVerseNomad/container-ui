import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fakeBackend, jsonLines } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import Volumes from "./Volumes";
import { ConfirmProvider } from "./ui/op";

const ANON = "a".repeat(64);

describe("Volumes", () => {
  it("given Docker can't say which containers use the volumes, when the page loads, then no volume is offered for bulk removal", async () => {
    backend.current = fakeBackend({
      volume: () => jsonLines([{ Name: ANON, Driver: "local" }]),
      ps: () => "c1",
      inspect: () => { throw new Error("No such container: c1"); },
      system: () => "",
    });
    render(<ConfirmProvider><Volumes ctx="colima" /></ConfirmProvider>);
    await waitFor(() => expect(screen.getByText(/No such container/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Remove unused anonymous \(0\)/ })).toBeDisabled();
  });
});

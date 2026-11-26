import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend, jsonLines } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import Networks from "./Networks";
import { ConfirmProvider } from "./ui/op";

describe("Networks", () => {
  it("given creating a network fails, when Create network is pressed, then the typed name stays so it can be fixed and tried again", async () => {
    const user = userEvent.setup();
    backend.current = fakeBackend({
      network: (args) => {
        if (args[1] === "create") throw new Error("network with name devnet already exists");
        return args[1] === "ls" ? jsonLines([{ Name: "bridge" }]) : "[]";
      },
      ps: () => "",
    });
    render(<ConfirmProvider><Networks ctx="colima" /></ConfirmProvider>);
    const field = screen.getByLabelText("New network name");
    await user.type(field, "devnet");
    await user.click(screen.getByRole("button", { name: "Create network" }));
    await waitFor(() => expect(screen.getByText(/already exists/)).toBeInTheDocument());
    expect(field).toHaveValue("devnet");
  });
});

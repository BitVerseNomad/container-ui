import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend, jsonLines } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import RunPicker from "./RunPicker";

describe("RunPicker", () => {
  it("Given images on this Mac, When an image is typed and Continue is pressed, Then onPick gets the reference", async () => {
    const user = userEvent.setup();
    backend.current = fakeBackend({
      images: () => jsonLines([{ ID: "abc", Repository: "postgres", Tag: "16", Size: "400MB" }]),
    });
    const onPick = vi.fn();
    render(<RunPicker ctx="colima" onPick={onPick} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole("table", { name: "Images you have" })).toHaveTextContent("postgres:16"));
    await user.type(screen.getByLabelText("Image to run"), "postgres:16");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onPick).toHaveBeenCalledWith("postgres:16");
  });
});

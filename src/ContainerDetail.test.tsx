import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import ContainerDetail from "./ContainerDetail";
import { ConfirmProvider } from "./ui/op";

const ctx = "colima";
const id = "aaa";

function show({ inspect = "[]" } = {}) {
  backend.current = fakeBackend({
    docker: () => inspect,
    inspect: () => inspect,
  });
  render(
    <ConfirmProvider>
      <ContainerDetail ctx={ctx} id={id} />
    </ConfirmProvider>
  );
  return {};
}

const runningInspect = JSON.stringify([{ Name: "/api", State: { Status: "running" }, Config: { Image: "nginx:latest" } }]);
const stoppedInspect = JSON.stringify([{ Name: "/api", State: { Status: "exited" }, Config: { Image: "nginx:latest" } }]);

describe("ContainerDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "#/containers";
  });

  it("Given the route tab settings, When the page renders, Then the Settings tab shows environment", async () => {
    show({ inspect: runningInspect });
    await waitFor(() => expect(screen.getByText("nginx:latest")).toBeInTheDocument());
  });

  it("Given a tab is pressed, When pressed, Then the hash becomes #/containers/{id}/{tab}", async () => {
    show({ inspect: runningInspect });
    const statsTab = screen.getByRole("tab", { name: "Stats" });
    await userEvent.click(statsTab);
    expect(window.location.hash).toBe("#/containers/aaa/stats");
  });

  const stoppedInspect = JSON.stringify([{ Name: "/api", State: { Status: "exited" }, Config: { Image: "nginx:latest" } }]);

  it("Given a stopped container, When rendered, Then the header has Start and no Open a shell", async () => {
    show({ inspect: stoppedInspect });
    await waitFor(() => expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Open a shell" })).not.toBeInTheDocument();
  });

  it("Given Remove is confirmed, When done, Then the hash is #/containers", async () => {
    const user = userEvent.setup();
    show({ inspect: stoppedInspect });
    await waitFor(() => expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = screen.getByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(window.location.hash).toBe("#/containers"));
  });

  it("Given the back button, When pressed, Then it navigates back", async () => {
    show({ inspect: runningInspect });
    const statsTab = screen.getByRole("tab", { name: "Stats" });
    await userEvent.click(statsTab);
    await waitFor(() => expect(window.location.hash).toBe("#/containers/aaa/stats"));
    const backButton = screen.getByRole("button", { name: /← Containers/ });
    await userEvent.click(backButton);
    await waitFor(() => expect(window.location.hash).not.toBe("#/containers/aaa/stats"));
  });
});

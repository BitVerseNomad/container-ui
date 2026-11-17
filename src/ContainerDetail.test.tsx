import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import ContainerDetail from "./ContainerDetail";
import { ConfirmProvider, ToastProvider } from "./ui/op";

const ctx = "colima";
const id = "aaa";

function show({ inspect = "[]", tab }: { inspect?: string; tab?: string } = {}) {
  backend.current = fakeBackend({
    docker: () => inspect,
    inspect: () => inspect,
  });
  render(
    <ToastProvider>
      <ConfirmProvider>
        <ContainerDetail ctx={ctx} id={id} tab={tab} />
      </ConfirmProvider>
    </ToastProvider>
  );
  return {};
}

const runningInspect = JSON.stringify([{ Name: "/api", State: { Status: "running", Running: true }, Config: { Image: "nginx:latest" } }]);
const unhealthyInspect = JSON.stringify([{ Name: "/api", State: { Status: "running", Running: true, Health: { Status: "unhealthy", FailingStreak: 5, Log: [] } }, Config: { Image: "nginx:latest" } }]);
const stoppedInspect = JSON.stringify([{ Name: "/api", State: { Status: "exited" }, Config: { Image: "nginx:latest" } }]);

describe("ContainerDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "#/containers";
  });

  it("Given the route tab settings, When the page renders, Then the Settings tab is selected and shows the image", async () => {
    show({ inspect: runningInspect, tab: "settings" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Settings" })).toHaveAttribute("aria-selected", "true"));
    expect(screen.getByRole("table", { name: "Settings" })).toHaveTextContent("nginx:latest");
  });

  it("Given a tab is pressed, When pressed, Then the hash becomes #/containers/{id}/{tab}", async () => {
    show({ inspect: runningInspect });
    const statsTab = screen.getByRole("tab", { name: "Stats" });
    await userEvent.click(statsTab);
    expect(window.location.hash).toBe("#/containers/aaa/stats");
  });

  it("Given a running container whose health check fails, When rendered, Then the header reads Running · Unhealthy", async () => {
    show({ inspect: unhealthyInspect });
    await waitFor(() => expect(screen.getByText("Running · Unhealthy")).toBeInTheDocument());
  });

  it("Given a stopped container, When rendered, Then the header has Start and no Open a shell", async () => {
    show({ inspect: stoppedInspect });
    await waitFor(() => expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: "Open a shell" })).not.toBeInTheDocument();
  });

  it("Given Remove… is confirmed in the actions menu, When done, Then the hash is #/containers", async () => {
    const user = userEvent.setup();
    show({ inspect: stoppedInspect });
    await waitFor(() => expect(screen.getByRole("button", { name: "More actions for api" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "More actions for api" }));
    await user.click(screen.getByRole("menuitem", { name: "Remove…" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(window.location.hash).toBe("#/containers"));
  });

  it("Given the back button, When pressed, Then it navigates back", async () => {
    show({ inspect: runningInspect });
    const statsTab = screen.getByRole("tab", { name: "Stats" });
    await userEvent.click(statsTab);
    await waitFor(() => expect(window.location.hash).toBe("#/containers/aaa/stats"));
    const backButton = screen.getByRole("button", { name: "Back to Containers" });
    await userEvent.click(backButton);
    await waitFor(() => expect(window.location.hash).not.toBe("#/containers/aaa/stats"));
  });
});

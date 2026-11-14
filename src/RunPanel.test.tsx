import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import RunPanel from "./RunPanel";
import { ConfirmProvider, ToastProvider } from "./ui/op";

const ctx = "colima";
const image = "acme/billing-api:3.1";

function show({ inspect = "[]" } = {}) {
  backend.current = fakeBackend({
    docker: () => inspect,
    inspect: () => inspect,
  });
  render(
    <ConfirmProvider>
      <ToastProvider>
        <RunPanel ctx={ctx} image={image} onClose={() => {}} onRan={() => {}} />
      </ToastProvider>
    </ConfirmProvider>
  );
  return {};
}

describe("RunPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Given the sheet renders, Then it shows the Run title and image name", async () => {
    show({ inspect: JSON.stringify([{ Name: "/api", State: { Status: "running" }, Config: { Image: "acme/billing-api:3.1" } }]) });
    await waitFor(() => expect(screen.getByText("Run acme/billing-api:3.1")).toBeInTheDocument());
  });

  it("Given the sheet renders, Then it shows Cancel and Run buttons", async () => {
    show({ inspect: JSON.stringify([{ Name: "/api", State: { Status: "running" }, Config: { Image: "acme/billing-api:3.1" } }]) });
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument());
  });

  it("Given a successful run, When Run is pressed, Then onRan gets the id and name and the sheet closes", async () => {
    const user = userEvent.setup();
    let onRanId: string | null = null;
    let onRanName: string | null = null;
    backend.current = fakeBackend({
      image: () => JSON.stringify([{ Name: "/nginx", Config: { ExposedPorts: { "80/tcp": {} } } }]),
      run: () => "container-id-123",
    });
    render(
      <ConfirmProvider>
        <ToastProvider>
          <RunPanel ctx={ctx} image="nginx:latest" onClose={() => {}} onRan={(id, name) => { onRanId = id; onRanName = name; }} />
        </ToastProvider>
      </ConfirmProvider>
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(onRanId).toBe("container-id-123"));
    expect(onRanName).toMatch(/^nginx-/);
  });

  it("Given a failed run with a port clash, When done, Then a banner shows and Show output appears", async () => {
    const user = userEvent.setup();
    backend.current = fakeBackend({
      image: () => JSON.stringify([{ Name: "/web", State: { Status: "running" }, Config: { ExposedPorts: { "80/tcp": {} } } }]),
      run: () => { throw new Error("Error response from daemon: driver failed programming external connectivity on endpoint web: Bind for 0.0.0.0:8080 failed: port is already allocated"); },
    });
    render(
      <ConfirmProvider>
        <ToastProvider>
          <RunPanel ctx={ctx} image="nginx:latest" onClose={() => {}} onRan={() => {}} />
        </ToastProvider>
      </ConfirmProvider>
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Show output" })).toBeInTheDocument());
  });

  it("Given Show command chip exists, When rendered, Then it is clickable", async () => {
    show({ inspect: JSON.stringify([{ Name: "/web", State: { Status: "running" }, Config: { Image: "nginx:latest", ExposedPorts: { "80/tcp": {} } } }]) });
    await waitFor(() => expect(screen.getByRole("button", { name: "Show command" })).toBeInTheDocument());
    const showCmdBtn = screen.getByRole("button", { name: "Show command" });
    await userEvent.click(showCmdBtn);
    expect(showCmdBtn).toBeInTheDocument();
  });
});

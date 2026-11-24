import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls = vi.hoisted(() => [] as { cmd: string; a: Record<string, unknown> }[]);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, a: Record<string, unknown> = {}) => {
    calls.push({ cmd, a });
    return undefined;
  }),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));

const Profiles = (await import("./Profiles")).default;
const { ConfirmProvider } = await import("./ui");

const running = { name: "default", status: "Running", arch: "aarch64", cpus: 2, memory: 2 * 1024 ** 3, disk: 60 * 1024 ** 3, runtime: "docker", address: "" };

// A stand-in for App: Kubernetes is on until a turn-off or turn-on from the row changes it.
function Harness({ onAsked }: { onAsked: (name: string, on: boolean) => void }) {
  const [on, setOn] = useState<Record<string, boolean>>({ default: true });
  return (
    <ConfirmProvider>
      <Profiles
        profiles={[running]}
        reload={() => {}}
        kubeOn={(name) => on[name] ?? null}
        onKubeAsked={(name, value) => { setOn((m) => ({ ...m, [name]: value })); onAsked(name, value); }}
      />
    </ConfirmProvider>
  );
}

describe("Profiles: turning Kubernetes off", () => {
  beforeEach(() => { calls.length = 0; });

  it("given Kubernetes is on for a running machine, when Turn off is confirmed, then the machine restarts without Kubernetes and the row offers Turn on again", async () => {
    const user = userEvent.setup();
    const onAsked = vi.fn();
    render(<Harness onAsked={onAsked} />);

    await user.click(screen.getByRole("button", { name: "Turn off Kubernetes for default" }));
    await user.click(await screen.findByRole("button", { name: "Turn off", exact: true }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Turn on Kubernetes" })).toBeTruthy());
    const apply = calls.find((c) => c.cmd === "apply_resources");
    expect(apply?.a).toEqual({ opts: { name: "default", kubernetes: false }, restart: true });
    expect(onAsked).toHaveBeenCalledWith("default", false);
  });

  it("given the confirm is cancelled, when Turn off is pressed, then nothing is applied", async () => {
    const user = userEvent.setup();
    render(<Harness onAsked={() => {}} />);

    await user.click(screen.getByRole("button", { name: "Turn off Kubernetes for default" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(calls.some((c) => c.cmd === "apply_resources")).toBe(false);
    expect(screen.getByRole("button", { name: "Turn off Kubernetes for default" })).toBeTruthy();
  });
});

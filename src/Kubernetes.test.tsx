import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const pod = { metadata: { name: "api-7f9c", namespace: "default", creationTimestamp: new Date().toISOString() }, spec: { containers: [{ name: "app" }] }, status: { phase: "Running", containerStatuses: [{ ready: true, restartCount: 0 }] } };

const kube = vi.hoisted(() => ({
  invoke: async (cmd: string, a: Record<string, unknown> = {}): Promise<unknown> => {
    if (cmd === "env_check") return { brew: null, colima: null, docker: null, kubectl: { path: "/bin/kubectl", version: "1" }, k9s: null };
    if (cmd !== "kubectl") return null;
    const args = (a.args as string[]) ?? [];
    if (args[0] === "config") return "colima\n";
    if (args[0] === "get" && args[1] === "pods") return JSON.stringify({ items: [pod] });
    return JSON.stringify({ items: [] });
  },
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: kube.invoke }));

import Kubernetes from "./Kubernetes";
import type { Profile } from "./api";

describe("Kubernetes", () => {
  it("Given the Pods view, When it renders, Then the pod name is plain text with one Open button", async () => {
    render(<Kubernetes profile={{ name: "default" } as Profile} ctx="colima" />);
    expect(await screen.findByText("api-7f9c")).toBeInTheDocument();
    expect(screen.getByText("api-7f9c").closest("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Open api-7f9c" })).toHaveLength(1);
  });

  it("Given the resource tabs, When they render, Then they use the shared tab chips", async () => {
    render(<Kubernetes profile={{ name: "default" } as Profile} ctx="colima" />);
    const tab = await screen.findByRole("tab", { name: "Deployments" });
    expect(tab).toHaveClass("chip");
    expect(tab.closest("button")).toBe(tab);
    expect(document.querySelector("button.tab")).toBeNull();
  });

  it("Given the Open button, When clicked, Then the pod panel opens", async () => {
    render(<Kubernetes profile={{ name: "default" } as Profile} ctx="colima" />);
    await userEvent.click(await screen.findByRole("button", { name: "Open api-7f9c" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

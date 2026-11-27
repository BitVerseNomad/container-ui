import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls = vi.hoisted(() => ({ list: [] as { cmd: string; a: Record<string, unknown> }[], sameAccount: false }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd: string, a: Record<string, unknown> = {}) => {
    calls.list.push({ cmd, a });
    if (cmd === "aws_profiles") return ["default", "prod-readonly"];
    if (cmd === "aws_profile_accounts") return [{ name: "default", account: calls.sameAccount ? "123456789012" : "111122223333" }, { name: "prod-readonly", account: "123456789012" }];
    return undefined;
  },
}));

import Registries from "./Registries";
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};
import { loadRegistries } from "./lib/registries";

const HOST = "123456789012.dkr.ecr.us-west-2.amazonaws.com";
afterEach(() => { localStorage.clear(); calls.list.length = 0; });

async function addHost(text: string) {
  await userEvent.type(screen.getByLabelText("Registry or image"), text);
  await userEvent.click(screen.getByRole("button", { name: "Add" }));
}

describe("Registries", () => {
  it("given nothing saved, when opened, then it explains and offers the Add form", () => {
    render(<Registries />);
    expect(screen.getByText("No registries yet")).toBeTruthy();
    expect(screen.getByText(/Docker Hub and public registries need nothing/)).toBeTruthy();
    expect(screen.getByLabelText("Registry or image")).toBeTruthy();
  });

  it("given an image reference, when Add is pressed, then its registry is listed and saved", async () => {
    render(<Registries />);
    await addHost(`${HOST}/team/app:1.0`);
    expect(await screen.findByRole("button", { name: `Sign in to ${HOST}` })).toBeTruthy();
    expect(loadRegistries()).toEqual([{ registry: HOST, region: "us-west-2", profile: "prod-readonly" }]);
  });

  it("given text that is not ECR, when Add is pressed, then it says so and saves nothing", async () => {
    render(<Registries />);
    await addHost("ghcr.io/org/app");
    expect(screen.getByText("That is not an Amazon ECR address.")).toBeTruthy();
    expect(loadRegistries()).toEqual([]);
  });

  it("given a saved registry, when Remove is pressed, then it is gone", async () => {
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: HOST, region: "us-west-2", profile: "prod-readonly" }]));
    render(<Registries />);
    await userEvent.click(screen.getByRole("button", { name: `Remove ${HOST}` }));
    expect(screen.getByText("No registries yet")).toBeTruthy();
    expect(loadRegistries()).toEqual([]);
  });

  it("given a saved registry, when Sign in is pressed, then registry_login runs with its profile and the signed-in line shows", async () => {
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: HOST, region: "us-west-2", profile: "prod-readonly" }]));
    render(<Registries />);
    await userEvent.click(screen.getByRole("button", { name: `Sign in to ${HOST}` }));
    expect(await screen.findByText("Signed in just now. Docker keeps it for about 12 hours.")).toBeTruthy();
    await waitFor(() => expect(calls.list.find((c) => c.cmd === "registry_login")?.a).toEqual({ registry: HOST, profile: "prod-readonly" }));
  });

  it("given a saved registry, when its AWS profile is changed, then the new profile is saved and the backend is told", async () => {
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: HOST, region: "us-west-2", profile: "default" }]));
    calls.sameAccount = true;
    render(<Registries />);
    await userEvent.click(await screen.findByRole("combobox", { name: `AWS profile for ${HOST}` }));
    await userEvent.click(await screen.findByRole("option", { name: "prod-readonly" }));
    expect(loadRegistries()[0].profile).toBe("prod-readonly");
    expect(calls.list.find((c) => c.cmd === "set_docker_aws_profile")?.a).toEqual({ profile: "prod-readonly" });
    calls.sameAccount = false;
  });
});

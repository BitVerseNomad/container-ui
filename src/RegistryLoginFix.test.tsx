import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls = vi.hoisted(() => ({ list: [] as { cmd: string; a: Record<string, unknown> }[], failWith: null as unknown, stopLogin: null as null | (() => void) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd: string, a: Record<string, unknown> = {}) => {
    calls.list.push({ cmd, a });
    if (cmd === "aws_profiles") return ["default"];
    if (cmd === "aws_sso_login") return new Promise((_, reject) => { calls.stopLogin = () => reject("Killed"); });
    if (cmd === "aws_sso_cancel") { calls.stopLogin?.(); return true; }
    if (calls.failWith) throw calls.failWith;
    return undefined;
  },
}));

import RegistryLoginFix from "./RegistryLoginFix";
import { ConfirmProvider } from "./ui/op";

// jsdom has no scrollTo; the live log scrolls itself.
Element.prototype.scrollTo = () => {};
const HOST = "123456789012.dkr.ecr.us-west-2.amazonaws.com";
const denied = `failed to resolve reference "${HOST}/shop/api:latest": pull access denied, no basic auth credentials`;
const show = (text: string) => render(<ConfirmProvider><RegistryLoginFix text={text} /></ConfirmProvider>);

describe("RegistryLoginFix", () => {
  it("given an unrelated error, when shown, then it draws nothing", () => {
    const { container } = show("port is already allocated");
    expect(container).toBeEmptyDOMElement();
  });

  it("given a denied ECR pull, when the user confirms, then it signs in and says to start again", async () => {
    calls.failWith = null;
    show(denied);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    expect(calls.list.some((c) => c.cmd === "registry_login")).toBe(false);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Signed in. Start it again.")).toBeTruthy();
    expect(calls.list.find((c) => c.cmd === "registry_login")?.a).toEqual({ registry: HOST, profile: "default" });
  });

  it("given an expired AWS session, when signing in fails, then it offers Sign in to AWS first", async () => {
    calls.failWith = { kind: "aws-session", message: "Token has expired" };
    show(denied);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign in to AWS first" })).toBeTruthy());
  });

  it("given aws is missing, when signing in fails, then it says so and offers no fix", async () => {
    calls.failWith = { kind: "no-aws", message: "x" };
    show(denied);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("The AWS command line tool is not installed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sign in/ })).toBeNull();
  });

  it("given AWS sign-in is running, when the user presses Cancel, then it stops it and offers Sign in to AWS first again", async () => {
    calls.failWith = { kind: "aws-session", message: "Token has expired" };
    show(denied);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS first" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(calls.list.some((c) => c.cmd === "aws_sso_cancel")).toBe(true);
    expect(await screen.findByRole("button", { name: "Sign in to AWS first" })).toBeTruthy();
    expect(screen.queryByText(/did not work/)).toBeNull();
  });
});

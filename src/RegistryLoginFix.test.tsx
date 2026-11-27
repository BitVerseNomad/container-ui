import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls = vi.hoisted(() => ({ list: [] as { cmd: string; a: Record<string, unknown> }[], failWith: null as unknown, stopLogin: null as null | (() => void), expiredOnce: false, ssoHangs: true, profiles: ["default"] }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd: string, a: Record<string, unknown> = {}) => {
    calls.list.push({ cmd, a });
    if (cmd === "aws_profiles") return calls.profiles;
    if (cmd === "aws_sso_login") return calls.ssoHangs ? new Promise((_, reject) => { calls.stopLogin = () => reject("Killed"); }) : undefined;
    if (cmd === "registry_login" && calls.expiredOnce) { calls.expiredOnce = false; throw { kind: "aws-session", message: "Token has expired" }; }
    if (cmd === "aws_sso_cancel") { calls.stopLogin?.(); return true; }
    if (calls.failWith) throw calls.failWith;
    return undefined;
  },
}));

import RegistryLoginFix from "./RegistryLoginFix";
import { ConfirmProvider } from "./ui/op";
import { loadRegistries } from "./lib/registries";

// jsdom has no scrollTo; the live log scrolls itself.
Element.prototype.scrollTo = () => {};
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
Element.prototype.releasePointerCapture = () => {};
Element.prototype.setPointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};
const HOST = "123456789012.dkr.ecr.us-west-2.amazonaws.com";
const denied = `failed to resolve reference "${HOST}/shop/api:latest": pull access denied, no basic auth credentials`;
const failure = (repo: string) => `failed to resolve reference "${HOST}/${repo}:latest": pull access denied, no basic auth credentials`;
const notAllowed = `failed to resolve reference "${HOST}/shop/api:latest": denied: User: arn:aws:sts::123456789012:assumed-role/sandbox/me is not authorized to perform: ecr:BatchGetImage on resource: arn:aws:ecr:us-west-2:123456789012:repository/shop/api`;
const show = (text: string, onDone?: () => void) => render(<ConfirmProvider><RegistryLoginFix text={text} onDone={onDone} /></ConfirmProvider>);

afterEach(() => { localStorage.clear(); calls.profiles = ["default"]; });

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

  it("given an expired AWS session, when the user signs in, then AWS sign-in runs, the login is retried and the start runs again", async () => {
    calls.failWith = null; calls.expiredOnce = true; calls.ssoHangs = false; calls.list.length = 0;
    const onDone = vi.fn();
    show(denied, onDone);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(calls.list.map((c) => c.cmd).filter((c) => c !== "aws_profiles" && c !== "set_docker_aws_profile")).toEqual(["registry_login", "aws_sso_login", "registry_login"]);
  });

  it("given aws is missing, when signing in fails, then it says so and offers no fix", async () => {
    calls.failWith = { kind: "no-aws", message: "x" };
    show(denied);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("The AWS command line tool is not installed.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sign in/ })).toBeNull();
  });

  it("given AWS sign-in is running, when the user presses Cancel, then it stops it and offers the sign-in again", async () => {
    calls.failWith = null; calls.expiredOnce = true; calls.ssoHangs = true;
    show(denied);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(calls.list.some((c) => c.cmd === "aws_sso_cancel")).toBe(true);
    expect(await screen.findByRole("button", { name: "Sign in to AWS registry" })).toBeTruthy();
    expect(screen.queryByText(/did not work/)).toBeNull();
  });

  it("given a denied pull and nothing saved, when the user signs in, then the registry is saved with the chosen profile", async () => {
    calls.failWith = null; calls.expiredOnce = false;
    show(denied);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Signed in. Start it again.")).toBeTruthy();
    expect(loadRegistries()).toEqual([{ registry: HOST, region: "us-west-2", profile: "default" }]);
  });

  it("given the registry is saved, when a denied pull is shown, then it signs in without asking and runs the start again", async () => {
    calls.failWith = null; calls.expiredOnce = false; calls.list.length = 0;
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: HOST, region: "us-west-2", profile: "prod-readonly" }]));
    const onDone = vi.fn();
    show(failure("auto-one"), onDone);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(calls.list.filter((c) => c.cmd === "registry_login").map((c) => c.a)).toEqual([{ registry: HOST, profile: "prod-readonly" }]);
  });

  it("given the registry is saved, when the AWS session ran out, then it shows the browser step with Cancel", async () => {
    calls.failWith = null; calls.expiredOnce = true; calls.ssoHangs = true;
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: HOST, region: "us-west-2", profile: "prod-readonly" }]));
    show(failure("auto-two"));
    expect(await screen.findByText("Finish the AWS sign-in in your browser.")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: "Sign in to AWS registry" })).toBeTruthy();
  });

  it("given a sign-in worked, then the backend is told which AWS profile docker should use", async () => {
    calls.failWith = null; calls.expiredOnce = false; calls.list.length = 0;
    show(failure("tells-backend"));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await screen.findByText("Signed in. Start it again.");
    expect(calls.list.find((c) => c.cmd === "set_docker_aws_profile")?.a).toEqual({ profile: "default" });
  });

  it("given several AWS profiles, then the prod and ecr ones come first and the first is the default", async () => {
    calls.failWith = null; calls.expiredOnce = false; calls.list.length = 0; calls.profiles = ["sandbox-dev", "prod-readonly"];
    show(failure("order"));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in to AWS registry" }));
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await screen.findByText("Signed in. Start it again.");
    expect(calls.list.find((c) => c.cmd === "registry_login")?.a).toEqual({ registry: HOST, profile: "prod-readonly" });
  });

  it("given the same failure comes back after an automatic sign-in, then it does not sign in again or restart again", async () => {
    calls.failWith = null; calls.expiredOnce = false; calls.list.length = 0;
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: HOST, region: "us-west-2", profile: "prod-readonly" }]));
    const onDone = vi.fn();
    const first = show(failure("loop"), onDone);
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    first.unmount();
    show(failure("loop"), onDone);
    expect(await screen.findByRole("button", { name: "Sign in to AWS registry" })).toBeTruthy();
    expect(calls.list.filter((c) => c.cmd === "registry_login")).toHaveLength(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("given the profile may not read the registry, then it never signs in or restarts by itself and says which profile is wrong", async () => {
    calls.failWith = null; calls.expiredOnce = false; calls.list.length = 0;
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: HOST, region: "us-west-2", profile: "sandbox" }]));
    const onDone = vi.fn();
    show(notAllowed, onDone);
    expect(await screen.findByText(`sandbox is signed in but is not allowed to read ${HOST}. Pick another AWS profile.`)).toBeTruthy();
    await new Promise((r) => setTimeout(r, 100));
    expect(calls.list.some((c) => c.cmd === "registry_login")).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("given another profile is picked, when Use this profile and start again is pressed, then it saves it, tells the backend, signs in and starts again", async () => {
    calls.failWith = null; calls.expiredOnce = false; calls.list.length = 0; calls.profiles = ["sandbox", "prod-readonly"];
    localStorage.setItem("container-ui:registries", JSON.stringify([{ registry: HOST, region: "us-west-2", profile: "sandbox" }]));
    const onDone = vi.fn();
    show(notAllowed, onDone);
    const trigger = await screen.findByRole("combobox", { name: "AWS profile" });
    await userEvent.click(trigger);
    await userEvent.click(await screen.findByRole("option", { name: "prod-readonly" }));
    await userEvent.click(screen.getByRole("button", { name: "Use this profile and start again" }));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(loadRegistries()).toEqual([{ registry: HOST, region: "us-west-2", profile: "prod-readonly" }]);
    expect(calls.list.filter((c) => c.cmd === "set_docker_aws_profile").map((c) => c.a)).toEqual([{ profile: "prod-readonly" }, { profile: "prod-readonly" }]);
    expect(calls.list.find((c) => c.cmd === "registry_login")?.a).toEqual({ registry: HOST, profile: "prod-readonly" });
  });
});

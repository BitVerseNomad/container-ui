import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: async () => () => {} }));

import ComposeProjects from "./ComposeProjects";
import { ConfirmProvider } from "./ui";
import { reset as resetFixes, startFix } from "./lib/fixStore";

// jsdom has no scrolling; the output log scrolls to its end.
Element.prototype.scrollTo = () => {};

const scan = { paths: ["/Users/me/Dev/global-search-service/docker-compose.yml", "/Users/me/Dev/service-search-service/docker-compose.yml"], scanning: false, error: null, scan: async () => {} };

function show() {
  const onCompose = vi.fn(async (_a: Record<string, unknown>) => "");
  backend.current = fakeBackend({});
  const invoke = backend.current.invoke;
  backend.current.invoke = vi.fn(async (cmd: string, a: Record<string, unknown> = {}) => (cmd === "compose_action" ? onCompose(a) : invoke(cmd, a)));
  render(
    <ConfirmProvider>
      <ComposeProjects ctx="colima" scan={scan} containers={[]} onClose={() => {}} />
    </ConfirmProvider>,
  );
  return onCompose;
}

describe("ComposeProjects", () => {
  beforeEach(() => resetFixes());

  it("given no fix running, when Start is clicked, then compose up runs for that file", async () => {
    const user = userEvent.setup();
    const onCompose = show();
    await user.click(screen.getByRole("button", { name: "Start service-search-service" }));
    await waitFor(() => expect(onCompose).toHaveBeenCalledWith({ context: "colima", file: "/Users/me/Dev/service-search-service/docker-compose.yml", action: "up" }));
  });

  it("given a fix running, when the panel opens, then no project can be started or stopped until it ends", async () => {
    startFix([{ name: "web", run: [], connect: [] }], () => new Promise(() => {}), async () => {}, undefined, () => {});
    const onCompose = show();
    const start = await screen.findByRole("button", { name: "Start service-search-service" });
    expect(start).toBeDisabled();
    expect(start).toHaveAttribute("title", "Wait for the fix to finish");
    expect(screen.getByText(/Wait for the fix to finish before/)).toBeInTheDocument();
    expect(onCompose).not.toHaveBeenCalled();
  });

  it("given the words search service, when searched, then both search projects stay in the list", async () => {
    const user = userEvent.setup();
    show();
    await user.type(screen.getByRole("textbox", { name: "Search projects" }), "search service");
    expect(screen.getByText("global-search-service")).toBeInTheDocument();
    expect(screen.getByText("service-search-service")).toBeInTheDocument();
  });
});

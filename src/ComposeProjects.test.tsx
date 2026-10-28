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

const scan = { paths: ["/Users/me/Dev/global-search-service/docker-compose.yml", "/Users/me/Dev/service-search-service/docker-compose.yml"], scanning: false, error: null, scan: async () => {}, add: async () => null, pinned: [] };

const running = (name: string, dir: string) => ({ Names: name, State: "running", Labels: `com.docker.compose.project=x,com.docker.compose.project.working_dir=${dir}` });

function show(opts: { containers?: ReturnType<typeof running>[]; attention?: Map<string, { short?: string; title: string }[]>; add?: () => Promise<string | null> } = {}) {
  const onCompose = vi.fn(async (_a: Record<string, unknown>) => "");
  const onLogs = vi.fn(async (_a: Record<string, unknown>) => "web-1  | ready");
  backend.current = fakeBackend({});
  const invoke = backend.current.invoke;
  backend.current.invoke = vi.fn(async (cmd: string, a: Record<string, unknown> = {}) => (cmd === "compose_action" ? onCompose(a) : cmd === "compose_logs" ? onLogs(a) : invoke(cmd, a)));
  render(
    <ConfirmProvider>
      <ComposeProjects ctx="colima" scan={{ ...scan, add: opts.add ?? scan.add }} containers={opts.containers ?? []} attention={opts.attention} onClose={() => {}} />
    </ConfirmProvider>,
  );
  return { onCompose, onLogs };
}

describe("ComposeProjects", () => {
  beforeEach(() => resetFixes());

  it("given no fix running, when Start is clicked, then compose up runs for that file", async () => {
    const user = userEvent.setup();
    const { onCompose } = show();
    await user.click(screen.getByRole("button", { name: "Start service-search-service" }));
    await waitFor(() => expect(onCompose).toHaveBeenCalledWith({ context: "colima", file: "/Users/me/Dev/service-search-service/docker-compose.yml", action: "up" }));
  });

  it("given a fix running, when the panel opens, then no project can be started or stopped until it ends", async () => {
    startFix([{ name: "web", run: [], connect: [] }], () => new Promise(() => {}), async () => {}, undefined, () => {});
    const { onCompose } = show();
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

  it("given a project, when Rebuild is clicked, then compose up runs with --build", async () => {
    const user = userEvent.setup();
    const { onCompose } = show();
    await user.click(screen.getByRole("button", { name: "Rebuild service-search-service" }));
    await waitFor(() => expect(onCompose).toHaveBeenCalledWith({ context: "colima", file: "/Users/me/Dev/service-search-service/docker-compose.yml", action: "build" }));
  });

  it("given a project whose container the Doctor flags, when listed, then the card names it and what is wrong", () => {
    const dir = "/Users/me/Dev/service-search-service";
    show({ containers: [running("sss-web-1", dir), running("sss-db-1", dir)], attention: new Map([["sss-web-1", [{ short: "Keeps restarting", title: "sss-web-1 keeps restarting" }]]]) });
    expect(screen.getByText(/1 needs attention: sss-web-1: keeps restarting/)).toBeInTheDocument();
  });

  it("given a running project, when Logs is clicked, then its last lines show under it", async () => {
    const user = userEvent.setup();
    const dir = "/Users/me/Dev/service-search-service";
    const { onLogs } = show({ containers: [running("sss-web-1", dir)] });
    await user.click(screen.getByRole("button", { name: "Logs of service-search-service" }));
    expect(await screen.findByText(/web-1 +\| ready/)).toBeInTheDocument();
    expect(onLogs).toHaveBeenCalledWith({ context: "colima", file: `${dir}/docker-compose.yml` });
  });

  it("given a folder that can't be added, when Add a folder is used, then the reason shows", async () => {
    const user = userEvent.setup();
    show({ add: async () => { throw "No compose.yaml or docker-compose.yml in notes"; } });
    await user.click(screen.getByRole("button", { name: /Add a folder/ }));
    expect(await screen.findByText(/No compose.yaml or docker-compose.yml in notes/)).toBeInTheDocument();
  });

  it("given logs are open, when Refresh is clicked, then they are read again and stay open", async () => {
    const user = userEvent.setup();
    const dir = "/Users/me/Dev/service-search-service";
    const { onLogs } = show({ containers: [running("sss-web-1", dir)] });
    await user.click(screen.getByRole("button", { name: "Logs of service-search-service" }));
    await screen.findByText(/web-1 +\| ready/);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByText(/web-1 +\| ready/)).toBeInTheDocument();
    expect(onLogs).toHaveBeenCalledTimes(2);
  });
});

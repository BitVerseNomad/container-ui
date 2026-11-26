import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend, jsonLines } from "./test/fakeBackend";

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

type Setup = {
  image?: unknown[];
  ps?: { Names: string; State: string; Ports: string; Image?: string }[];
  networks?: string[];
  run?: () => string | Promise<string>;
};

// Answers what `docker` says for each command the sheet asks.
function setup(ref: string, { image: inspect = [], ps = [], networks = ["devnet"], run = () => "container-id-1" }: Setup = {}, onRan: (id: string, name: string) => void = () => {}) {
  backend.current = fakeBackend({
    image: () => JSON.stringify(inspect),
    ps: () => jsonLines(ps),
    network: (args) => (args[1] === "ls" ? jsonLines(networks.map((Name) => ({ Name }))) : ""),
    volume: () => "",
    run,
  });
  render(
    <ConfirmProvider>
      <ToastProvider>
        <RunPanel ctx={ctx} image={ref} onClose={() => {}} onRan={onRan} />
      </ToastProvider>
    </ConfirmProvider>
  );
  return backend.current!;
}

const postgresInfo = [{ Architecture: "arm64", Os: "linux", Config: { ExposedPorts: { "5432/tcp": {} }, Volumes: { "/var/lib/postgresql/data": {} } } }];

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
    await user.click(screen.getByRole("button", { name: "Run" }));
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
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Show output" })).toBeInTheDocument());
  });

  it("Given Show command chip exists, When rendered, Then it is clickable", async () => {
    show({ inspect: JSON.stringify([{ Name: "/web", State: { Status: "running" }, Config: { Image: "nginx:latest", ExposedPorts: { "80/tcp": {} } } }]) });
    await waitFor(() => expect(screen.getByRole("button", { name: "Show command" })).toBeInTheDocument());
    const showCmdBtn = screen.getByRole("button", { name: "Show command" });
    await userEvent.click(showCmdBtn);
    expect(showCmdBtn).toBeInTheDocument();
  });

  it("Given an image that declares port 80 and the port is free, When the sheet opens, Then the Mac port and the container port both hold 80", async () => {
    setup("nginx:1.27", { image: [{ Config: { ExposedPorts: { "80/tcp": {} } } }] });
    await waitFor(() => expect(screen.getByLabelText("Host port")).toHaveValue("80"));
    expect(screen.getByLabelText("Container port")).toHaveValue("80");
  });

  it("Given port 5432 is used by db, When the sheet opens for postgres, Then a warning names db and Use 5433 instead fills the field and the warning goes", async () => {
    const user = userEvent.setup();
    setup("postgres:16", { image: postgresInfo, ps: [{ Names: "db", State: "running", Ports: "0.0.0.0:5432->5432/tcp" }] });
    await waitFor(() => expect(screen.getByRole("button", { name: "Use 5433 instead" })).toBeInTheDocument());
    expect(document.querySelector(".banner")?.textContent).toContain("Port 5432 on this Mac is already used by db.");
    await user.click(screen.getByRole("button", { name: "Use 5433 instead" }));
    expect(screen.getByLabelText("Host port")).toHaveValue("5433");
    expect(screen.queryByRole("button", { name: "Use 5433 instead" })).not.toBeInTheDocument();
  });

  it("Given postgres, When the sheet opens, Then POSTGRES_PASSWORD shows in a password field marked Required", async () => {
    setup("postgres:16", { image: postgresInfo });
    const password = await screen.findByLabelText("POSTGRES_PASSWORD");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("placeholder", "Required");
  });

  it("Given the password is cleared, When Run is pressed, Then the run does not start and the field is marked invalid", async () => {
    const user = userEvent.setup();
    const calls = setup("postgres:16", { image: postgresInfo });
    const password = await screen.findByLabelText("POSTGRES_PASSWORD");
    await user.clear(password);
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(calls.dockerCalls().some((args) => args[0] === "run")).toBe(false);
    expect(password).toHaveAttribute("aria-invalid", "true");
  });

  it("Given a successful run, When Run is pressed, Then the run is called with the image and onRan gets the name", async () => {
    const user = userEvent.setup();
    const onRan = vi.fn();
    const calls = setup("nginx:1.27", { image: [{ Config: { ExposedPorts: { "80/tcp": {} } } }], networks: ["devnet"] }, onRan);
    await waitFor(() => expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(onRan).toHaveBeenCalledWith("container-id-1", expect.stringMatching(/^nginx-/)));
    expect(calls.dockerCalls().some((args) => args[0] === "run" && args.includes("devnet"))).toBe(true);
  });

  it("Given a failed run with a port clash, When Show output is pressed, Then a plain title shows and the raw output stays folded until then", async () => {
    const user = userEvent.setup();
    setup("nginx:1.27", {
      image: [{ Config: { ExposedPorts: { "80/tcp": {} } } }],
      run: () => { throw new Error("Error response from daemon: Bind for 0.0.0.0:80 failed: port is already allocated"); },
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByText(/host port is taken/i);
    expect(screen.queryByLabelText("Output")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show output" }));
    expect(screen.getByLabelText("Output")).toHaveTextContent("port is already allocated");
  });

  it("Given a run in progress, When Escape is pressed, Then a question to stop the run shows", async () => {
    const user = userEvent.setup();
    setup("nginx:1.27", { image: [{ Config: { ExposedPorts: { "80/tcp": {} } } }], run: () => new Promise(() => {}) });
    await waitFor(() => expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Run" }));
    await user.keyboard("{Escape}");
    expect(await screen.findByText("Stop the run?")).toBeInTheDocument();
  });

  it("Given a folder under Library, When it is added as a volume source, Then it is refused and has no writable box", async () => {
    const user = userEvent.setup();
    setup("nginx:1.27", { image: [{ Config: { ExposedPorts: { "80/tcp": {} } } }] });
    await user.click(await screen.findByRole("button", { name: "More options" }));
    await user.click(screen.getByRole("button", { name: "Add a folder or volume" }));
    await user.type(screen.getByLabelText("Volume source"), "/Users/fsousa/Library/Keychains");
    expect(screen.getByText(/Library or hidden folders can't be shared/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Let the container change files here" })).not.toBeInTheDocument();
  });

  it("Given Show command is opened, When rendered, Then the command contains docker run and a copy button", async () => {
    const user = userEvent.setup();
    setup("nginx:1.27", { image: [{ Config: { ExposedPorts: { "80/tcp": {} } } }] });
    await user.click(await screen.findByRole("button", { name: "Show command" }));
    expect(screen.getByText(/^docker run /)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the command" })).toBeInTheDocument();
  });

  it("Given the network cannot be created and a container already has the typed name, When Run is pressed, Then that container is not removed", async () => {
    const user = userEvent.setup();
    // Same answers as setup(), except that creating a network fails.
    setup("nginx:1.27", { ps: [{ Names: "web", State: "running", Ports: "" }], networks: [] });
    backend.current = fakeBackend({
      image: () => "[]",
      ps: () => jsonLines([{ Names: "web", State: "running", Ports: "" }]),
      network: (args) => { if (args[1] === "create") throw new Error("all predefined address pools have been fully subnetted"); return ""; },
      volume: () => "",
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument());
    await user.type(screen.getByLabelText("Name"), "web");
    await user.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(screen.getByText("The container didn't start")).toBeInTheDocument());
    expect(backend.current!.dockerCalls().some((args) => args[0] === "rm")).toBe(false);
  });
});

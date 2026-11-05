import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The file's limit as `docker compose config` reports it; a test changes it to "save the file".
const fileLimit = vi.hoisted(() => ({ bytes: 256 * 1024 ** 2, calls: [] as { cmd: string; a: Record<string, unknown> }[], hang: false, deps: false, fail: false, bad: false, opened: "editor", openFail: "", openHang: false, app: null as string | null }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, a: Record<string, unknown> = {}) => {
    fileLimit.calls.push({ cmd, a });
    if (cmd === "compose_action" && fileLimit.hang) return new Promise(() => {});
    if (cmd === "compose_action" && fileLimit.fail) throw "Error response from daemon: simulated";
    if (cmd === "compose_config" && fileLimit.bad) throw "yaml: line 3: mapping values are not allowed";
    if (cmd === "compose_editor") return fileLimit.opened === "textedit" ? { how: "textedit", app: "TextEdit" } : { how: "editor", app: fileLimit.app };
    if (cmd === "open_compose" && fileLimit.openHang) return new Promise(() => {});
    if (cmd === "open_compose" && fileLimit.openFail) throw fileLimit.openFail;
    if (cmd === "open_compose") return fileLimit.opened;
    if (cmd === "compose_config") return JSON.stringify({ name: "shop", services: { "report-job": { mem_limit: String(fileLimit.bytes), ...(fileLimit.deps ? { depends_on: { db: { condition: "service_started" } } } : {}) } } });
    return "";
  }),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
const { HealthPanel } = await import("./Health");
const { parseState } = await import("./lib/health");
const { ResizeProvider } = await import("./Resize");
const { resetComposeRun, runCompose } = await import("./ComposeProjects");
// A running 2 GiB VM: 256 MiB is clearly its own limit.
const env = { profile: { name: "default", status: "Running", arch: "aarch64", cpus: 2, memory: 2 * 1024 ** 3 }, host: null, pick: null, runVm: async () => null, locked: false, vmBusy: false, onProfiles: () => {} } as never;
const inVm = (ui: React.ReactNode) => render(<ResizeProvider value={env}>{ui}</ResizeProvider>);

const FILE = "/Users/me/code/shop/compose.yaml";
const LABELS = { "com.docker.compose.project.config_files": FILE, "com.docker.compose.service": "report-job" };
const killed = (labels: Record<string, string>) => parseState(JSON.stringify([{ Name: "/report-job", RestartCount: 0, State: { Running: false, Status: "exited", ExitCode: 137, OOMKilled: true, StartedAt: "" }, HostConfig: { Memory: 256 * 1024 ** 2 }, Config: { Labels: labels } }]))!;
const composeRuns = () => fileLimit.calls.filter((c) => c.cmd === "compose_action");

describe("HealthPanel on the container page", () => {
  beforeEach(() => { fileLimit.bytes = 256 * 1024 ** 2; fileLimit.calls = []; fileLimit.hang = false; fileLimit.deps = false; fileLimit.fail = false; fileLimit.bad = false; fileLimit.opened = "editor"; fileLimit.openFail = ""; fileLimit.openHang = false; fileLimit.app = null; resetComposeRun(); });

  it("given a job that hit its own 256 MiB limit from a listed project, when shown, then the file comes first and Apply and start second, with no bigger VM", async () => {
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    expect(screen.getAllByText("compose.yaml").map((e) => e.tagName)).toEqual(["CODE", "CODE"]);
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Open compose.yaml", "Apply and start"]);
    expect(screen.getByRole("button", { name: "Apply and start report-job" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Give the VM/ })).not.toBeInTheDocument();
    await waitFor(() => expect(fileLimit.calls.some((c) => c.cmd === "compose_config")).toBe(true));
  });

  it("given the file still sets 256 MiB, when Apply and start is pressed, then nothing runs and it says to raise it first", async () => {
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    await waitFor(() => expect(fileLimit.calls.some((c) => c.cmd === "compose_config")).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    fireEvent.click(screen.getByRole("button", { name: "Apply and start report-job" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("compose.yaml still sets 256 MiB for report-job. Raise it, then press Apply and start."));
    expect(composeRuns()).toHaveLength(0);
  });

  it("given the user raised it and came back, when the window gets focus, then the file is read again and Apply and start runs that one service", async () => {
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    await waitFor(() => expect(fileLimit.calls.filter((c) => c.cmd === "compose_config")).toHaveLength(1));
    fileLimit.bytes = 1024 ** 3;
    await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise((r) => setTimeout(r, 10)); });
    expect(fileLimit.calls.filter((c) => c.cmd === "compose_config")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Apply and start report-job" }));
    await waitFor(() => expect(composeRuns()[0]?.a).toMatchObject({ context: "colima", file: FILE, action: "up", service: "report-job" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("report-job started with its new limit."));
  });

  it("given the file was raised, when the page shows it, then the raised line names the old and new value above the buttons, and no refusal shows before a press", async () => {
    fileLimit.bytes = 1024 ** 3;
    const { container } = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    await waitFor(() => expect(container.querySelector(".limit-actions .resize-result.off")).toHaveTextContent("Its limit in compose.yaml is now 1 GiB (was 256 MiB). Apply it to start."));
    const box = container.querySelector(".limit-actions")!;
    expect([...box.children].map((e) => e.className)).toEqual(["resize-result off limit-note", "actions-inline", "sr-only", "sr-only"]);
    expect(container.querySelector(".resize-result.warn")).toBeNull();
  });

  it("given Apply and start was pressed, when its run is going, then the button reads Starting… and its name says the same", async () => {
    fileLimit.bytes = 1024 ** 3;
    fileLimit.hang = true;
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    await waitFor(() => expect(screen.getByText(/is now 1 GiB/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Apply and start report-job" }));
    const going = await screen.findByRole("button", { name: "Starting report-job" });
    expect(going).toHaveTextContent("Starting…");
  });

  it("given the file still sets 256 MiB, when Apply and start is pressed, then the refusal shows as a warning line above the buttons", async () => {
    const { container } = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    await waitFor(() => expect(fileLimit.calls.some((c) => c.cmd === "compose_config")).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(container.querySelector(".resize-result.warn")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Apply and start report-job" }));
    await waitFor(() => expect(container.querySelector(".limit-actions > .resize-result.warn")).toHaveTextContent("compose.yaml still sets 256 MiB"));
    const order = [...container.querySelector(".limit-actions")!.children].map((e) => e.className);
    expect(order.indexOf("resize-result warn limit-note")).toBeLessThan(order.indexOf("actions-inline"));
  });

  it("given a refusal was said, when the user raises the file and comes back, then the refusal goes and the change is said politely", async () => {
    const { container } = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    await waitFor(() => expect(fileLimit.calls.some((c) => c.cmd === "compose_config")).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    fireEvent.click(screen.getByRole("button", { name: "Apply and start report-job" }));
    await waitFor(() => expect(container.querySelector(".resize-result.warn")).not.toBeNull());
    fileLimit.bytes = 1024 ** 3;
    await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise((r) => setTimeout(r, 80)); });
    expect(container.querySelector(".resize-result.warn")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(container.querySelector(".limit-actions .resize-result.off")).toHaveTextContent("is now 1 GiB (was 256 MiB)");
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("compose.yaml now sets 1 GiB for report-job. Apply and start runs it now."));
  });

  it("given the Apply button had focus, when the file read changes it to Start shop, then focus moves to the new button and it is said", async () => {
    fileLimit.bytes = 1024 ** 3;
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    const apply = await screen.findByRole("button", { name: "Apply and start report-job" });
    await waitFor(() => expect(screen.getByText(/is now 1 GiB/)).toBeInTheDocument());
    apply.focus();
    fileLimit.deps = true;
    await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise((r) => setTimeout(r, 80)); });
    const start = screen.getByRole("button", { name: "Start shop: report-job needs db" });
    expect(start).not.toBe(apply);
    expect(document.activeElement).toBe(start);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("compose.yaml now sets 1 GiB for report-job. The button is now Start shop."));
  });

  it("given a start that failed, when the next re-read can't read the file, then the failure alert stays", async () => {
    fileLimit.bytes = 1024 ** 3;
    fileLimit.fail = true;
    const { container } = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    await waitFor(() => expect(screen.getByText(/is now 1 GiB/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Apply and start report-job" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/^report-job didn't start\./));
    fileLimit.bad = true;
    await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise((r) => setTimeout(r, 120)); });
    expect(container.querySelector(".limit-actions .resize-result.off")).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(/^report-job didn't start\./);
    expect(container.querySelector(".resize-result.warn")).toHaveTextContent("report-job didn't start.");
  });

  it("given TextEdit is what Open uses, when the line shows, then it says so before any click and the button reads Open in TextEdit; the click opens at once", async () => {
    fileLimit.opened = "textedit";
    const { container } = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    const open = await screen.findByRole("button", { name: "Open in TextEdit: compose.yaml, report-job" });
    expect(open).toHaveTextContent("Open in TextEdit");
    const hint = container.querySelector(".limit-actions > .hint.limit-note")!;
    expect(hint).toHaveTextContent("It opens in TextEdit: turn off Edit > Substitutions > Smart Quotes before you type.");
    expect(hint).not.toHaveAttribute("aria-hidden");
    expect(fileLimit.calls.some((c) => c.cmd === "open_compose")).toBe(false);
    fireEvent.click(open);
    expect(fileLimit.calls.filter((c) => c.cmd === "open_compose")).toHaveLength(1);
  });

  it("given the YAML editor opens it, when the line shows, then there is no TextEdit hint and the button reads Open compose.yaml", async () => {
    const { container } = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    await waitFor(() => expect(fileLimit.calls.some((c) => c.cmd === "compose_editor")).toBe(true));
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(container.querySelector(".limit-actions > .hint.limit-note")).toBeNull();
    expect(screen.getByRole("button", { name: "Open compose.yaml: report-job" })).toHaveTextContent("Open compose.yaml");
  });

  it("given Open was pressed, when open is still running, then the button reads Opening…, is disabled, and a second press does nothing", async () => {
    fileLimit.openHang = true;
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Open compose.yaml: report-job" }));
    const going = await screen.findByRole("button", { name: "Opening…: compose.yaml" });
    expect(going).toHaveTextContent("Opening…");
    expect(going).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(going);
    expect(fileLimit.calls.filter((c) => c.cmd === "open_compose")).toHaveLength(1);
  });

  it("given macOS can't open the file, when Open is pressed, then it names the app once and Open becomes Show in Finder, with focus on it", async () => {
    fileLimit.openFail = "OPEN_FAILED:Cursor\nThe application can't be opened";
    const { container } = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    const open = screen.getByRole("button", { name: "Open compose.yaml: report-job" });
    open.focus();
    fireEvent.click(open);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't open compose.yaml in Cursor: the application can't be opened. Open it from Finder."));
    expect(container.querySelectorAll(".limit-actions .limit-note")).toHaveLength(1);
    expect(container.querySelector(".limit-actions .resize-result.warn code")).toHaveTextContent("compose.yaml");
    const finder = screen.getByRole("button", { name: "Show in Finder: compose.yaml" });
    expect(finder).toHaveTextContent(/^Show in Finder$/);
    expect(screen.queryByRole("button", { name: /^Open compose/ })).toBeNull();
    expect(document.activeElement).toBe(finder);
    fireEvent.click(finder);
    await waitFor(() => expect(fileLimit.calls.find((c) => c.cmd === "reveal_compose")?.a).toEqual({ path: FILE }));
  });

  it("given open is still going at its deadline, when it answers, then it says Still opening once as a status and offers no Finder", async () => {
    fileLimit.openFail = "STILL_OPENING";
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Open compose.yaml: report-job" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Still opening compose.yaml…"));
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(screen.queryByRole("button", { name: "Show in Finder: compose.yaml" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open compose.yaml: report-job" })).not.toHaveAttribute("aria-disabled");
  });

  it("given each state of the file's button, when it is named, then the name starts with the visible words (label in name)", async () => {
    const startsWithText = (b: HTMLElement) => expect(b.getAttribute("aria-label")!.startsWith(b.textContent!)).toBe(true);
    // App unknown, then known, then TextEdit, then while opening, then after a failure.
    const { unmount } = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    startsWithText(screen.getByRole("button", { name: "Open compose.yaml: report-job" }));
    unmount();
    fileLimit.app = "Cursor";
    const known = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    const cursor = await screen.findByRole("button", { name: "Open in Cursor: compose.yaml, report-job" });
    expect(cursor).toHaveTextContent(/^Open in Cursor$/);
    startsWithText(cursor);
    known.unmount();
    fileLimit.opened = "textedit";
    const te = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    startsWithText(await screen.findByRole("button", { name: "Open in TextEdit: compose.yaml, report-job" }));
    te.unmount();
    fileLimit.opened = "editor"; fileLimit.app = null; fileLimit.openHang = true;
    const going = inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Open compose.yaml: report-job" }));
    startsWithText(await screen.findByRole("button", { name: "Opening…: compose.yaml" }));
    going.unmount();
    fileLimit.openHang = false; fileLimit.openFail = "OPEN_FAILED:Cursor\n";
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Open compose.yaml: report-job" }));
    startsWithText(await screen.findByRole("button", { name: "Show in Finder: compose.yaml" }));
  });

  it("given Open had focus, when the app it opens in changes on window focus, then focus moves to the new button and it is said", async () => {
    fileLimit.app = "Cursor";
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    const cursor = await screen.findByRole("button", { name: "Open in Cursor: compose.yaml, report-job" });
    cursor.focus();
    fileLimit.opened = "textedit";
    await act(async () => { window.dispatchEvent(new Event("focus")); await new Promise((r) => setTimeout(r, 20)); });
    const te = screen.getByRole("button", { name: "Open in TextEdit: compose.yaml, report-job" });
    expect(te).not.toBe(cursor);
    expect(document.activeElement).toBe(te);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("It now opens in TextEdit."));
  });

  it("given the first lookup lands, when the app becomes known under focus, then focus follows and nothing is said", async () => {
    fileLimit.app = "Cursor";
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    screen.getByRole("button", { name: "Open compose.yaml: report-job" }).focus();
    const cursor = await screen.findByRole("button", { name: "Open in Cursor: compose.yaml, report-job" });
    await act(async () => { await new Promise((r) => setTimeout(r, 80)); });
    expect(document.activeElement).toBe(cursor);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("given another Compose run going, when Apply and start is reached, then it is locked and its reason is read with it", async () => {
    fileLimit.hang = true;
    void runCompose("colima", { dir: "/Users/me/code/blog", files: ["docker-compose.yml"], name: "blog" }, "up", []);
    inVm(<HealthPanel state={killed(LABELS)} listed={[FILE]} ctx="colima" onLogs={() => {}} />);
    const apply = screen.getByRole("button", { name: "Apply and start report-job" });
    expect(apply).toHaveAttribute("aria-disabled", "true");
    expect(apply).toHaveAccessibleDescription("Waits for the Compose run that is going.");
  });

  it("given the same limit from a project the scan doesn't list, when shown, then only See why (the logs) is offered", () => {
    inVm(<HealthPanel state={killed(LABELS)} listed={[]} onLogs={() => {}} />);
    expect(screen.queryByRole("button", { name: /^Open compose|Apply/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open the logs" })).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// The inspect of the containers running before the restart, and every call the page makes.
const calls = vi.hoisted(() => ({ list: [] as { cmd: string; a: Record<string, unknown> }[], dns: ["resolved"] as string[], yaml: "" }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, a: Record<string, unknown> = {}) => {
    calls.list.push({ cmd, a });
    if (cmd === "docker" && (a.args as string[])[0] === "ps") return JSON.stringify({ Names: "web", State: "running", Labels: "" });
    if (cmd === "colima_config") return { home: "/Users/me", yaml: calls.yaml };
    if (cmd === "vm_dns_probe") return calls.dns.shift() ?? "resolved";
    return "";
  }),
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
// jsdom has no element scrolling; the output log and the result line call it.
Element.prototype.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
const { VmChangeButton, VmChangeOr, ResizeStatus, ResultRow, ResizeAnnouncer, ResizeProvider, dismissResize, resizeState, addChangeRefresh, startWayBack, wayBackApplies } = await import("./Resize");
const { ConfirmProvider } = await import("./ui");
import type { VmChange } from "./lib/vmChange";

const share: VmChange = { kind: "mounts", mounts: [{ path: "/Users/me", writable: true }, { path: "/Volumes/data", writable: true }], before: [{ path: "/Users/me", writable: true }], what: "/Volumes/data", makeWritable: false };
const dns: VmChange = { kind: "restart", why: "dns" };
const base = { profile: { name: "work", status: "Running", arch: "aarch64", cpus: 2, memory: 2 * 1024 ** 3, disk: 0, runtime: "docker" }, host: null, pick: null, locked: false, vmBusy: false, onProfiles: () => {} };
const TITLE = "Sees an empty `/Volumes/data` (not shared with Colima), web";
// row: how the Doctor shows it (the row's status leaves a good result out, and ResultRow shows it as its own row).
const tree = (env: Record<string, unknown>, change: VmChange = share, row = false) => (
  <ConfirmProvider>
    <ResizeProvider value={{ ...base, runVm: async () => null, ...env } as never}>
      {row ? <><VmChangeOr from="home:web:mount-unshared" change={change} title={TITLE} noStatus /><ResizeStatus from="home:web:mount-unshared" title={TITLE} okElsewhere /><ResultRow from="home:web:mount-unshared" /></>
        : <VmChangeOr from="home:web:mount-unshared" change={change} title={TITLE} />}
    </ResizeProvider>
  </ConfirmProvider>
);
const mount = (env: Record<string, unknown>, change: VmChange = share, row = false) => render(tree(env, change, row));

describe("VmChangeButton", () => {
  it("given a folder change, when shown, then the name starts with the visible words and the title says what it does", () => {
    dismissResize();
    mount({});
    const b = screen.getByRole("button", { name: "Share folder…: Sees an empty /Volumes/data (not shared with Colima), web" });
    expect(b).toHaveTextContent("Share folder…");
    expect(b).toHaveAttribute("title", "Restarts the VM to share /Volumes/data");
    expect(b).not.toHaveAttribute("aria-disabled");
  });

  it("given the VM is busy, when shown, then the button is aria-disabled with the reason, and a press does nothing", () => {
    dismissResize();
    const runVm = vi.fn(async () => null);
    mount({ locked: true, runVm });
    const b = screen.getByRole("button", { name: /^Share folder…/ });
    expect(b).toHaveAttribute("aria-disabled", "true");
    expect(b).toHaveAttribute("title", "Waits for the VM, Compose run or container fix that is running");
    // The reason is spoken with the button: a tooltip is not read for one that can't be pressed.
    expect(b).toHaveAccessibleDescription("Waits for the VM, Compose run or container fix that is running");
    fireEvent.click(b);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(runVm).not.toHaveBeenCalled();
  });

  it("given the confirm is cancelled, when pressed, then nothing runs", async () => {
    dismissResize();
    const runVm = vi.fn(async () => null);
    mount({ runVm });
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    const dlg = await screen.findByRole("alertdialog");
    expect(dlg).toHaveTextContent("Share /Volumes/data with the VM?");
    expect(dlg.querySelector("code")).toHaveTextContent("/Volumes/data");
    expect(screen.getByRole("button", { name: "Share and restart" })).toBeInTheDocument();
    expect(dlg).toHaveTextContent("Images, volumes and containers stay");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(runVm).not.toHaveBeenCalled();
  });

  it("given the confirm is accepted, when pressed, then the VM runs apply_mounts with the whole list for that profile, and a plain result stays until Dismiss", async () => {
    dismissResize();
    const runVm = vi.fn(async () => null);
    mount({ runVm }, share, true);
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    await waitFor(() => expect(runVm).toHaveBeenCalledWith("restarting", "apply_mounts", { name: "work", mounts: share.mounts }));
    // The path is in the code font, and the good result is one row with a check and Dismiss.
    await waitFor(() => expect(screen.getByText(/is shared with the VM now\./)).toBeInTheDocument());
    expect(screen.getByText(/is shared with the VM now\./).closest("li")).toHaveClass("finding", "ok");
    expect(screen.getByText("/Volumes/data", { selector: "code" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByText(/is shared with the VM now/)).not.toBeInTheDocument());
  });

  it("given the backend refuses before it stops anything, when run, then the result is its sentence and no stopped-VM words", async () => {
    dismissResize();
    const runVm = vi.fn(async () => "Nothing changed: /Volumes/data is not a folder on this Mac, so it can't be shared.\n");
    mount({ runVm });
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    const line = await screen.findByText(/^Nothing changed: /);
    expect(line).toHaveTextContent("is not a folder on this Mac");
    expect(line).not.toHaveTextContent("The VM is stopped");
  });

  it("given the restart fails, when run, then it says what failed for the folder, that the VM is stopped and the folder stayed saved, and never a size", async () => {
    dismissResize();
    const runVm = vi.fn(async () => "FATA[0009] error starting vm: exit status 1");
    mount({ runVm });
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    const line = await screen.findByText(/The VM is stopped\./);
    expect(line).toHaveTextContent("Colima couldn't start the VM with /Volumes/data shared.");
    expect(line).toHaveTextContent("/Volumes/data stays saved in the profile");
    expect(line).not.toHaveTextContent("new size");
    expect(screen.getByRole("button", { name: "Try again: Sees an empty /Volumes/data (not shared with Colima), web" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Start with the folders you had: / })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Show the log: / })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Try \d|^Start it as it was/ })).not.toBeInTheDocument();
  });

  it("given a failed folder change, when the old folders are asked for, then the old list starts the stopped VM and the result says so", async () => {
    dismissResize();
    const runVm = vi.fn(async (_op: string, cmd: string) => (cmd === "apply_mounts" && runVm.mock.calls.length === 1 ? "FATA error starting vm: exit status 1" : null));
    const view = mount({ runVm }, share, true);
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Start with the folders you had: / }));
    // (the app's profile reads Stopped after a failed start)
    view.rerender(tree({ runVm, profile: { ...base.profile, status: "Stopped" } }, share, true));
    await waitFor(() => expect(runVm).toHaveBeenCalledTimes(2));
    expect(runVm.mock.calls[1]).toEqual(["restarting", "apply_mounts", { name: "work", mounts: [{ path: "/Users/me", writable: true }], force: true }]);
    await waitFor(() => expect(screen.getByText(/The VM started with the folders it had\./)).toBeInTheDocument());
  });

  it("given Show the log is pressed, when the VM has a log, then the app reveals that profile's log", async () => {
    dismissResize();
    mount({ runVm: vi.fn(async () => "FATA error starting vm: exit status 1") });
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Show the log: / }));
    await waitFor(() => expect(calls.list.some((c) => c.cmd === "reveal_vm_log" && c.a.name === "work")).toBe(true));
  });

  it("given a restart for the network, when the lookup works after it, then the result says names work again, in its own row", async () => {
    dismissResize();
    calls.dns = ["resolved"];
    mount({}, dns, true);
    fireEvent.click(screen.getByRole("button", { name: /^Restart the VM…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Restart the VM" }));
    await waitFor(() => expect(screen.getByText(/^The VM can look up names again\./)).toBeInTheDocument());
    expect(screen.getByText(/look up names again/).closest("li")).toHaveClass("finding", "ok");
    expect(resizeState().outcome).toMatchObject({ kind: "done" });
  });

  it("given a restart for the network, when names still fail after it, then the result says so as a problem and keeps its buttons", async () => {
    dismissResize();
    calls.dns = ["failed", "failed"];
    mount({}, dns, true);
    fireEvent.click(screen.getByRole("button", { name: /^Restart the VM…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Restart the VM" }));
    await waitFor(() => expect(screen.getByText(/still can't look up names/)).toBeInTheDocument(), { timeout: 8000 });
    expect(screen.getByText(/still can't look up names/).closest("p")).toHaveClass("bad");
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  }, 12000);

  it("given a change that worked, when it is about to show its result, then the facts were read again first, so the fixed finding is gone with it", async () => {
    dismissResize();
    const seen: unknown[] = [];
    const off = addChangeRefresh(async () => { seen.push(resizeState().outcome); });
    mount({}, share, true);
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    await waitFor(() => expect(resizeState().outcome).toMatchObject({ kind: "done" }));
    off();
    expect(seen).toEqual([null]);
  });

  it("given focus moved elsewhere during the restart, when it ends well, then the page's announcer still says the result", async () => {
    dismissResize();
    render(<ConfirmProvider><ResizeProvider value={{ ...base, runVm: async () => null } as never}><input aria-label="elsewhere" /><VmChangeOr from="home:web:x" change={share} title={TITLE} /><ResizeAnnouncer /></ResizeProvider></ConfirmProvider>);
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    screen.getByLabelText("elsewhere").focus();
    await waitFor(() => expect(document.querySelector("[data-resize-announcer][role=status]")?.textContent ?? "").toMatch(/is shared with the VM now/));
  });

  it("given a busy way-back button, when pressed, then its name says it is starting, with the row's title", async () => {
    dismissResize();
    let release: (v: string | null) => void = () => {};
    let n = 0;
    const runVm = vi.fn(() => (++n === 1 ? Promise.resolve("FATA error starting vm: exit status 1") : new Promise<string | null>((r) => { release = r; })));
    mount({ runVm });
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Start with the folders you had: / }));
    expect(await screen.findByRole("button", { name: /^Starting…: / })).toBeInTheDocument();
    release(null);
  });

  const FAILED_YAML = "mounts:\n  - location: /Users/me\n    writable: true\n  - location: /Volumes/data\n    writable: true\n";
  const failAndDismiss = async (runVm: ReturnType<typeof vi.fn>) => {
    mount({ runVm });
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    fireEvent.click(await screen.findByRole("button", { name: "Dismiss" }));
  };

  it("given a failed folder change that was dismissed, when the saved list is still the failed one, then the way back is offered and runs the old list by force", async () => {
    dismissResize();
    calls.yaml = FAILED_YAML;
    const runVm = vi.fn(async (_op: string, _cmd: string) => (runVm.mock.calls.length === 1 ? "FATA error starting vm: exit status 1" : null));
    await failAndDismiss(runVm);
    expect(await wayBackApplies("work")).toMatchObject({ kind: "mounts", what: "/Volumes/data" });
    expect(await startWayBack({ ...base, runVm } as never)).toBe(true);
    expect(runVm.mock.calls[1]).toEqual(["restarting", "apply_mounts", { name: "work", mounts: [{ path: "/Users/me", writable: true }], force: true }]);
    expect(await wayBackApplies("work")).toBeNull();
    expect(resizeState().outcome).toMatchObject({ kind: "done" });
    expect(await startWayBack({ ...base, runVm } as never)).toBe(false);
  });

  it("given the saved list differs from the failed one (the disk was unplugged and the file edited, or Profiles changed it), when the way back is asked for, then it is dropped and nothing runs", async () => {
    dismissResize();
    calls.yaml = FAILED_YAML;
    const runVm = vi.fn(async (_op: string, _cmd: string) => (runVm.mock.calls.length === 1 ? "FATA error starting vm: exit status 1" : null));
    await failAndDismiss(runVm);
    calls.yaml = "mounts:\n  - location: /Users/me\n    writable: true\n";
    expect(await startWayBack({ ...base, runVm } as never)).toBe(false);
    expect(runVm).toHaveBeenCalledTimes(1);
    calls.yaml = FAILED_YAML;
    expect(await wayBackApplies("work")).toBeNull();
    expect(localStorage.getItem("colima-ui.wayBack")).toBeNull();
  });

  it("given the app was closed after a failed start, when it opens again, then the way back comes back from storage, and a changed file still drops it", async () => {
    dismissResize();
    calls.yaml = FAILED_YAML;
    const runVm = vi.fn(async (_op: string, _cmd: string) => (runVm.mock.calls.length === 1 ? "FATA error starting vm: exit status 1" : null));
    await failAndDismiss(runVm);
    expect(localStorage.getItem("colima-ui.wayBack")).toContain("/Volumes/data");
    vi.resetModules();
    const again = await import("./Resize");
    expect(await again.wayBackApplies("work")).toMatchObject({ kind: "mounts", what: "/Volumes/data" });
    expect(await again.wayBackApplies("other")).toBeNull();
    calls.yaml = "mounts: []\n";
    expect(await again.wayBackApplies("work")).toBeNull();
    expect(localStorage.getItem("colima-ui.wayBack")).toBeNull();
  });

  it("given storage that throws or holds junk, when the app starts, then there is simply no way back", async () => {
    localStorage.setItem("colima-ui.wayBack", "{not json");
    vi.resetModules();
    const again = await import("./Resize");
    expect(await again.wayBackApplies("work")).toBeNull();
    localStorage.clear();
  });

  it("given the failed card, when its buttons are listed, then Dismiss, Show the log, Try again and the filled way back come in that order, all push buttons", async () => {
    dismissResize();
    mount({ runVm: vi.fn(async () => "FATA error starting vm: exit status 1") });
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    await screen.findByRole("button", { name: /^Show the log: / });
    const row = screen.getByRole("button", { name: "Dismiss" }).parentElement!;
    const names = [...row.querySelectorAll("button")].map((b) => b.textContent);
    expect(names).toEqual(["Dismiss", "Show the log", "Try again", "Start with the folders you had"]);
    expect(row.querySelector("button.primary")?.textContent).toBe("Start with the folders you had");
    expect(screen.getByRole("button", { name: /^Show the log: / })).toHaveClass("small");
  });

  it("given the log can't be opened twice, when pressed twice, then the message is cleared and written again so it is read again", async () => {
    dismissResize();
    const core = await import("@tauri-apps/api/core");
    const inv = core.invoke as unknown as ReturnType<typeof vi.fn>;
    const old = inv.getMockImplementation()!;
    inv.mockImplementation(async (cmd: string, a: Record<string, unknown> = {}) => { if (cmd === "reveal_vm_log") throw "no log"; return old(cmd, a); });
    mount({ runVm: vi.fn(async () => "FATA error starting vm: exit status 1") });
    fireEvent.click(screen.getByRole("button", { name: /^Share folder…/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Share and restart" }));
    fireEvent.click(await screen.findByRole("button", { name: /^Show the log: / }));
    await waitFor(() => expect(screen.getByText("Couldn't open the VM log in Finder.", { selector: "p.sr-only" })).toBeInTheDocument());
    const region = screen.getByText("Couldn't open the VM log in Finder.", { selector: "p.sr-only" });
    const seen: string[] = [];
    const watch = new MutationObserver(() => seen.push(region.textContent ?? ""));
    watch.observe(region, { childList: true, characterData: true, subtree: true });
    fireEvent.click(screen.getByRole("button", { name: /^Show the log: / }));
    await waitFor(() => expect(seen).toEqual(["", "Couldn't open the VM log in Finder."]));
    watch.disconnect();
    inv.mockImplementation(old);
  });

  it("given a button alone, when rendered without a provider, then it is disabled instead of throwing", () => {
    dismissResize();
    render(<ConfirmProvider><VmChangeButton from="x" change={share} title="t" /></ConfirmProvider>);
    expect(screen.getByRole("button", { name: /^Share folder…/ })).toHaveAttribute("aria-disabled", "true");
  });
});

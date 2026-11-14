import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend, jsonLines } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import Containers, { VmState } from "./Containers";
import { ConfirmProvider } from "./ui/op";
import { reset as resetFixes, startFix } from "./lib/fixStore";
import { resetComposeRun } from "./ComposeProjects";
import { resetAppStopped } from "./lib/appStopped";
import type { Finding, Report } from "./lib/doctor";

const POD = "io.kubernetes.pod.name=coredns-1,io.kubernetes.pod.namespace=kube-system";
const rows = [
  { ID: "aaa", Names: "web", Image: "nginx:latest", State: "running", Status: "Up 2 hours", Ports: "", Labels: "" },
  { ID: "bbb", Names: "cache", Image: "redis:7", State: "exited", Status: "Exited (0) 3 hours ago", Ports: "", Labels: "" },
];
const SHOP = (n: string) => `com.docker.compose.project=shop,com.docker.compose.service=${n}`;
const composeRows = [
  ...rows,
  { ID: "s1", Names: "shop-api-1", Image: "shop/api", State: "running", Status: "Up 1 hour", Ports: "", Labels: SHOP("api") },
  { ID: "s2", Names: "shop-db-1", Image: "postgres:16", State: "running", Status: "Up 1 hour", Ports: "", Labels: SHOP("db") },
];
// Enough rows (>= 7) for the search field to earn its place.
const manyRows = [
  ...rows,
  ...composeRows.slice(2),
  { ID: "x1", Names: "alpha", Image: "nginx:latest", State: "running", Status: "Up 1 hour", Ports: "", Labels: "" },
  { ID: "x2", Names: "beta", Image: "redis:7", State: "running", Status: "Up 1 hour", Ports: "", Labels: "" },
  { ID: "x3", Names: "gamma", Image: "postgres:16", State: "running", Status: "Up 1 hour", Ports: "", Labels: "" },
  { ID: "x4", Names: "delta", Image: "mysql:8", State: "running", Status: "Up 1 hour", Ports: "", Labels: "" },
  { ID: "x5", Names: "epsilon", Image: "mongo:6", State: "running", Status: "Up 1 hour", Ports: "", Labels: "" },
  { ID: "x6", Names: "zeta", Image: "node:18", State: "running", Status: "Up 1 hour", Ports: "", Labels: "" },
  { ID: "x7", Names: "eta", Image: "ruby:3", State: "running", Status: "Up 1 hour", Ports: "", Labels: "" },
];
const profile = { name: "default", status: "Running", arch: "aarch64", cpus: 4, memory: 8 * 1024 ** 3, disk: 100 * 1024 ** 3, runtime: "docker" };
const scan = { paths: [], scanning: false, error: null, scan: async () => {}, add: async () => null, pinned: [] };
const problem = (subject: string, extra: Partial<Finding> = {}): Finding =>
  ({ id: "restarting", key: `colima/restarting:${subject}`, area: "containers", severity: "action", level: "bad", subject, title: `${subject} keeps crashing`, short: "It keeps crashing", detail: "Exit code 1.", ...extra }) as Finding;
const reportOf = (findings: Finding[]): Report => {
  const byContainer = new Map<string, Finding[]>();
  for (const f of findings) if (f.subject) byContainer.set(f.subject, [...(byContainer.get(f.subject) ?? []), f]);
  return { findings, byContainer, extra: new Map(), passed: [] };
};

function show({ list = rows, report = null as Report | null, vm = { op: null, failure: null } as VmState, inspected = undefined as unknown[] | undefined } = {}) {
  backend.current = fakeBackend({ ps: () => jsonLines(list), stats: () => "", "system df": () => "", inspect: () => "[]" });
  const onImages = vi.fn();
  const setDetailId = vi.fn();
  const onKubernetes = vi.fn();
  render(
    <ConfirmProvider>
      <Containers profile={profile} ctx="colima" vm={vm} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={setDetailId} onPull={() => {}} onProfiles={() => {}} compose={scan} onImages={onImages} onKubernetes={onKubernetes} report={report} onReport={() => {}} inspected={inspected} />
    </ConfirmProvider>,
  );
  return { onImages, setDetailId, onKubernetes };
}

const rowOf = async (name: string) => (await screen.findByRole("button", { name: new RegExp(`^${name},`) })).closest("li") as HTMLElement;
async function menuOf(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await screen.findByRole("button", { name: `More actions for ${name}` }));
  return screen.getByRole("menu", { name: `More actions for ${name}` });
}

describe("Containers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFixes();
    resetComposeRun();
  });
  it("given the first poll has not answered yet, when the list loads, then skeleton rows show until docker ps answers", async () => {
    let resolvePs: ((value: string) => void) | null = null;
    const deferred = new Promise<string>((r) => { resolvePs = r; });
    backend.current = {
      invoke: vi.fn(async (cmd: string, a: Record<string, unknown>) => {
        if (cmd === "docker" && (a.args as string[])?.[0] === "ps") return deferred;
        return "";
      }),
      calls: [] as { cmd: string; args?: string[] }[],
      dockerCalls: () => [],
    };
    render(
      <ConfirmProvider>
        <Containers profile={profile} ctx="colima" vm={{ op: null, failure: null } as VmState} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={() => {}} onPull={() => {}} onProfiles={() => {}} compose={scan} onImages={() => {}} report={null} onReport={() => {}} />
      </ConfirmProvider>,
    );
    expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    resolvePs!(jsonLines(rows));
    await waitFor(() => expect(screen.getByRole("button", { name: /^web,/ })).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.queryByLabelText("Loading")).not.toBeInTheDocument();
  });

  it("given no containers at all, when the list loads, then an empty state with no actions shows", async () => {
    show({ list: [] });
    expect(await screen.findByText(/No containers yet/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Run an image/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Start a Compose project/ })).not.toBeInTheDocument();
  });

  it("given a search term that matches nothing, when typed, then an empty state with a Clear search button shows", async () => {
    show({ list: manyRows });
    const input = await screen.findByRole("textbox", { name: "Search containers" });
    await userEvent.type(input, "zzzz");
    await waitFor(() => expect(screen.getByText(/Nothing matches/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Clear search/ })).toBeInTheDocument();
    await userEvent.clear(input);
    await waitFor(() => expect(screen.queryByText(/Nothing matches/)).not.toBeInTheDocument());
  });

  it("given the VM is stopped, when the list loads, then an empty state with Start VM shows", async () => {
    render(
      <ConfirmProvider>
        <Containers profile={{ ...profile, status: "Stopped" }} ctx={null} vm={{ op: null, failure: null } as VmState} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={() => {}} onPull={() => {}} onProfiles={() => {}} compose={scan} onImages={() => {}} report={null} onReport={() => {}} />
      </ConfirmProvider>,
    );
    expect(await screen.findByText(/is stopped/)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^Start VM$/ })).toBeInTheDocument();
  });

  it("given docker is unreachable after a good read, when the list fails, then a banner with Try again and Restart shows", async () => {
    const user = userEvent.setup();
    backend.current = fakeBackend({
      ps: async () => { throw new Error("connection refused"); },
      stats: () => "", "system df": () => "", inspect: () => "[]",
    });
    render(
      <ConfirmProvider>
        <Containers profile={profile} ctx="colima" vm={{ op: null, failure: null } as VmState} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={() => {}} onPull={() => {}} onProfiles={() => {}} compose={scan} onImages={() => {}} report={null} onReport={() => {}} />
      </ConfirmProvider>,
    );
    await waitFor(() => expect(screen.getByText(/connection refused/)).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByText(/connection refused/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Restart/ })).toBeInTheDocument();
  });

  it("given Stop is pressed, then the row button shows Start again once ps confirms", async () => {
    const user = userEvent.setup();
    let psCalls = 0;
    backend.current = fakeBackend({
      ps: async () => {
        psCalls++;
        if (psCalls <= 2) return jsonLines(rows);
        return jsonLines([{ ...rows[0], State: "exited", Status: "Exited (0) 1 second ago" }]);
      },
      stop: async () => { return ""; },
      stats: () => "", "system df": () => "", inspect: () => "[]",
    });
    render(
      <ConfirmProvider>
        <Containers profile={profile} ctx="colima" vm={{ op: null, failure: null } as VmState} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={() => {}} onPull={() => {}} onProfiles={() => {}} compose={scan} onImages={() => {}} report={null} onReport={() => {}} />
      </ConfirmProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /^web, Running/ })).toBeInTheDocument(), { timeout: 5000 });
    await userEvent.click(screen.getByRole("button", { name: /Stop web/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^Start web$/ })).toBeInTheDocument(), { timeout: 8000 });
  }, 10000);

  it("given docker start throws a port clash, when the row's Start is clicked, then a Problem line with Try again shows", async () => {
    const user = userEvent.setup();
    backend.current = fakeBackend({
      ps: () => jsonLines(rows),
      start: async () => { throw new Error("Bind for 0.0.0.0:8080 failed: port is already allocated"); },
      stats: () => "", "system df": () => "", inspect: () => "[]",
    });
    render(
      <ConfirmProvider>
        <Containers profile={profile} ctx="colima" vm={{ op: null, failure: null } as VmState} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={() => {}} onPull={() => {}} onProfiles={() => {}} compose={scan} onImages={() => {}} report={null} onReport={() => {}} />
      </ConfirmProvider>,
    );
    await waitFor(() => expect(screen.getByRole("button", { name: /^cache,/ })).toBeInTheDocument(), { timeout: 5000 });
    await userEvent.click(await screen.findByRole("button", { name: /Start cache/ }));
    await waitFor(() => expect(screen.getByText(/port is already allocated/)).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.getByRole("button", { name: /Dismiss/ })).toBeInTheDocument();
  });

  it("given two projects, when Remove is opened from each menu, then the dialog names both rows separately", async () => {
    const user = userEvent.setup();
    show({ list: composeRows });
    await userEvent.click(await screen.findByRole("button", { name: "More actions for shop" }));
    const menu = await screen.findByRole("menu", { name: "More actions for shop" });
    await userEvent.click(within(menu).getByRole("menuitem", { name: /Remove…/ }));
    const ask = await screen.findByRole("alertdialog");
    expect(ask).toHaveTextContent("Remove shop's 2 containers");
    await userEvent.click(within(ask).getByRole("button", { name: "Cancel" }));
    await userEvent.click(await screen.findByRole("button", { name: /^cache,/ }));
    await userEvent.click(await screen.findByRole("button", { name: "More actions for cache" }));
    const menu2 = await screen.findByRole("menu", { name: "More actions for cache" });
    await userEvent.click(within(menu2).getByRole("menuitem", { name: /Remove…/ }));
    const ask2 = await screen.findByRole("alertdialog");
    expect(ask2).toHaveTextContent("Remove cache?");
    await userEvent.click(within(ask2).getByRole("button", { name: "Cancel" }));
  });

  it("given Escape pressed twice, when selection is cleared, then search works again", async () => {
    show({ list: manyRows });
    const input = await screen.findByRole("textbox", { name: "Search containers" });
    await userEvent.type(input, "api");
    await waitFor(() => expect(screen.getAllByRole("button", { name: /^shop-api-1,/ })).toHaveLength(1));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Search containers" })).toHaveValue(""));
    // Unfold the shop project to see its services again
    const shop = await screen.findByRole("button", { name: /shop, project, Running/ });
    await userEvent.click(shop);
    expect(await screen.findAllByRole("button", { name: /^shop-/ })).toHaveLength(2);
  });

  it("given a project with a problem that is folded, when opened, then it stays folded until clicked again", async () => {
    show({ list: composeRows, report: reportOf([problem("shop-api-1")]) });
    const shop = await screen.findByRole("button", { name: /shop, project, Running/ });
    await userEvent.click(shop);
    expect(shop).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(shop);
    expect(shop).toHaveAttribute("aria-expanded", "false");
    // The problem line is still under the folded row
    expect(screen.getByText(/keeps crashing/)).toBeInTheDocument();
  });

  it("given multiple problems, when the list loads, then problems show before states in top-level order", async () => {
    show({ list: composeRows, report: reportOf([problem("shop-api-1"), problem("web")]) });
    const shop = await screen.findByRole("button", { name: /shop, project, Running/ });
    // Problems show under the project row
    const shopRow = shop.closest("li") as HTMLElement;
    expect(within(shopRow).getByText(/keeps crashing/)).toBeInTheDocument();
    // The loose container web also shows its problem
    const webRow = (await rowOf("web")).closest("li") as HTMLElement;
    expect(within(webRow).getByText(/keeps crashing/)).toBeInTheDocument();
  });

  it("given fewer than 7 rows, when the list loads, then there is no search field", async () => {
    show();
    await rowOf("web");
    expect(screen.queryByRole("textbox", { name: "Search containers" })).not.toBeInTheDocument();
  });

  it("given a Kubernetes pod, when the list loads, then it is one Kubernetes row that opens its tab and has no Stop or Remove", async () => {
    const user = userEvent.setup();
    const { onKubernetes } = show({ list: [...rows.slice(0, 2), { ID: "kkk", Names: "k8s_coredns_coredns-1_kube-system_0", Image: "coredns:1.11", State: "running", Status: "Up 1 hour", Ports: "", Labels: POD }] });
    const kubeRow = await screen.findByRole("button", { name: /^Kubernetes,/ });
    expect(kubeRow.closest("li")).toHaveTextContent("1 container");
    await user.click(within(kubeRow.closest("li")).getByRole("button", { name: "Open the Kubernetes tab" }));
    expect(onKubernetes).toHaveBeenCalledOnce();
  });

  it("given rows, when the list loads, then it is alphabetical with Kubernetes last and has no checkboxes", async () => {
    show({ list: [...rows.slice(0, 2), { ID: "kkk", Names: "k8s_coredns_coredns-1_kube-system_0", Image: "coredns:1.11", State: "running", Status: "Up 1 hour", Ports: "", Labels: POD }] });
    await rowOf("web");
    const names = [...document.querySelectorAll(".app-name")].map((b) => b.textContent);
    expect(names).toEqual(["cache", "web", "Kubernetes"]);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("given a running container, when Remove is confirmed from its menu, then one docker rm removes exactly that container", async () => {
    const user = userEvent.setup();
    show();
    const menu = await menuOf(user, "web");
    await user.click(within(menu).getByRole("menuitem", { name: "Remove…" }));
    const ask = await screen.findByRole("alertdialog");
    expect(ask).toHaveTextContent("Remove web? It is running and will be stopped first. Its image and volumes stay.");
    await user.click(within(ask).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(backend.current!.dockerCalls()).toContainEqual(["rm", "-f", "aaa"]));
  });

  it("given a cancelled remove, when the dialog closes, then nothing is removed", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("button", { name: "More actions for web" }));
    const menu = await screen.findByRole("menu", { name: "More actions for web" });
    await user.click(within(menu).getByRole("menuitem", { name: "Remove…" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(backend.current!.dockerCalls().some((a) => a[0] === "rm")).toBe(false);
  });

  it("given a Compose project, when the list loads, then it is one row whose services show only when opened", async () => {
    const user = userEvent.setup();
    show({ list: composeRows });
    const name = await screen.findByRole("button", { name: "shop, project, Running" });
    expect(name).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /^shop-api-1,/ })).not.toBeInTheDocument();
    await user.click(name);
    expect(name).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "shop-api-1, Running" })).toHaveTextContent("api");
    expect(screen.getByRole("button", { name: "shop-db-1, Running" })).toHaveTextContent("db");
  });

  it("given a project with no known Compose file, when Stop is pressed, then one docker stop stops all its containers and the row says Stopping…", async () => {
    const user = userEvent.setup();
    show({ list: composeRows });
    const stop = await screen.findByRole("button", { name: "Stop shop" });
    await user.click(stop);
    await waitFor(() => expect(backend.current!.dockerCalls()).toContainEqual(["stop", "s1", "s2"]));
    expect(stop).toHaveTextContent("Stopping…");
    expect(stop).toBeDisabled();
  });

  it("given Stop was pressed, when docker ps shows the container stopped, then the button reads Start again", async () => {
    const user = userEvent.setup();
    const list = rows.slice(0, 1).map((r) => ({ ...r }));
    show({ list });
    const stop = await screen.findByRole("button", { name: "Stop web" });
    await user.click(stop);
    expect(stop).toHaveTextContent("Stopping…");
    Object.assign(list[0], { State: "exited", Status: "Exited (0) 1 second ago" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Start web" })).toHaveTextContent("Start"), { timeout: 5000 });
  });
});



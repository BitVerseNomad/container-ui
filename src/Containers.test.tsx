import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend, jsonLines } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import Containers, { VmState } from "./Containers";
import { ConfirmProvider } from "./ui";
import { reset as resetFixes, startFix } from "./lib/fixStore";
import { resetComposeRun, runCompose } from "./ComposeProjects";
import type { Finding, Report } from "./lib/doctor";

const POD = "io.kubernetes.pod.name=coredns-1,io.kubernetes.pod.namespace=kube-system";
const rows = [
  { ID: "aaa", Names: "web", Image: "nginx:latest", State: "running", Status: "Up 2 hours", Ports: "", Labels: "" },
  { ID: "bbb", Names: "cache", Image: "redis:7", State: "exited", Status: "Exited (0) 3 hours ago", Ports: "", Labels: "" },
  { ID: "kkk", Names: "k8s_coredns_coredns-1_kube-system_0", Image: "coredns:1.11", State: "running", Status: "Up 1 hour", Ports: "", Labels: POD },
];
// No working_dir label, so the app can't know the Compose file and acts on the containers themselves.
const SHOP = (n: string) => `com.docker.compose.project=shop,com.docker.compose.service=${n}`;
const composeRows = [
  ...rows.slice(0, 2),
  { ID: "s1", Names: "shop-api-1", Image: "shop/api", State: "running", Status: "Up 1 hour", Ports: "", Labels: SHOP("api") },
  { ID: "s2", Names: "shop-db-1", Image: "postgres:16", State: "running", Status: "Up 1 hour", Ports: "", Labels: SHOP("db") },
];
const profile = { name: "default", status: "Running", arch: "aarch64", cpus: 4, memory: 8 * 1024 ** 3, disk: 100 * 1024 ** 3, runtime: "docker" };
const scan = { paths: [], scanning: false, error: null, scan: async () => {}, add: async () => null, pinned: [] };
const problem = (subject: string, extra: Partial<Finding> = {}): Finding =>
  ({ id: "crashed", key: `colima/crashed:${subject}`, area: "containers", severity: "action", level: "bad", subject, title: `${subject} keeps crashing`, short: "It keeps crashing", detail: "Exit code 1.", ...extra }) as Finding;
const reportOf = (findings: Finding[]): Report => {
  const byContainer = new Map<string, Finding[]>();
  for (const f of findings) if (f.subject) byContainer.set(f.subject, [...(byContainer.get(f.subject) ?? []), f]);
  return { findings, byContainer, extra: new Map(), passed: [] };
};

function show({ list = rows, report = null as Report | null, vm = { op: null, failure: null } as VmState } = {}) {
  backend.current = fakeBackend({ ps: () => jsonLines(list), stats: () => "", "system df": () => "", inspect: () => "[]" });
  const onImages = vi.fn();
  const setDetailId = vi.fn();
  const onKubernetes = vi.fn();
  render(
    <ConfirmProvider>
      <Containers profile={profile} ctx="colima" vm={vm} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={setDetailId} onPull={() => {}} onProfiles={() => {}} compose={scan} onImages={onImages} onKubernetes={onKubernetes} report={report} onReport={() => {}} />
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

  it("given a Kubernetes pod, when the list loads, then it is one Kubernetes row that opens its tab and has no Stop or Remove", async () => {
    const user = userEvent.setup();
    const { onKubernetes } = show();
    const row = await rowOf("Kubernetes");
    expect(row).toHaveTextContent("1 container");
    expect(within(row).queryByRole("button", { name: /^(Stop|Start|More actions)/ })).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "Open the Kubernetes tab" }));
    expect(onKubernetes).toHaveBeenCalledOnce();
  });

  it("given rows, when the list loads, then it is alphabetical with Kubernetes last and has no checkboxes", async () => {
    show();
    await rowOf("web");
    const names = [...document.querySelectorAll(".app-name")].map((b) => b.textContent);
    expect(names).toEqual(["cache", "web", "Kubernetes"]);
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("given a running container, when Remove is confirmed from its menu, then one docker rm removes exactly that container", async () => {
    const user = userEvent.setup();
    show();
    await user.click(within(await menuOf(user, "web")).getByRole("menuitem", { name: "Remove…" }));
    const ask = await screen.findByRole("alertdialog");
    expect(ask).toHaveTextContent("Remove web? It is running and will be stopped first. Its image and volumes stay.");
    await user.click(within(ask).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(backend.current!.dockerCalls()).toContainEqual(["rm", "-f", "aaa"]));
  });

  it("given a cancelled remove, when the dialog closes, then nothing is removed", async () => {
    const user = userEvent.setup();
    show();
    await user.click(within(await menuOf(user, "web")).getByRole("menuitem", { name: "Remove…" }));
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
    // The same button stays focused and says what is happening until docker ps shows it stopped.
    expect(stop).toHaveTextContent("Stopping…");
    expect(stop).toHaveAttribute("aria-disabled", "true");
  });

  it("given Stop was pressed, when docker ps shows the container stopped, then the button reads Start again", async () => {
    const user = userEvent.setup();
    const list = rows.slice(0, 1).map((r) => ({ ...r }));
    backend.current = null;
    show({ list });
    // The list the fake backend answers with is this same array, so changing it is what docker ps says next.
    const stop = await screen.findByRole("button", { name: "Stop web" });
    await user.click(stop);
    expect(stop).toHaveTextContent("Stopping…");
    Object.assign(list[0], { State: "exited", Status: "Exited (0) 1 second ago" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Start web" })).toHaveTextContent("Start"), { timeout: 5000 });
  });

  it("given one service crashed and a job that finished cleanly, when the list loads, then the project reads partly running and its menu starts only the crashed one", async () => {
    const list = [
      ...composeRows.slice(2),
      { ID: "s3", Names: "shop-worker-1", Image: "shop/worker", State: "exited", Status: "Exited (1) 1 minute ago", Ports: "", Labels: SHOP("worker") },
      { ID: "s4", Names: "shop-seed-1", Image: "shop/seed", State: "exited", Status: "Exited (0) 1 hour ago", Ports: "", Labels: SHOP("seed") },
    ];
    const user = userEvent.setup();
    show({ list });
    expect(await screen.findByRole("button", { name: "shop, project, 2 of 3 running" })).toBeInTheDocument();
    // Anything running means the main button stops the project; starting the rest is one step into its menu.
    expect(screen.getByRole("button", { name: "Stop shop" })).toBeInTheDocument();
    // The menu names the one stopped service and starts only it: the seed job already finished and stays done.
    await user.click(within(await menuOf(user, "shop")).getByRole("menuitem", { name: /^Start worker/ }));
    await waitFor(() => expect(backend.current!.dockerCalls()).toContainEqual(["start", "s3"]));
  });

  // Two projects with a known Compose file: their Start runs `docker compose`, one run at a time.
  const known = (name: string, ID: string) => ({ ID, Names: `${name}-web-1`, Image: "nginx", State: "exited", Status: "Exited (137) 1 minute ago", Ports: "", Labels: `com.docker.compose.project=${name},com.docker.compose.project.working_dir=/Users/me/${name},com.docker.compose.service=web` });
  const composeScan = { ...scan, paths: ["/Users/me/alpha/compose.yaml", "/Users/me/beta/compose.yaml"] };

  it("given one Compose run in progress, when a second is asked for, then it reports that nothing ran", async () => {
    backend.current = fakeBackend({ compose_action: () => new Promise<string>(() => {}) });
    void runCompose("colima", { dir: "/Users/me/alpha", files: ["compose.yaml"], name: "alpha" }, "up", []);
    expect(await runCompose("colima", { dir: "/Users/me/beta", files: ["compose.yaml"], name: "beta" }, "up", [])).toBe(false);
    expect(backend.current.calls.filter((c) => c.cmd === "compose_action")).toHaveLength(1);
  });

  it("given a project with a known Compose file, when Start is pressed, then it runs compose up in that folder", async () => {
    const user = userEvent.setup();
    backend.current = fakeBackend({ ps: () => jsonLines([known("alpha", "a1")]), inspect: () => "[]", compose_action: () => "" });
    render(<ConfirmProvider><Containers profile={profile} ctx="colima" vm={{ op: null, failure: null }} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={() => {}} onPull={() => {}} onProfiles={() => {}} compose={composeScan} onImages={() => {}} report={null} onReport={() => {}} /></ConfirmProvider>);
    await user.click(await screen.findByRole("button", { name: "Start alpha" }));
    await waitFor(() => expect(backend.current!.invoke).toHaveBeenCalledWith("compose_action", { context: "colima", file: "/Users/me/alpha/compose.yaml", action: "up" }));
    expect(backend.current!.dockerCalls().some((a) => a[0] === "start")).toBe(false);
  });

  it("given one project starting, when another project's Start is clicked, then nothing runs for it and it never claims to be starting", async () => {
    const user = userEvent.setup();
    // The first run never ends, so it holds the one Compose lock for the whole test.
    backend.current = fakeBackend({ ps: () => jsonLines([known("alpha", "a1"), known("beta", "b1")]), inspect: () => "[]", compose_action: () => new Promise<string>(() => {}) });
    render(<ConfirmProvider><Containers profile={profile} ctx="colima" vm={{ op: null, failure: null }} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={() => {}} onPull={() => {}} onProfiles={() => {}} compose={composeScan} onImages={() => {}} report={null} onReport={() => {}} /></ConfirmProvider>);
    await user.click(await screen.findByRole("button", { name: "Start alpha" }));
    const beta = screen.getByRole("button", { name: "Start beta" });
    await user.click(beta);
    expect(backend.current!.calls.filter((c) => c.cmd === "compose_action")).toHaveLength(1);
    expect(beta).toHaveTextContent("Start");
    expect(beta).toHaveAttribute("aria-disabled", "true");
  });

  it("given a problem with no one-click fix, when the list loads, then it shows once under its row with See why, which opens the container", async () => {
    const user = userEvent.setup();
    const { setDetailId } = show({ report: reportOf([problem("web")]) });
    const row = await rowOf("web");
    expect(within(row).getAllByText("It keeps crashing")).toHaveLength(1);
    expect(within(row).queryByRole("button", { name: /^Fix/ })).not.toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "See why: web" }));
    expect(setDetailId).toHaveBeenCalledWith("aaa");
    // No count anywhere on home: the Doctor badge is the only number.
    expect(screen.queryByText(/needs? attention|problems?\b/i)).not.toBeInTheDocument();
  });

  it("given a problem marked not an issue, when chosen from the menu, then it is muted", async () => {
    const user = userEvent.setup();
    show({ report: reportOf([problem("web")]) });
    expect(within(await menuOf(user, "web")).getByRole("menuitem", { name: "Not an issue" })).toBeInTheDocument();
  });

  it("given space that could be freed, when the list loads, then home says nothing about it and never asks for disk use", async () => {
    show();
    await rowOf("web");
    expect(screen.queryByRole("button", { name: /Free up space/ })).not.toBeInTheDocument();
    expect(backend.current!.dockerCalls().some((a) => a[0] === "system" || a[0] === "stats")).toBe(false);
  });

  // A Fix renames the container to NAME-old, stops it and starts a new one. A click in the middle breaks that.
  const fixing = (name: string) => startFix([{ name, run: [], connect: [] }], () => new Promise(() => {}), async () => {}, undefined, () => {});

  it("given a fix running on web, when the list loads, then web and web-old cannot be started, stopped, restarted or removed", async () => {
    const user = userEvent.setup();
    const list = [...rows.slice(0, 2), { ID: "old", Names: "web-old", Image: "nginx:latest", State: "exited", Status: "Exited (0) 1 second ago", Ports: "", Labels: "" }];
    show({ list });
    fixing("web");
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop web" })).toHaveAttribute("aria-disabled", "true"));
    expect(screen.getByRole("button", { name: "Start web-old" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Start cache" })).not.toHaveAttribute("aria-disabled");
    const menu = await menuOf(user, "web");
    for (const name of ["Restart", "Remove…"]) expect(within(menu).getByRole("menuitem", { name })).toHaveAttribute("aria-disabled", "true");
    await user.click(within(menu).getByRole("menuitem", { name: "Remove…" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Stop web" }));
    expect(backend.current!.dockerCalls().some((a) => a[0] === "stop" || a[0] === "rm")).toBe(false);
  });

  it("given a running VM, when the list loads, then no VM strip takes space; while the VM starts, it shows", async () => {
    show();
    await rowOf("web");
    expect(screen.queryByRole("button", { name: /Stop VM|Restart the default VM/ })).not.toBeInTheDocument();
    expect(document.querySelector(".vm-strip")).toBeNull();
  });

  it("given fewer than 7 rows, when the list loads, then there is no search field", async () => {
    show();
    await rowOf("web");
    expect(screen.queryByRole("textbox", { name: "Search containers" })).not.toBeInTheDocument();
  });
});

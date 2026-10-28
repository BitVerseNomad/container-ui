import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend, jsonLines } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import Containers from "./Containers";
import { ConfirmProvider } from "./ui";
import { reset as resetFixes, startFix } from "./lib/fixStore";

const POD = "io.kubernetes.pod.name=coredns-1,io.kubernetes.pod.namespace=kube-system";
const rows = [
  { ID: "aaa", Names: "web", Image: "nginx:latest", State: "running", Status: "Up 2 hours", Ports: "", Labels: "" },
  { ID: "bbb", Names: "cache", Image: "redis:7", State: "exited", Status: "Exited (0) 3 hours ago", Ports: "", Labels: "" },
  { ID: "kkk", Names: "k8s_coredns_coredns-1_kube-system_0", Image: "coredns:1.11", State: "running", Status: "Up 1 hour", Ports: "", Labels: POD },
];
const SHOP = (n: string) => `com.docker.compose.project=shop,com.docker.compose.service=${n}`;
const composeRows = [
  ...rows.slice(0, 2),
  { ID: "s1", Names: "shop-api-1", Image: "shop/api", State: "running", Status: "Up 1 hour", Ports: "", Labels: SHOP("api") },
  { ID: "s2", Names: "shop-db-1", Image: "postgres:16", State: "running", Status: "Up 1 hour", Ports: "", Labels: SHOP("db") },
];
const df = (reclaimable: string, volumes = "0B") =>
  jsonLines([
    { Type: "Build Cache", TotalCount: "1", Active: "0", Size: reclaimable, Reclaimable: reclaimable },
    { Type: "Local Volumes", TotalCount: "1", Active: "0", Size: volumes, Reclaimable: volumes },
  ]);
const profile = { name: "default", status: "Running", arch: "aarch64", cpus: 4, memory: 8 * 1024 ** 3, disk: 100 * 1024 ** 3, runtime: "docker" };
const scan = { paths: [], scanning: false, error: null, scan: async () => {}, add: async () => null, pinned: [] };

function show(reclaimable = "10MB", list = rows, volumes = "0B") {
  backend.current = fakeBackend({ ps: () => jsonLines(list), stats: () => "", "system df": () => df(reclaimable, volumes), inspect: () => "[]" });
  const onImages = vi.fn();
  render(
    <ConfirmProvider>
      <Containers profile={profile} ctx="colima" vm={{ op: null, failure: null }} onVm={() => {}} reload={() => {}} detailId={null} setDetailId={() => {}} onPull={() => {}} onProfiles={() => {}} compose={scan} onImages={onImages} />
    </ConfirmProvider>,
  );
  return { onImages };
}

describe("Containers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFixes();
  });

  it("given a Kubernetes pod container, when the list loads, then it sits in a folded group and cannot be selected or removed", async () => {
    const user = userEvent.setup();
    show();
    const group = await screen.findByRole("button", { name: /Kubernetes pods/ });
    expect(group).toHaveAttribute("aria-expanded", "false");
    await user.click(group);
    expect(screen.getByText("coredns · coredns-1 · kube-system")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /k8s_|coredns/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Stop|Restart|Remove) k8s_/ })).not.toBeInTheDocument();
  });

  it("given two picked containers, when Remove is confirmed, then one docker rm removes exactly those two", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("checkbox", { name: "Select web" }));
    await user.click(screen.getByRole("checkbox", { name: "Select cache" }));
    const bar = screen.getByRole("region", { name: "Selected containers" });
    expect(bar).toHaveTextContent("2 selected");
    await user.click(within(bar).getByRole("button", { name: /Remove/ }));
    const ask = await screen.findByRole("alertdialog");
    expect(ask).toHaveTextContent(/Stop and remove 2 containers\? web, cache\. 1 of them is running and will be stopped first\. This can't be undone\./);
    await user.click(within(ask).getByRole("button", { name: "Stop and remove" }));
    await waitFor(() => expect(backend.current!.dockerCalls()).toContainEqual(["rm", "-f", "aaa", "bbb"]));
  });

  it("given select all, when picked, then the Kubernetes pod is left out", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("checkbox", { name: "Select all shown containers" }));
    expect(screen.getByRole("region", { name: "Selected containers" })).toHaveTextContent("2 selected");
  });

  it("given a folded Compose group, when select all is ticked, then its hidden containers are not picked", async () => {
    const user = userEvent.setup();
    show("10MB", composeRows);
    await user.click(await screen.findByRole("button", { name: "shop" }));
    await user.click(screen.getByRole("checkbox", { name: "Select all shown containers" }));
    expect(screen.getByRole("region", { name: "Selected containers" })).toHaveTextContent("2 selected");
  });

  it("given a container picked inside a group that is then folded, when acting, then it is left out", async () => {
    const user = userEvent.setup();
    show("10MB", composeRows);
    await user.click(await screen.findByRole("checkbox", { name: "Select shop-api-1" }));
    await user.click(screen.getByRole("checkbox", { name: "Select web" }));
    await user.click(screen.getByRole("button", { name: "shop" }));
    expect(screen.getByRole("region", { name: "Selected containers" })).toHaveTextContent("1 selected");
  });

  it("given some but not all rows picked, when looking at the header box, then it shows as partly ticked", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("checkbox", { name: "Select web" }));
    expect((screen.getByRole("checkbox", { name: "Select all shown containers" }) as HTMLInputElement).indeterminate).toBe(true);
  });

  it("given a cancelled remove, when the dialog closes, then nothing is removed", async () => {
    const user = userEvent.setup();
    show();
    await user.click(await screen.findByRole("checkbox", { name: "Select web" }));
    await user.click(within(screen.getByRole("region", { name: "Selected containers" })).getByRole("button", { name: /Remove/ }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    expect(backend.current!.dockerCalls().some((a) => a[0] === "rm")).toBe(false);
  });

  it("given over 1 GiB that can be freed, when the list loads, then a quiet note links to Images", async () => {
    const user = userEvent.setup();
    const { onImages } = show("3.4GB");
    await user.click(await screen.findByRole("button", { name: "Free up space" }));
    expect(onImages).toHaveBeenCalledOnce();
  });

  it("given lots of unused volumes but little else, when the list loads, then no cleanup note counts the volumes", async () => {
    show("10MB", rows, "5GB");
    await screen.findByRole("checkbox", { name: "Select web" });
    expect(screen.queryByRole("button", { name: "Free up space" })).not.toBeInTheDocument();
  });

  it("given little to free, when the list loads, then there is no cleanup note", async () => {
    show("10MB");
    await screen.findByRole("checkbox", { name: "Select web" });
    expect(screen.queryByRole("button", { name: "Free up space" })).not.toBeInTheDocument();
  });

  // A Fix renames the container to NAME-old, stops it and starts a new one. A click in the middle breaks that.
  const fixing = (name: string) => startFix([{ name, run: [], connect: [] }], () => new Promise(() => {}), async () => {}, undefined, () => {});

  it("given a fix running on web, when the list loads, then web and web-old cannot be started, stopped, restarted, removed or picked", async () => {
    const list = [...rows.slice(0, 2), { ID: "old", Names: "web-old", Image: "nginx:latest", State: "exited", Status: "Exited (0) 1 second ago", Ports: "", Labels: "" }];
    show("10MB", list);
    fixing("web");
    for (const name of [/^Restart web$/, /^Stop web$/, /^Remove web$/, /^Start web-old$/, /^Remove web-old$/]) expect(await screen.findByRole("button", { name })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Select web" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Select web-old" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Start cache$/ })).toBeEnabled();
  });

  it("given a fix running, when the list loads, then the VM cannot be restarted or stopped until it ends", async () => {
    show();
    fixing("web");
    expect(await screen.findByRole("button", { name: "Restart the default VM" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stop the default VM" })).toBeDisabled();
  });
});

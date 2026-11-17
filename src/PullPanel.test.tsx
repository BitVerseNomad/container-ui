import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fakeBackend, jsonLines } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

import PullPanel from "./PullPanel";

const ctx = "colima";

const hits = jsonLines([
  { Name: "mysql", Description: "MySQL is a fast database.", StarCount: "15000", IsOfficial: "[OK]" },
  { Name: "bitnami/mysql", Description: "Bitnami MySQL chart.", StarCount: "100", IsOfficial: "" },
]);

function show({ answers = {} }: { answers?: Record<string, () => string | undefined> } = {}) {
  backend.current = fakeBackend({ search: () => hits, ...answers });
  const onRun = vi.fn();
  const onPulled = vi.fn();
  const onClose = vi.fn();
  render(<PullPanel ctx={ctx} onClose={onClose} onPulled={onPulled} onRun={onRun} />);
  return { onRun, onPulled, onClose };
}

async function searchFor(term: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Search Docker Hub"), term);
  await user.click(screen.getByRole("button", { name: "Search", exact: true }));
  await screen.findAllByRole("row");
  return user;
}

describe("PullPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Given the sheet opens, When rendered, Then two fields exist: Search Docker Hub and Image to pull", () => {
    show();
    expect(screen.getByRole("dialog", { name: "Pull an image" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search Docker Hub")).toBeInTheDocument();
    expect(screen.getByLabelText("Image to pull")).toBeInTheDocument();
  });

  it("Given a search for mysql, When results arrive, Then the most starred is first and the official one has an Official tag", async () => {
    show();
    await searchFor("mysql");
    const rows = screen.getAllByRole("row");
    expect(within(rows[0]).getByText("mysql")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Official")).toBeInTheDocument();
    expect(screen.getAllByText("Official")).toHaveLength(1);
  });

  it("Given Name sorting, When chosen, Then bitnami/mysql is first", async () => {
    show();
    const user = await searchFor("mysql");
    await user.click(screen.getByRole("button", { name: "Name", exact: true }));
    expect(within(screen.getAllByRole("row")[0]).getByText("bitnami/mysql")).toBeInTheDocument();
  });

  it("Given a result is chosen, When pressed, Then Image to pull holds its name and the Pull button names it", async () => {
    show();
    const user = await searchFor("mysql");
    await user.click(screen.getByRole("row", { name: /bitnami\/mysql/ }));
    expect(screen.getByLabelText("Image to pull")).toHaveValue("bitnami/mysql");
    expect(screen.getByRole("button", { name: "Pull bitnami/mysql" })).toBeInTheDocument();
  });

  it("Given Other registry, When chosen, Then host, path and tag fields show and the tag is latest", async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Other registry", exact: true }));
    expect(screen.getByLabelText("Registry host")).toBeInTheDocument();
    expect(screen.getByLabelText("Image path")).toBeInTheDocument();
    expect(screen.getByLabelText("Tag")).toHaveValue("latest");
    expect(screen.queryByLabelText("Search Docker Hub")).not.toBeInTheDocument();
  });

  it("Given the ECR preset, When chosen, Then the Pull button is disabled and the reason names account and region", async () => {
    show();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Other registry", exact: true }));
    await user.click(screen.getByRole("button", { name: "AWS ECR" }));
    expect(screen.getByText("Replace <account> and <region> with your own.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pull", exact: true })).toBeDisabled();
  });

  it("Given an unauthorized failure for ghcr.io, When the pull fails, Then the sign-in hint and login command show and the raw output is folded", async () => {
    show({
      answers: {
        docker_pull: () => {
          throw 'Head "https://ghcr.io/v2/acme/private/manifests/1": unauthorized';
        },
      },
    });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Other registry", exact: true }));
    await user.type(screen.getByLabelText("Registry host"), "ghcr.io");
    await user.type(screen.getByLabelText("Image path"), "acme/private");
    await user.clear(screen.getByLabelText("Tag"));
    await user.type(screen.getByLabelText("Tag"), "1");
    await user.click(screen.getByRole("button", { name: "Pull ghcr.io/acme/private:1" }));
    expect(await screen.findByText("Sign in to ghcr.io first")).toBeInTheDocument();
    expect(screen.getByText("docker login ghcr.io")).toBeInTheDocument();
    expect(screen.queryByLabelText("Pull output")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show output" }));
    expect(screen.getByLabelText("Pull output")).toBeInTheDocument();
  });

  it("Given a pull finishes, When done, Then Run shows and pressing it calls onRun with the reference", async () => {
    const { onRun } = show({ answers: { docker_pull: () => undefined } });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Other registry", exact: true }));
    await user.type(screen.getByLabelText("Registry host"), "ghcr.io");
    await user.type(screen.getByLabelText("Image path"), "acme/api");
    await user.clear(screen.getByLabelText("Tag"));
    await user.type(screen.getByLabelText("Tag"), "1.4");
    await user.click(screen.getByRole("button", { name: "Pull ghcr.io/acme/api:1.4" }));
    await user.click(await screen.findByRole("button", { name: "Run ghcr.io/acme/api:1.4" }));
    await waitFor(() => expect(onRun).toHaveBeenCalledWith("ghcr.io/acme/api:1.4"));
  });
});

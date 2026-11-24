import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { fakeBackend } from "./test/fakeBackend";

const backend = vi.hoisted(() => ({ current: null as null | ReturnType<typeof import("./test/fakeBackend").fakeBackend> }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: (cmd: string, a: Record<string, unknown>) => backend.current!.invoke(cmd, a) }));

import ConnectionTest from "./ConnectionTest";

describe("ConnectionTest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    backend.current = fakeBackend({ ps: () => '{"Names":"api","State":"running"}' });
  });

  it("Given the connection doctor opens, When it renders, Then Check is an op button and the port is an op field, not raw controls", async () => {
    const { container } = render(<ConnectionTest ctx="colima" onClose={() => undefined} />);
    const check = await screen.findByRole("button", { name: "Check" });
    expect(check).toHaveAttribute("data-op");
    expect(screen.getByLabelText("Port").closest("label")).toHaveClass("field");
    expect(container.querySelectorAll("button:not([data-op]):not([role=combobox]), select")).toHaveLength(0);
  });

  it("Given the From container starts running, When the doctor opens, Then it is chosen by default", async () => {
    render(<ConnectionTest ctx="colima" onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByRole("combobox", { name: "From container" })).toHaveTextContent("api"));
  });
});

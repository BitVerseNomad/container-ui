import { beforeEach, describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ list: [] as [string, Record<string, unknown>][], shell: "sh" }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd: string, a: Record<string, unknown>) => {
    calls.list.push([cmd, a]);
    return cmd === "container_shell" ? calls.shell : undefined;
  },
}));

import { openShell } from "./shell";
import { activity } from "./activity";

describe("openShell", () => {
  beforeEach(() => {
    calls.list = [];
  });

  it("given a container with bash, when a shell is opened, then Terminal opens bash and the log says so", async () => {
    calls.shell = "bash";
    await openShell("colima", "db");
    expect(calls.list.slice(-1)[0]).toEqual(["open_terminal", { kind: "bash", context: "colima", target: "db" }]);
    expect(activity.snapshot().entries[0].cmd).toBe("docker --context colima exec -it db bash");
  });

  it("given a container with only sh, when a shell is opened, then Terminal opens sh", async () => {
    calls.shell = "sh";
    await openShell("colima", "web");
    expect(calls.list.slice(-1)[0]).toEqual(["open_terminal", { kind: "shell", context: "colima", target: "web" }]);
  });

  it("given a minimal image with no shell, when a shell is opened, then a toolbox shell opens next to it and the log shows its command", async () => {
    calls.shell = "none";
    await openShell("colima", "worker");
    expect(calls.list.slice(-1)[0]).toEqual(["open_terminal", { kind: "debug", context: "colima", target: "worker" }]);
    expect(activity.snapshot().entries[0].cmd).toBe("docker --context colima run --rm -it --pid container:worker --network container:worker --cap-add SYS_PTRACE busybox:1.36 sh");
  });
});

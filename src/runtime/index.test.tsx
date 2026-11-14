import { beforeEach, describe, expect, it, vi } from "vitest";
const answers = vi.hoisted(() => ({ ok: new Set<string>(), calls: [] as string[] }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: async (cmd: string) => { answers.calls.push(cmd); if (answers.ok.has(cmd)) return "1.0"; throw "not installed"; } }));
import { RuntimeRegistry } from "./index";
import { ColimaAdapter } from "./colima-adapter";
import { OrbStackAdapter } from "./orbstack-adapter";
import { PodmanAdapter } from "./podman-adapter";
beforeEach(() => { answers.ok.clear(); answers.calls.length = 0; });

describe("RuntimeRegistry.activateFirstAvailable", () => {
  it("Given only colima_version answers, When activateFirstAvailable runs, Then Colima is the active engine", async () => {
    answers.ok.add("colima_version");
    const registry = new RuntimeRegistry();
    registry.register(new ColimaAdapter());
    registry.register(new OrbStackAdapter());
    registry.register(new PodmanAdapter());
    const active = await registry.activateFirstAvailable();
    expect(active?.id).toBe("colima");
    expect(registry.getActiveId()).toBe("colima");
  });

  it("Given no version command answers, When activateFirstAvailable runs, Then it returns null and no engine is active", async () => {
    const registry = new RuntimeRegistry();
    registry.register(new ColimaAdapter());
    registry.register(new OrbStackAdapter());
    registry.register(new PodmanAdapter());
    const active = await registry.activateFirstAvailable();
    expect(active).toBeNull();
    expect(registry.getActiveId()).toBeNull();
  });

  it("Given an engine is already active, When activateFirstAvailable runs, Then it keeps that engine and asks nothing", async () => {
    const registry = new RuntimeRegistry();
    registry.register(new ColimaAdapter());
    registry.register(new OrbStackAdapter());
    registry.register(new PodmanAdapter());
    registry.setActive(new OrbStackAdapter());
    const active = await registry.activateFirstAvailable();
    expect(active?.id).toBe("orbstack");
    expect(answers.calls).toEqual([]);
  });

  it("Given only podman_version answers, When activateFirstAvailable runs, Then it returns null", async () => {
    answers.ok.add("podman_version");
    const registry = new RuntimeRegistry();
    registry.register(new ColimaAdapter());
    registry.register(new OrbStackAdapter());
    registry.register(new PodmanAdapter());
    const active = await registry.activateFirstAvailable();
    expect(active).toBeNull();
    expect(registry.getActiveId()).toBeNull();
  });
});

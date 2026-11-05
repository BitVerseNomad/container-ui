import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const backend = vi.hoisted(() => ({ folder: (_dir: string): Promise<string[]> => Promise.resolve([]), scan: () => Promise.resolve([] as string[]), pick: "/Users/me/new" }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, a: { dir: string }) =>
    cmd === "find_compose_files" ? backend.scan() : cmd === "compose_in_folder" ? backend.folder(a.dir) : cmd === "pick_folder" ? Promise.resolve(backend.pick) : Promise.reject(cmd),
}));

import { useComposeScan } from "./useComposeScan";

const KEY = "colima-ui:compose-folders";
const saved = () => JSON.parse(localStorage.getItem(KEY) ?? "[]");

describe("useComposeScan", () => {
  beforeEach(() => localStorage.clear());

  it("given a saved folder, when its check fails for another reason, then it is kept", async () => {
    localStorage.setItem(KEY, JSON.stringify(["/Users/me/billing"]));
    backend.folder = () => Promise.reject("Cannot connect to the Docker daemon");
    const { result } = renderHook(() => useComposeScan());
    await waitFor(() => expect(result.current.paths).not.toBeNull());
    expect(saved()).toEqual(["/Users/me/billing"]);
  });

  it("given a saved folder, when its compose file is gone, then it is dropped", async () => {
    localStorage.setItem(KEY, JSON.stringify(["/Users/me/billing"]));
    backend.folder = () => Promise.reject("No compose.yaml or docker-compose.yml in billing");
    const { result } = renderHook(() => useComposeScan());
    await waitFor(() => expect(result.current.paths).not.toBeNull());
    expect(saved()).toEqual([]);
  });

  it("given a scan checking a saved folder, when another folder is added meanwhile, then the scan doesn't lose it", async () => {
    localStorage.setItem(KEY, JSON.stringify(["/Users/me/old"]));
    let finish!: () => void;
    backend.scan = () => Promise.resolve(["/Users/me/shop/compose.yaml"]);
    backend.folder = (dir) => (dir === "/Users/me/old" ? new Promise((r) => (finish = () => r([`${dir}/compose.yaml`]))) : Promise.resolve([`${dir}/compose.yaml`]));
    const { result } = renderHook(() => useComposeScan());
    await waitFor(() => expect(finish).toBeDefined());
    await act(async () => void (await result.current.add()));
    await act(async () => finish());
    await waitFor(() => expect(result.current.scanning).toBe(false));
    expect(saved()).toEqual(["/Users/me/old", "/Users/me/new"]);
    expect(result.current.paths).toEqual(["/Users/me/new/compose.yaml", "/Users/me/old/compose.yaml", "/Users/me/shop/compose.yaml"]);
    expect(result.current.pinned).toEqual(expect.arrayContaining(["/Users/me/new/compose.yaml", "/Users/me/old/compose.yaml"]));
  });
});

import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProjectTerminal } from "./useProjectTerminal";
import { projectsApi } from "../../../lib/projectsApi";
import { vi } from "vitest";

// Mock dependencies
vi.mock("../../../lib/projectsApi", () => ({
  projectsApi: {
    execInEnvironment: vi.fn(),
  },
}));

vi.mock("xterm", () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    write: vi.fn(),
    dispose: vi.fn(),
    clear: vi.fn(),
    loadAddon: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-fit", () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
  })),
}));

vi.mock("@xterm/addon-webgl", () => ({
  WebglAddon: vi.fn(),
}));

// Mock container ref
const mockContainer = document.createElement("div");
vi.spyOn(document, "createElement").mockImplementation((tag) => {
  if (tag === "div") return mockContainer;
  return document.createElement(tag);
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("useProjectTerminal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("initializes terminal and returns executeCommand", () => {
    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1" }),
      { wrapper: createWrapper() }
    );

    expect(result.current.containerRef).toBeDefined();
    expect(result.current.terminalRef).toBeDefined();
    expect(result.current.fitAddonRef).toBeDefined();
    expect(typeof result.current.executeCommand).toBe("function");
    expect(typeof result.current.reconnect).toBe("function");
    expect(typeof result.current.clearScrollback).toBe("function");
    expect(Array.isArray(result.current.scrollback)).toBe(true);
  });

  it("executes command and renders stdout/stderr", async () => {
    const mockExecResult = {
      exitCode: 0,
      stdout: "Hello World\n",
      stderr: "",
    };

    (projectsApi.execInEnvironment as vi.Mock).mockResolvedValue(mockExecResult);

    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1" }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.executeCommand("echo hello");
    });

    expect(projectsApi.execInEnvironment).toHaveBeenCalledWith({
      environmentId: "env-1",
      command: ["sh", "-c", "echo hello"],
    });
  });

  it("preserves scrollback across commands", async () => {
    (projectsApi.execInEnvironment as vi.Mock)
      .mockResolvedValueOnce({ exitCode: 0, stdout: "First\n", stderr: "" })
      .mockResolvedValueOnce({ exitCode: 0, stdout: "Second\n", stderr: "" });

    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1" }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.executeCommand("echo first");
    });

    await act(async () => {
      await result.current.executeCommand("echo second");
    });

    expect(result.current.scrollback.length).toBeGreaterThanOrEqual(2);
    expect(result.current.scrollback.some((line) => line.includes("First"))).toBe(true);
    expect(result.current.scrollback.some((line) => line.includes("Second"))).toBe(true);
  });

  it("limits scrollback to MAX_SCROLLBACK_LINES", async () => {
    // Generate more than 1000 lines
    const manyLines = Array.from({ length: 1100 }, (_, i) => `Line ${i}\n`);
    
    (projectsApi.execInEnvironment as vi.Mock).mockImplementation(() =>
      Promise.resolve({
        exitCode: 0,
        stdout: manyLines.join(""),
        stderr: "",
      })
    );

    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1" }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.executeCommand("generate-lines");
    });

    // Scrollback should be limited to 1000 lines
    expect(result.current.scrollback.length).toBeLessThanOrEqual(1000);
  });

  it("clears scrollback", async () => {
    (projectsApi.execInEnvironment as vi.Mock).mockResolvedValue({
      exitCode: 0,
      stdout: "Test\n",
      stderr: "",
    });

    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1" }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      await result.current.executeCommand("echo test");
    });

    expect(result.current.scrollback.length).toBeGreaterThan(0);

    act(() => {
      result.current.clearScrollback();
    });

    expect(result.current.scrollback).toEqual([]);
  });

  it("handles network error and triggers reconnection", async () => {
    const networkError = new Error("Network connection failed");
    (projectsApi.execInEnvironment as vi.Mock).mockRejectedValue(networkError);

    const onDisconnect = vi.fn();
    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1", onDisconnect }),
      { wrapper: createWrapper() }
    );

    await act(async () => {
      try {
        await result.current.executeCommand("echo test");
      } catch (e) {
        // Expected to throw
      }
    });

    expect(onDisconnect).toHaveBeenCalled();
  });

  it("reconnects on network error after retry interval", async () => {
    const networkError = new Error("ECONNREFUSED: Connection refused");
    (projectsApi.execInEnvironment as vi.Mock)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValueOnce({ exitCode: 0, stdout: "Reconnected\n", stderr: "" });

    const onDisconnect = vi.fn();
    const onReconnect = vi.fn();

    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1", onDisconnect, onReconnect }),
      { wrapper: createWrapper() }
    );

    // First command fails
    await act(async () => {
      try {
        await result.current.executeCommand("echo test");
      } catch (e) {
        // Expected
      }
    });

    expect(onDisconnect).toHaveBeenCalled();

    // Advance timers to trigger reconnection
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(() => {
      expect(onReconnect).toHaveBeenCalled();
    });
  });

  it("handles resize via FitAddon", () => {
    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1" }),
      { wrapper: createWrapper() }
    );

    // FitAddon should be available
    expect(result.current.fitAddonRef.current).toBeDefined();
    expect(typeof result.current.fitAddonRef.current?.fit).toBe("function");
  });

  it("returns isConnected state", () => {
    const { result } = renderHook(
      () => useProjectTerminal({ environmentId: "env-1" }),
      { wrapper: createWrapper() }
    );

    // Initially should be connected after initialization
    expect(typeof result.current.isConnected).toBe("boolean");
  });
});
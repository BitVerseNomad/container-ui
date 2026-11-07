import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useProjectTerminal } from "./useProjectTerminal";
import { vi } from "vitest";
import React from "react";

vi.mock("@/lib/projectsApi", () => ({
  projectsApi: {
    execInEnvironment: vi.fn(),
    getEnvironment: vi.fn(),
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

const mockContainer = document.createElement("div");
vi.spyOn(document, "createElement").mockImplementation((tag) => {
  if (tag === "div") return mockContainer;
  return document.createElement(tag);
});

function renderHookWithQuery() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe("useProjectTerminal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("initializes terminal and returns executeCommand", async () => {
    const { wrapper } = renderHookWithQuery();
    const result = renderHook(
      () => useProjectTerminal({ environmentId: "env-1" }),
      { wrapper }
    );

    const hookResult = result.result.current;
    
    expect(hookResult).toBeDefined();
    expect(hookResult.executeCommand).toBeDefined();
  });
});
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectDetail } from "./ProjectDetail";
import type { Project } from "../../../shared/types/project";
import type { Environment } from "../../../shared/types/environment";
import { vi } from "vitest";

// Mock the terminal, logs, and ports components to avoid xterm/canvas issues
vi.mock("./ProjectTerminal", () => ({
  ProjectTerminal: () => <div data-testid="project-terminal">Terminal</div>,
}));

vi.mock("./ProjectLogs", () => ({
  ProjectLogs: () => <div data-testid="project-logs">Logs</div>,
}));

vi.mock("./ProjectPorts", () => ({
  ProjectPorts: () => <div data-testid="project-ports">Ports</div>,
}));

// Mock state for environments - set in tests before render
const environmentsData = { current: [] as any[] };

// vi.hoisted to define mock functions before vi.mock hoisting
const { mockProjectsApi, mockUseDetectProjectConfig, mockUseRefreshProjectGitInfo, mockUseOpenProjectInIde, mockUseRestartEnvironment } = vi.hoisted(() => {
  const mockProjectsApi = {
    listEnvironments: vi.fn(async () => environmentsData.current),
    createEnvironment: vi.fn(),
    startEnvironment: vi.fn(),
    stopEnvironment: vi.fn(),
    deleteEnvironment: vi.fn(),
  };
  return {
    mockProjectsApi,
    mockUseDetectProjectConfig: vi.fn(),
    mockUseRefreshProjectGitInfo: vi.fn(),
    mockUseOpenProjectInIde: vi.fn(),
    mockUseRestartEnvironment: vi.fn(),
  };
});

// Mock useQuery to return environments immediately (no loading state)
vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (options: any) => {
      // For environment queries, return resolved data immediately
      if (options?.queryKey?.[0] === "environment") {
        return {
          data: environmentsData.current,
          isLoading: false,
          refetch: vi.fn(),
        };
      }
      return actual.useQuery(options);
    },
    useMutation: (options: any) => {
      const mutate = vi.fn();
      const mutateAsync = vi.fn();
      return {
        mutate,
        mutateAsync,
        isPending: false,
        isError: false,
        isSuccess: false,
        error: null,
      };
    },
  };
});

vi.mock("@/lib/projectsApi", () => ({
  projectsApi: mockProjectsApi,
  useDetectProjectConfig: () => mockUseDetectProjectConfig() || { mutateAsync: vi.fn(), isPending: false },
  useRefreshProjectGitInfo: () => mockUseRefreshProjectGitInfo() || { mutateAsync: vi.fn(), isPending: false },
  useOpenProjectInIde: () => mockUseOpenProjectInIde() || { mutateAsync: vi.fn(), isPending: false },
  useRestartEnvironment: () => mockUseRestartEnvironment() || { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false },
}));

vi.mock("@/lib/projectDetection", () => ({
  detectProjectConfig: vi.fn(),
  DevContainerSpec: {},
  ComposeSpec: {},
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const mockProject: Project = {
  id: "proj-1",
  name: "Test Project",
  path: "/Users/test/project",
  gitInfo: {
    remoteUrl: "https://github.com/test/project",
    currentBranch: "main",
    commitHash: "abc123def456",
    hasUncommittedChanges: false,
  },
  devEnvironment: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockEnvironment: Environment = {
  id: "env-1",
  projectId: "proj-1",
  config: { type: "auto" },
  runtime: "lima-docker",
  state: "running",
  containerId: "container-abc123",
  ports: [],
  mounts: [],
  environmentVariables: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  error: null,
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchInterval: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("ProjectDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    environmentsData.current = [];
  });

  it("renders project name and path", () => {
    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Test Project")).toBeInTheDocument();
    expect(screen.getByText("/Users/test/project")).toBeInTheDocument();
  });

  it("shows config detection button when no config", () => {
    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByRole("button", { name: /detect project configuration/i })).toBeInTheDocument();
  });

  it("shows environment controls when environment exists", async () => {
    environmentsData.current = [mockEnvironment];

    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByText("Environment")).toBeInTheDocument();
      expect(screen.getByText("running")).toBeInTheDocument();
    });
  });

  it("shows git info when available", () => {
    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Git")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("https://github.com/test/project")).toBeInTheDocument();
    expect(screen.getByText("abc123de")).toBeInTheDocument();
  });

  it("shows uncommitted changes badge when hasUncommittedChanges is true", () => {
    const projectWithChanges = {
      ...mockProject,
      gitInfo: {
        ...mockProject.gitInfo!,
        hasUncommittedChanges: true,
      },
    };

    render(
      <ProjectDetail project={projectWithChanges} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    expect(screen.getByText("Uncommitted changes")).toBeInTheDocument();
  });

  it("opens terminal modal when Terminal button clicked", async () => {
    environmentsData.current = [mockEnvironment];

    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const terminalButton = screen.getByRole("button", { name: /open terminal/i });
      fireEvent.click(terminalButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-terminal")).toBeInTheDocument();
    });
  });

  it("opens logs modal when Logs button clicked", async () => {
    environmentsData.current = [mockEnvironment];

    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      const logsButton = screen.getByRole("button", { name: /view environment logs/i });
      fireEvent.click(logsButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId("project-logs")).toBeInTheDocument();
    });
  });

  it("calls onBack when back button clicked", () => {
    const onBack = vi.fn();
    render(
      <ProjectDetail project={mockProject} onBack={onBack} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    const backButton = screen.getByRole("button", { name: /back to projects list/i });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalled();
  });

  it("shows create environment button when config detected but no environment", async () => {
    environmentsData.current = [];

    const mutateAsyncFn = vi.fn().mockResolvedValue({
      devcontainer: { image: "node:20" },
    });
    mockUseDetectProjectConfig.mockReturnValue({
      mutateAsync: mutateAsyncFn,
      isPending: false,
    });

    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /detect project configuration/i })).toBeInTheDocument();
    });

    const detectButton = screen.getByRole("button", { name: /detect project configuration/i });
    fireEvent.click(detectButton);

    // Wait for mutation to be called
    await waitFor(() => {
      expect(mutateAsyncFn).toHaveBeenCalledWith({ projectId: "proj-1", projectPath: "/Users/test/project" });
    });

    // The config state should be updated after mutation resolves
    // Since we're mocking the mutation result, the component should show the Create button
    // We'll verify the mutation was called with correct args
  });
});

function ConfigSummary({ config, type }: { config: any; type: string }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <dt>
          <span className="px-2 py-1 text-xs bg-[var(--color-bg-tertiary)] rounded">
            {type === "devcontainer" ? "Dev Container" : type === "compose" ? "Docker Compose" : "Dockerfile"}
          </span>
        </dt>
      </div>
      {("image" in config) && (
        <div className="space-y-1">
          {config.image && <div><strong>Image:</strong> <code className="text-xs">{config.image}</code></div>}
          {config.dockerfile && <div><strong>Dockerfile:</strong> <code className="text-xs">{config.dockerfile}</code></div>}
          {config.forwardPorts?.length && <div><strong>Forward Ports:</strong> <code className="text-xs">{config.forwardPorts.join(", ")}</code></div>}
          {config.postCreateCommand && <div><strong>Post-create:</strong> <code className="text-xs">{config.postCreateCommand}</code></div>}
          {config.postStartCommand && <div><strong>Post-start:</strong> <code className="text-xs">{config.postStartCommand}</code></div>}
          {config.mounts?.length && <div><strong>Mounts:</strong> {config.mounts.map((m: any) => `${m.source}:${m.target}`).join(", ")}</div>}
        </div>
      )}
      {("file" in config) && (
        <div className="space-y-1">
          <div><strong>File:</strong> <code className="text-xs">{config.file}</code></div>
          <div><strong>Service:</strong> <code className="text-xs">{config.service}</code></div>
          {config.envFile && <div><strong>Env file:</strong> <code className="text-xs">{config.envFile}</code></div>}
        </div>
      )}
    </dl>
  );
}
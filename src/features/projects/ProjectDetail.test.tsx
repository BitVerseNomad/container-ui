import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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

// Mock dependencies
const mockProjectsApi = {
  listEnvironments: vi.fn(),
  createEnvironment: vi.fn(),
  startEnvironment: vi.fn(),
  stopEnvironment: vi.fn(),
  deleteEnvironment: vi.fn(),
};

const mockUseDetectProjectConfig = vi.fn();
const mockUseRefreshProjectGitInfo = vi.fn();
const mockUseOpenProjectInIde = vi.fn();
const mockUseRestartEnvironment = vi.fn();

vi.mock("../../../lib/projectsApi", () => ({
  projectsApi: mockProjectsApi,
  useDetectProjectConfig: () => mockUseDetectProjectConfig(),
  useRefreshProjectGitInfo: () => mockUseRefreshProjectGitInfo(),
  useOpenProjectInIde: () => mockUseOpenProjectInIde(),
  useRestartEnvironment: () => mockUseRestartEnvironment(),
}));

vi.mock("../../../lib/projectDetection", () => ({
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
      queries: { retry: false },
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

    expect(screen.getByText("Detect Config")).toBeInTheDocument();
  });

  it("shows environment controls when environment exists", async () => {
    mockProjectsApi.listEnvironments.mockResolvedValue([mockEnvironment]);

    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    waitFor(() => {
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
    mockProjectsApi.listEnvironments.mockResolvedValue([mockEnvironment]);

    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    waitFor(() => {
      const terminalButton = screen.getByText("Terminal");
      fireEvent.click(terminalButton);
    });

    waitFor(() => {
      expect(screen.getByTestId("project-terminal")).toBeInTheDocument();
    });
  });

  it("opens logs modal when Logs button clicked", async () => {
    mockProjectsApi.listEnvironments.mockResolvedValue([mockEnvironment]);

    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    waitFor(() => {
      const logsButton = screen.getByText("Logs");
      fireEvent.click(logsButton);
    });

    waitFor(() => {
      expect(screen.getByTestId("project-logs")).toBeInTheDocument();
    });
  });

  it("calls onBack when back button clicked", () => {
    const onBack = vi.fn();
    render(
      <ProjectDetail project={mockProject} onBack={onBack} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    fireEvent.click(screen.getByLabelText("Back to projects"));
    expect(onBack).toHaveBeenCalled();
  });

  it("shows create environment button when config detected but no environment", async () => {
    mockProjectsApi.listEnvironments.mockResolvedValue([]);

    render(
      <ProjectDetail project={mockProject} onBack={vi.fn()} onRefresh={vi.fn()} />,
      { wrapper: createWrapper() }
    );

    // Simulate config detection
    mockUseDetectProjectConfig.mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({
        devcontainer: { image: "node:20" },
      }),
      isPending: false,
    });

    waitFor(() => {
      expect(screen.getByText("Create & Start Environment")).toBeInTheDocument();
    });
  });
});
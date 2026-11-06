import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { projectsApi, useDetectProjectConfig, useRefreshProjectGitInfo, useOpenProjectInIde, useRestartEnvironment } from "@/lib/projectsApi";
import { detectProjectConfig, DevContainerSpec, ComposeSpec } from "@/lib/projectDetection";
import { ProjectTerminal } from "./ProjectTerminal";
import { ProjectLogs } from "./ProjectLogs";
import { ProjectPorts } from "./ProjectPorts";
import { ProjectEnvVars } from "./ProjectEnvVars";
import { Button } from "@/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/Card";
import { Badge } from "@/ui/Badge";
import { Spinner } from "@/ui/Spinner";
import { ProjectDetailSkeleton } from "@/ui/Skeleton";
import { useToast } from "@/ui/components/Toast";
import { Plus, RefreshCw, FolderOpen, Search, ChevronLeft, Stop, RotateCcw, Play, Terminal, ExternalLink, Download, Trash2, ChevronRight, AlertTriangle, Activity, Network, Key, Settings, Shield, GitBranch, Loader2 } from "@/ui/icons";
import { cn } from "@/lib/cn";
import type { Project } from "@/shared/types/project";
import type { Environment } from "@/shared/types/environment";
import type { DetectResult } from "@/shared/types/project";
import type { GitInfo } from "@/shared/types/project";

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onRefresh: () => void;
}

export function ProjectDetail({
  project,
  onBack,
  onRefresh,
}: ProjectDetailProps) {
  const queryClient = useQueryClient();
  const { success, error: toastError, warning, info } = useToast();
  const [config, setConfig] = useState<DevContainerSpec | ComposeSpec | null>(null);
  const [configType, setConfigType] = useState<"devcontainer" | "compose" | "dockerfile" | "auto" | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [envLoading, setEnvLoading] = useState(true);

  // Fetch environment for this project
  const { data: envData, refetch: refetchEnvironment, isLoading: envQueryLoading } = useQuery({
    queryKey: ["environment", project.id],
    queryFn: () => projectsApi.listEnvironments(project.id),
    enabled: !!project.id,
    refetchInterval: 5000,
  });

  // Sync envLoading state
  useEffect(() => {
    setEnvLoading(envQueryLoading);
  }, [envQueryLoading]);

  // Use first environment if exists
  const projectEnvironment = envData?.[0] || null;

  // Sync local environment state with query data
  useEffect(() => {
    if (projectEnvironment && (!environment || environment.id !== projectEnvironment.id)) {
      setEnvironment(projectEnvironment);
    } else if (!projectEnvironment && environment) {
      setEnvironment(null);
      setConfig(null);
      setConfigType(null);
    }
  }, [projectEnvironment, environment]);

  const detectConfigMutation = useDetectProjectConfig();

  const handleDetectConfig = useCallback(async () => {
    setDetecting(true);
    try {
      const result = await detectConfigMutation.mutateAsync({ projectId: project.id, projectPath: project.path });
      if (result.devcontainer) { setConfig(result.devcontainer); setConfigType("devcontainer"); }
      else if (result.compose) { setConfig(result.compose); setConfigType("compose"); }
      else if (result.dockerfile) { setConfigType("dockerfile"); }
      else { setConfigType("auto"); }
      success("Config detected", `Found ${configType === "devcontainer" ? "Dev Container" : configType === "compose" ? "Docker Compose" : "Dockerfile"} configuration.`);
    } catch (err) {
      toastError("Config detection failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDetecting(false);
    }
  }, [project.id, project.path, detectConfigMutation, success, toastError]);

  const createEnv = useMutation({
    mutationFn: (input: { projectId: string; config: import("@/shared/types/environment").DevEnvironmentConfig }) =>
      projectsApi.createEnvironment(input),
    onSuccess: (env) => {
      setEnvironment(env);
      invoke("project_set_environment", { project_id: project.id, environment_id: env.id });
      onRefresh();
      success("Environment created", "Development environment has been created and started.");
    },
    onError: (err) => {
      toastError("Failed to create environment", err instanceof Error ? err.message : "Unknown error");
    },
  });

  const startEnv = useMutation({
    mutationFn: (id: string) => projectsApi.startEnvironment(id),
    onSuccess: () => {
      onRefresh();
      refetchEnvironment();
      success("Environment started", "The development environment is now running.");
    },
    onError: (err) => {
      toastError("Failed to start environment", err instanceof Error ? err.message : "Unknown error");
    },
  });

  const stopEnv = useMutation({
    mutationFn: (id: string) => projectsApi.stopEnvironment(id),
    onSuccess: () => {
      onRefresh();
      refetchEnvironment();
      success("Environment stopped", "The development environment has been stopped.");
    },
    onError: (err) => {
      toastError("Failed to stop environment", err instanceof Error ? err.message : "Unknown error");
    },
  });

  const restartEnv = useRestartEnvironment();
  // Add toast for restart
  const originalRestartMutate = restartEnv.mutate;
  restartEnv.mutate = ((id: string, options?: { onSuccess?: () => void; onError?: (err: Error) => void }) => {
    originalRestartMutate(id, {
      ...options,
      onSuccess: () => {
        onRefresh();
        refetchEnvironment();
        success("Environment restarted", "The development environment has been restarted.");
        options?.onSuccess?.();
      },
      onError: (err) => {
        toastError("Failed to restart environment", err instanceof Error ? err.message : "Unknown error");
        options?.onError?.(err);
      },
    });
  }) as typeof restartEnv.mutate;

  const deleteEnv = useMutation({
    mutationFn: (id: string) => projectsApi.deleteEnvironment(id),
    onSuccess: () => {
      setEnvironment(null);
      onRefresh();
      refetchEnvironment();
      success("Environment deleted", "The development environment has been removed.");
    },
    onError: (err) => {
      toastError("Failed to delete environment", err instanceof Error ? err.message : "Unknown error");
    },
  });

  const refreshGitInfo = useRefreshProjectGitInfo();
  const openInIde = useOpenProjectInIde();

  const handleRefreshGitInfo = useCallback(async () => {
    try {
      const gitInfo = await refreshGitInfo.mutateAsync(project.id);
      queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      success("Git info refreshed", "Repository information has been updated.");
    } catch (err) {
      toastError("Failed to refresh git info", err instanceof Error ? err.message : "Unknown error");
    }
  }, [project.id, refreshGitInfo, queryClient, success, toastError]);

  const handleOpenInIde = useCallback(async () => {
    try {
      await openInIde.mutateAsync(project.path);
      info("Opening in IDE", "Your configured IDE should open the project.");
    } catch (err) {
      toastError("Failed to open in IDE", err instanceof Error ? err.message : "Unknown error");
    }
  }, [project.path, openInIde, info, toastError]);

  const isRunning = environment?.state === "running";

  // Show skeleton while environment is loading
  if (envLoading) {
    return <ProjectDetailSkeleton />;
  }

  return (
    <div className="flex h-full flex-col" role="main" aria-label={`Project: ${project.name}`}>
      <header className="flex items-center justify-between p-4 border-b" role="banner">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          aria-label="Back to projects list"
          className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="text-sm text-[var(--color-fg-tertiary)]">{project.path}</p>
        </div>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-6" role="main">
        {/* Dev Environment Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Dev Environment</span>
              {detecting ? (
                <Spinner size="sm" aria-label="Detecting project configuration" />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDetectConfig}
                  disabled={detecting || !!config}
                  aria-label={!!config ? "Configuration already detected" : "Detect project configuration"}
                >
                  <Search className="h-4 w-4 mr-1" aria-hidden="true" />
                  Detect Config
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {config ? (
              <ConfigSummary config={config} type={configType!} />
            ) : environment ? (
              <p className="text-sm text-[var(--color-fg-tertiary)]">Environment created. Config detection available.</p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-[var(--color-fg-tertiary)]">No configuration detected yet.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDetectConfig}
                  disabled={detecting}
                  className="w-full sm:w-auto"
                >
                  <Search className="h-4 w-4 mr-1" aria-hidden="true" />
                  Detect Config
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Environment Card */}
        {environment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span>Environment</span>
                <Badge
                  variant={isRunning ? "success" : environment.state === "error" ? "danger" : "default"}
                  size="sm"
                  dot
                  aria-label={`Environment state: ${environment.state}`}
                >
                  {environment.state}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Environment actions">
                {isRunning ? (
                  <>
                    <Button
                      onClick={() => stopEnv.mutate(environment.id)}
                      disabled={stopEnv.isPending}
                      aria-label={stopEnv.isPending ? "Stopping environment..." : "Stop environment"}
                    >
                      <Stop className="h-4 w-4 mr-1" aria-hidden="true" />
                      Stop
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => restartEnv.mutate(environment.id)}
                      disabled={restartEnv.isPending}
                      aria-label={restartEnv.isPending ? "Restarting environment..." : "Restart environment"}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" aria-hidden="true" />
                      Restart
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={() => startEnv.mutate(environment.id)}
                    disabled={startEnv.isPending || environment.state === "starting"}
                    aria-label={startEnv.isPending ? "Starting environment..." : environment.state === "starting" ? "Environment is starting" : "Start environment"}
                  >
                    <Play className="h-4 w-4 mr-1" aria-hidden="true" />
                    {environment.state === "starting" ? "Starting..." : "Start"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => setShowTerminal(true)}
                  disabled={!isRunning || loading}
                  aria-label={!isRunning ? "Terminal not available (environment not running)" : loading ? "Terminal loading..." : "Open terminal"}
                >
                  <Terminal className="h-4 w-4 mr-1" aria-hidden="true" />
                  Terminal
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowLogs(true)}
                  disabled={!isRunning || loading}
                  aria-label={!isRunning ? "Logs not available (environment not running)" : "View environment logs"}
                >
                  <ExternalLink className="h-4 w-4 mr-1" aria-hidden="true" />
                  Logs
                </Button>
                <Button
                  variant="outline"
                  onClick={handleOpenInIde}
                  disabled={!isRunning || openInIde.isPending}
                  aria-label={!isRunning ? "Open in IDE not available (environment not running)" : "Open project in IDE"}
                >
                  <Download className="h-4 w-4 mr-1" aria-hidden="true" />
                  Open in IDE
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm("Delete this environment? This action cannot be undone.")) {
                      deleteEnv.mutate(environment.id);
                    }
                  }}
                  disabled={deleteEnv.isPending}
                  aria-label={deleteEnv.isPending ? "Deleting environment..." : "Delete environment"}
                >
                  <Trash2 className="h-4 w-4 mr-1" aria-hidden="true" />
                  Delete
                </Button>
              </div>

              {isRunning && (
                <>
                  <ProjectPorts environmentId={environment.id} />
                  <div className="text-sm text-[var(--color-fg-tertiary)]" aria-label="Container ID">
                    Container: <code>{environment.containerId?.slice(0, 12) || "unknown"}</code>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Injected Credentials Section */}
        {environment && isRunning && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between flex-wrap gap-2">
                <span className="flex items-center gap-2">
                  <Key className="h-4 w-4" aria-hidden="true" />
                  Injected Credentials
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEnvVars(true)}
                  aria-label="Manage environment variables"
                >
                  <Settings className="h-4 w-4 mr-1" aria-hidden="true" />
                  Manage
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center gap-3 text-[var(--color-fg-secondary)]">
                  <dt>
                    <Badge variant="info" size="sm" aria-label="SSH Agent">
                      <Key className="h-3 w-3 mr-1" aria-hidden="true" />
                      SSH Agent
                    </Badge>
                  </dt>
                  <dd>SSH_AUTH_SOCK</dd>
                </div>
                <div className="flex items-center gap-3 text-[var(--color-fg-secondary)]">
                  <dt>
                    <Badge variant="default" size="sm" aria-label="Git User">
                      <GitBranch className="h-3 w-3 mr-1" aria-hidden="true" />
                      Git User
                    </Badge>
                  </dt>
                  <dd>GIT_AUTHOR_NAME, GIT_COMMITTER_NAME</dd>
                </div>
                <div className="flex items-center gap-3 text-[var(--color-fg-secondary)]">
                  <dt>
                    <Badge variant="default" size="sm" aria-label="Git Email">
                      <GitBranch className="h-3 w-3 mr-1" aria-hidden="true" />
                      Git Email
                    </Badge>
                  </dt>
                  <dd>GIT_AUTHOR_EMAIL, GIT_COMMITTER_EMAIL</dd>
                </div>
                <div className="flex items-center gap-3 text-[var(--color-fg-secondary)]">
                  <dt>
                    <Badge variant="warning" size="sm" aria-label="GitHub Token">
                      <Shield className="h-3 w-3 mr-1" aria-hidden="true" />
                      GitHub Token
                    </Badge>
                  </dt>
                  <dd>GH_TOKEN, GITHUB_TOKEN</dd>
                </div>
                <p className="text-xs text-[var(--color-fg-tertiary)] mt-2" role="note">
                  Auto-injected from your host system. Click "Manage" to enable/disable or add custom variables.
                </p>
              </dl>
            </CardContent>
          </Card>
        )}

        {/* Create Environment Card */}
        {!environment && config && (
          <Card>
            <CardContent className="pt-0">
              <Button
                onClick={() => createEnv.mutate({
                  projectId: project.id,
                  config: configType === "devcontainer" ? { type: "devcontainer", devcontainer: config as import("@/shared/types/project").DevContainerSpec }
                    : configType === "compose" ? { type: "compose", compose: config as import("@/shared/types/project").ComposeSpec }
                    : { type: "auto" },
                })}
                disabled={createEnv.isPending}
                className="w-full"
                aria-label={createEnv.isPending ? "Creating environment..." : "Create and start development environment"}
              >
                {createEnv.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" aria-hidden="true" />
                    Creating...
                  </>
                ) : (
                  "Create & Start Environment"
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Git Info Card */}
        {project.gitInfo?.remoteUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 flex-wrap">
                <Activity className="h-4 w-4" aria-hidden="true" />
                Git
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshGitInfo}
                  disabled={refreshGitInfo.isPending}
                  className="ml-auto"
                  aria-label={refreshGitInfo.isPending ? "Refreshing git info..." : "Refresh git information"}
                >
                  <RefreshCw className={cn("h-4 w-4", refreshGitInfo.isPending && "animate-spin")} aria-hidden="true" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-[var(--color-fg-tertiary)]" aria-hidden="true" />
                <div><strong>Branch:</strong> {project.gitInfo?.currentBranch || "N/A"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-[var(--color-fg-tertiary)]" aria-hidden="true" />
                <div><strong>Remote:</strong> {project.gitInfo?.remoteUrl}</div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--color-fg-tertiary)]" aria-hidden="true" />
                <div><strong>Commit:</strong> {project.gitInfo?.commitHash?.slice(0, 8) || "N/A"}</div>
              </div>
              {project.gitInfo?.hasUncommittedChanges && (
                <div className="flex items-center gap-2" role="status" aria-live="polite">
                  <AlertTriangle className="h-4 w-4 text-[var(--color-brand-warning)]" aria-hidden="true" />
                  <Badge variant="warning" size="sm" className="inline">Uncommitted changes</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Modals - rendered in portal via Dialog component */}
      {showTerminal && environment && (
        <ProjectTerminal
          environmentId={environment.id}
          onClose={() => setShowTerminal(false)}
          onReconnectToast={(msg) => warning("Terminal reconnecting", msg)}
        />
      )}
      {showLogs && environment && (
        <ProjectLogs
          environmentId={environment.id}
          onClose={() => setShowLogs(false)}
        />
      )}
      {showEnvVars && environment && (
        <ProjectEnvVars
          environmentId={environment.id}
          isOpen={showEnvVars}
          onClose={() => setShowEnvVars(false)}
        />
      )}
    </div>
  );
}

function ConfigSummary({ config, type }: { config: DevContainerSpec | ComposeSpec; type: string }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <dt>
          <Badge variant="outline" aria-label={type === "devcontainer" ? "Dev Container" : type === "compose" ? "Docker Compose" : "Dockerfile"}>
            {type === "devcontainer" ? "Dev Container" : type === "compose" ? "Docker Compose" : "Dockerfile"}
          </Badge>
        </dt>
      </div>
      {("image" in config) && (
        <div className="space-y-1">
          {config.image && <div><strong>Image:</strong> <code className="text-xs">{config.image}</code></div>}
          {config.dockerfile && <div><strong>Dockerfile:</strong> <code className="text-xs">{config.dockerfile}</code></div>}
          {config.forwardPorts?.length && <div><strong>Forward Ports:</strong> <code className="text-xs">{config.forwardPorts.join(", ")}</code></div>}
          {config.postCreateCommand && <div><strong>Post-create:</strong> <code className="text-xs">{config.postCreateCommand}</code></div>}
          {config.postStartCommand && <div><strong>Post-start:</strong> <code className="text-xs">{config.postStartCommand}</code></div>}
          {config.mounts?.length && <div><strong>Mounts:</strong> {config.mounts.map((m) => `${m.source}:${m.target}`).join(", ")}</div>}
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
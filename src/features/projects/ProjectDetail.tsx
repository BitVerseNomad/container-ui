import { useState, useEffect } from "react";
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
import { Plus, RefreshCw, FolderOpen, Search, ChevronLeft, Stop, RotateCcw, Play, Terminal, ExternalLink, Download, Trash2, ChevronRight, AlertTriangle, Activity, Network, Key, Settings, Shield, GitBranch } from "@/ui/icons";
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
  const [config, setConfig] = useState<DevContainerSpec | ComposeSpec | null>(null);
  const [configType, setConfigType] = useState<"devcontainer" | "compose" | "dockerfile" | "auto" | null>(null);
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [detecting, setDetecting] = useState(false);

  // Fetch environment for this project
  const { data: envData, refetch: refetchEnvironment } = useQuery({
    queryKey: ["environment", project.id],
    queryFn: () => projectsApi.listEnvironments(project.id),
    enabled: !!project.id,
    refetchInterval: 5000,
  });

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

  const handleDetectConfig = async () => {
    setDetecting(true);
    try {
      const result = await detectConfigMutation.mutateAsync({ projectId: project.id, projectPath: project.path });
      if (result.devcontainer) { setConfig(result.devcontainer); setConfigType("devcontainer"); }
      else if (result.compose) { setConfig(result.compose); setConfigType("compose"); }
      else if (result.dockerfile) { setConfigType("dockerfile"); }
      else { setConfigType("auto"); }
    } finally {
      setDetecting(false);
    }
  };

  const createEnv = useMutation({
    mutationFn: (input: { projectId: string; config: import("@/shared/types/environment").DevEnvironmentConfig }) =>
      projectsApi.createEnvironment(input),
    onSuccess: (env) => {
      setEnvironment(env);
      invoke("project_set_environment", { project_id: project.id, environment_id: env.id });
      onRefresh();
    },
  });

  const startEnv = useMutation({
    mutationFn: (id: string) => projectsApi.startEnvironment(id),
    onSuccess: () => {
      onRefresh();
      refetchEnvironment();
    },
  });

  const stopEnv = useMutation({
    mutationFn: (id: string) => projectsApi.stopEnvironment(id),
    onSuccess: () => {
      onRefresh();
      refetchEnvironment();
    },
  });

  const restartEnv = useRestartEnvironment();

  const deleteEnv = useMutation({
    mutationFn: (id: string) => projectsApi.deleteEnvironment(id),
    onSuccess: () => {
      setEnvironment(null);
      onRefresh();
      refetchEnvironment();
    },
  });

  const refreshGitInfo = useRefreshProjectGitInfo();
  const openInIde = useOpenProjectInIde();

  const handleRefreshGitInfo = async () => {
    try {
      const gitInfo = await refreshGitInfo.mutateAsync(project.id);
      queryClient.invalidateQueries({ queryKey: ["projects", project.id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    } catch (error) {
      console.error("Failed to refresh git info:", error);
    }
  };

  const handleOpenInIde = async () => {
    try {
      await openInIde.mutateAsync(project.path);
    } catch (error) {
      console.error("Failed to open in IDE:", error);
    }
  };

  const isRunning = environment?.state === "running";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to projects">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-semibold">{project.name}</h1>
          <p className="text-sm text-[var(--color-fg-tertiary)]">{project.path}</p>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Dev Environment
              {detecting ? <Spinner size="sm" /> : (
                <Button variant="outline" size="sm" onClick={handleDetectConfig} disabled={detecting || !!config}>
                  <Search className="h-4 w-4 mr-1" /> Detect Config
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
              <p className="text-sm text-[var(--color-fg-tertiary)]">No configuration detected yet. Click "Detect Config" to scan the project.</p>
            )}
          </CardContent>
        </Card>

        {environment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Environment
                <Badge variant={isRunning ? "success" : environment.state === "error" ? "danger" : "default"} size="sm" dot>
                  {environment.state}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {isRunning ? (
                  <>
                    <Button onClick={() => stopEnv.mutate(environment.id)} disabled={stopEnv.isPending}>
                      <Stop className="h-4 w-4 mr-1" /> Stop
                    </Button>
                    <Button variant="outline" onClick={() => restartEnv.mutate(environment.id)} disabled={restartEnv.isPending}>
                      <RotateCcw className="h-4 w-4 mr-1" /> Restart
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => startEnv.mutate(environment.id)} disabled={startEnv.isPending || environment.state === "starting"}>
                    <Play className="h-4 w-4 mr-1" /> Start
                  </Button>
                )}
                <Button variant="outline" onClick={() => setShowTerminal(true)} disabled={!isRunning || loading}>
                  <Terminal className="h-4 w-4 mr-1" /> Terminal
                </Button>
                <Button variant="outline" onClick={() => setShowLogs(true)} disabled={!isRunning || loading}>
                  <ExternalLink className="h-4 w-4 mr-1" /> Logs
                </Button>
                <Button variant="outline" onClick={handleOpenInIde} disabled={!isRunning || openInIde.isPending}>
                  <Download className="h-4 w-4 mr-1" /> Open in IDE
                </Button>
                <Button variant="danger" onClick={() => deleteEnv.mutate(environment.id)} disabled={deleteEnv.isPending}>
                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                </Button>
              </div>

              {isRunning && (
                <>
                  <ProjectPorts environmentId={environment.id} />
                  <div className="text-sm text-[var(--color-fg-tertiary)]">
                    Container: <code>{environment.containerId?.slice(0, 12)}</code>
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
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Key className="h-4 w-4" />
                  Injected Credentials
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowEnvVars(true)}>
                  <Settings className="h-4 w-4 mr-1" />
                  Manage
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 text-[var(--color-fg-secondary)]">
                  <Badge variant="info" size="sm"><Key className="h-3 w-3 mr-1" />SSH Agent</Badge>
                  <span>SSH_AUTH_SOCK</span>
                </div>
                <div className="flex items-center gap-3 text-[var(--color-fg-secondary)]">
                  <Badge variant="default" size="sm"><GitBranch className="h-3 w-3 mr-1" />Git User</Badge>
                  <span>GIT_AUTHOR_NAME, GIT_COMMITTER_NAME</span>
                </div>
                <div className="flex items-center gap-3 text-[var(--color-fg-secondary)]">
                  <Badge variant="default" size="sm"><GitBranch className="h-3 w-3 mr-1" />Git Email</Badge>
                  <span>GIT_AUTHOR_EMAIL, GIT_COMMITTER_EMAIL</span>
                </div>
                <div className="flex items-center gap-3 text-[var(--color-fg-secondary)]">
                  <Badge variant="warning" size="sm"><Shield className="h-3 w-3 mr-1" />GitHub Token</Badge>
                  <span>GH_TOKEN, GITHUB_TOKEN</span>
                </div>
                <p className="text-xs text-[var(--color-fg-tertiary)] mt-2">
                  Auto-injected from your host system. Click "Manage" to enable/disable or add custom variables.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {!environment && config && (
          <Card>
            <CardContent className="pt-0">
              <Button onClick={() => createEnv.mutate({
                projectId: project.id,
                config: configType === "devcontainer" ? { type: "devcontainer", devcontainer: config as import("@/shared/types/project").DevContainerSpec }
                  : configType === "compose" ? { type: "compose", compose: config as import("@/shared/types/project").ComposeSpec }
                  : { type: "auto" },
              })} disabled={createEnv.isPending} className="w-full">
                {createEnv.isPending ? "Creating..." : "Create & Start Environment"}
              </Button>
            </CardContent>
          </Card>
        )}

        {project.gitInfo?.remoteUrl && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4" /> Git
                <Button variant="ghost" size="icon" onClick={handleRefreshGitInfo} disabled={refreshGitInfo.isPending} className="ml-auto">
                  <RefreshCw className={cn("h-4 w-4", refreshGitInfo.isPending && "animate-spin")} />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <ChevronRight className="h-4 w-4 text-[var(--color-fg-tertiary)]" />
                <div><strong>Branch:</strong> {project.gitInfo?.currentBranch || "N/A"}</div>
              </div>
              <div className="flex items-center gap-2">
                <Network className="h-4 w-4 text-[var(--color-fg-tertiary)]" />
                <div><strong>Remote:</strong> {project.gitInfo?.remoteUrl}</div>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-[var(--color-fg-tertiary)]" />
                <div><strong>Commit:</strong> {project.gitInfo?.commitHash?.slice(0, 8) || "N/A"}</div>
              </div>
              {project.gitInfo?.hasUncommittedChanges && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[var(--color-brand-warning)]" />
                  <Badge variant="warning" size="sm" className="inline">Uncommitted changes</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {showTerminal && environment && (
        <ProjectTerminal environmentId={environment.id} onClose={() => setShowTerminal(false)} />
      )}
      {showLogs && environment && (
        <ProjectLogs environmentId={environment.id} onClose={() => setShowLogs(false)} />
      )}
      {showEnvVars && environment && (
        <ProjectEnvVars environmentId={environment.id} isOpen={showEnvVars} onClose={() => setShowEnvVars(false)} />
      )}
    </div>
  );
}

function ConfigSummary({ config, type }: { config: DevContainerSpec | ComposeSpec; type: string }) {
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{type === "devcontainer" ? "Dev Container" : type === "compose" ? "Docker Compose" : "Dockerfile"}</Badge>
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
    </div>
  );
}
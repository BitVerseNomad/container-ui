import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Project,
  CreateProjectInput,
  DetectResult,
} from "@/shared/types/project";
import type {
  Environment,
  CreateEnvironmentInput,
  ExecInput,
  ExecResult,
  LogLine,
  PortMapping,
  ForwardPortInput,
} from "@/shared/types/environment";
import type { GitInfo } from "@/shared/types/project";

export type { ExecResult };

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    throw error;
  }
}

export const projectsApi = {
  list: () => tauriInvoke<Project[]>("project_list_cmd"),
  get: (id: string) => tauriInvoke<Project | null>("project_get_cmd", { id }),
  create: (input: CreateProjectInput) => tauriInvoke<Project>("project_create_cmd", { input }),
  delete: (id: string) => tauriInvoke<void>("project_delete_cmd", { id }),
  detectConfig: (id: string, projectPath: string) => tauriInvoke<DetectResult>("project_detect_config", { project_id: id, project_path: projectPath }),
  openInIde: (projectPath: string) => tauriInvoke<void>("project_open_in_ide", { project_path: projectPath }),
  refreshGitInfo: (id: string) => tauriInvoke<GitInfo>("project_refresh_git_info_cmd", { project_id: id }),

  listEnvironments: (projectId?: string) =>
    tauriInvoke<Environment[]>("environment_list_cmd", { project_id: projectId }),
  getEnvironment: (id: string) => tauriInvoke<Environment | null>("environment_get_cmd", { id }),
  createEnvironment: (input: CreateEnvironmentInput) =>
    tauriInvoke<Environment>("environment_create_cmd", { input }),
  deleteEnvironment: (id: string) => tauriInvoke<void>("environment_delete_cmd", { id }),

  startEnvironment: (id: string) => tauriInvoke<void>("project_env_start", { env_id: id }),
  stopEnvironment: (id: string) => tauriInvoke<void>("project_env_stop", { env_id: id }),
  restartEnvironment: (id: string) => tauriInvoke<void>("project_env_restart", { env_id: id }),

  execInEnvironment: (input: { environmentId: string; command: string[] }) =>
    tauriInvoke<ExecResult>("project_env_exec", { input }),

  forwardPort: (environmentId: string, containerPort: number) =>
    tauriInvoke<PortMapping>("project_env_forward_port", { env_id: environmentId, container_port: containerPort }),
  unforwardPort: (environmentId: string, containerPort: number) =>
    tauriInvoke<void>("project_env_unforward_port", { env_id: environmentId, container_port: containerPort }),

  listEnvironmentPorts: (environmentId: string) =>
    tauriInvoke<PortMapping[]>("project_env_list_ports", { env_id: environmentId }),

  subscribeLogs: (environmentId: string, onLog: (log: LogLine) => void) => {
    return listen<LogLine>(`project-env-logs-${environmentId}`, (e) => onLog(e.payload));
  },
};

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
    refetchInterval: 5000,
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useRefreshProjectGitInfo() {
  return useMutation({
    mutationFn: (id: string) => projectsApi.refreshGitInfo(id),
  });
}

export function useOpenProjectInIde() {
  return useMutation({
    mutationFn: (projectPath: string) => projectsApi.openInIde(projectPath),
  });
}

export function useDetectProjectConfig() {
  return useMutation({
    mutationFn: ({ projectId, projectPath }: { projectId: string; projectPath: string }) =>
      projectsApi.detectConfig(projectId, projectPath),
  });
}

export function useEnvironments(projectId?: string) {
  return useQuery({
    queryKey: ["environments", projectId],
    queryFn: () => projectsApi.listEnvironments(projectId),
    refetchInterval: 5000,
  });
}

export function useEnvironment(id: string | null) {
  return useQuery({
    queryKey: ["environments", id],
    queryFn: () => projectsApi.getEnvironment(id!),
    enabled: !!id,
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.createEnvironment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useStartEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.startEnvironment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useStopEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.stopEnvironment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useRestartEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.restartEnvironment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: projectsApi.deleteEnvironment,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useExecInEnvironment() {
  return useMutation({
    mutationFn: projectsApi.execInEnvironment,
  });
}

export function useForwardPort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ environmentId, containerPort }: { environmentId: string; containerPort: number }) =>
      projectsApi.forwardPort(environmentId, containerPort),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-ports"] }),
  });
}

export function useUnforwardPort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ environmentId, containerPort }: { environmentId: string; containerPort: number }) =>
      projectsApi.unforwardPort(environmentId, containerPort),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-ports"] }),
  });
}

export function useEnvironmentLogs(environmentId: string | null, onLog: (log: import("@/shared/types/environment").LogLine) => void) {
  return useMutation({
    mutationFn: async (id: string) => {
      const unlisten = await listen<import("@/shared/types/environment").LogLine>(`project-env-logs-${id}`, (e) => onLog(e.payload));
      return unlisten;
    },
  });
}
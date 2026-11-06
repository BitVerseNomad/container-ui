export type EnvironmentId = string;

export type DevEnvironmentConfig =
  | { type: "devcontainer"; devcontainer: import("@/shared/types/project").DevContainerSpec }
  | { type: "compose"; compose: import("@/shared/types/project").ComposeSpec }
  | { type: "auto" };

export interface CreateEnvironmentInput {
  projectId: string;
  config: DevEnvironmentConfig;
  runtime?: "docker" | "lima" | "lima-docker";
}

export interface Environment {
  id: EnvironmentId;
  projectId: string;
  config: DevEnvironmentConfig;
  runtime: "docker" | "lima" | "lima-docker";
  state: import("@/shared/types/project").EnvironmentState;
  containerId: string | null;
  ports: import("@/shared/types/project").PortMapping[];
  mounts: Mount[];
  environmentVariables: EnvVar[];
  createdAt: string;
  updatedAt: string;
  error: string | null;
}

export interface Mount {
  source: string;
  target: string;
  type: "bind" | "volume" | "tmpfs";
  readonly: boolean;
}

export interface EnvVar {
  key: string;
  value: string;
  source: "config" | "dotenv" | "system" | "injected";
}

export interface ExecInput {
  environmentId: string;
  command: string[];
  workdir?: string;
  env?: Record<string, string>;
}

export interface ExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface LogLine {
  timestamp: string;
  stream: "stdout" | "stderr" | "system";
  content: string;
}

export interface ForwardPortInput {
  environmentId: string;
  containerPort: number;
  protocol: "tcp" | "udp";
}

export type PortMapping = import("@/shared/types/project").PortMapping;

export interface InjectedEnvVar {
  key: string;
  source: "ssh_agent" | "git_user" | "git_email" | "gh_token" | "custom";
  enabled: boolean;
  value?: string; // For custom
}
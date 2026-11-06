export type ProjectId = string;

export interface GitInfo {
  remoteUrl: string | null;
  currentBranch: string | null;
  commitHash: string | null;
  hasUncommittedChanges: boolean;
}

export interface EnvironmentSummary {
  id: string;
  state: EnvironmentState;
  runtime: RuntimeType;
  ports: PortMapping[];
}

export type EnvironmentState = "stopped" | "starting" | "running" | "error" | "removing";
export type RuntimeType = "docker" | "lima" | "lima-docker";

export interface PortMapping {
  containerPort: number;
  hostPort: number | null;
  protocol: "tcp" | "udp";
  isForwarded: boolean;
}

export interface Project {
  id: ProjectId;
  name: string;
  path: string;
  gitInfo: GitInfo | null;
  devEnvironment: EnvironmentSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectInput {
  path: string;
  name?: string;
}

export type ConfigType = "devcontainer" | "compose" | "dockerfile" | "auto";

export interface DevContainerSpec {
  image?: string;
  dockerfile?: string;
  build?: BuildSpec;
  runArgs?: string[];
  containerEnv?: Record<string, string>;
  remoteEnv?: Record<string, string>;
  mounts?: MountSpec[];
  ports?: number[];
  forwardPorts?: number[];
  postCreateCommand?: string;
  postStartCommand?: string;
  customizations?: Record<string, unknown>;
}

export interface BuildSpec {
  context: string;
  dockerfile: string;
  args?: Record<string, string>;
}

export interface MountSpec {
  source: string;
  target: string;
  type: "bind" | "volume" | "tmpfs";
  readonly: boolean;
}

export interface ComposeSpec {
  file: string;
  service: string;
  envFile?: string;
}

export interface DetectResult {
  configType: ConfigType;
  devcontainer?: DevContainerSpec;
  compose?: ComposeSpec;
  dockerfile?: string;
  language?: string;
}
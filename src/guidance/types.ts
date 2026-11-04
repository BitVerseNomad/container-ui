export interface Problem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  fixable: boolean;
  fixAction?: FixAction;
  context?: Record<string, unknown>;
}

export interface FixAction {
  type: 'docker' | 'connect' | 'recreate' | 'command' | 'navigate';
  label: string;
  args?: string[];
  dockerContext?: string;
  containerName?: string;
  targetPage?: string;
  confirmation?: string;
}

export interface DiagnosticsData {
  containers: ContainerInfo[];
  networks: NetworkInfo[];
  images: ImageInfo[];
  volumes: VolumeInfo[];
  vm: VMInfo;
  host: HostInfo;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  health?: string;
  ports: PortMapping[];
  mounts: MountInfo[];
  networks: string[];
  labels: Record<string, string>;
  restartCount: number;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
}

export interface PortMapping {
  hostPort: number;
  containerPort: number;
  protocol: string;
  hostIp?: string;
}

export interface MountInfo {
  source: string;
  destination: string;
  type: string;
  readOnly: boolean;
}

export interface NetworkInfo {
  name: string;
  driver: string;
  containers: NetworkContainer[];
}

export interface NetworkContainer {
  name: string;
  ip: string;
}

export interface ImageInfo {
  id: string;
  tags: string[];
  size: number;
  created: string;
}

export interface VolumeInfo {
  name: string;
  driver: string;
  size: number;
  containers: string[];
}

export interface VMInfo {
  status: string;
  cpus: number;
  memory: number;
  disk: number;
  runtime: string;
}

export interface HostInfo {
  cpus: number;
  memory: number;
  disk: number;
}
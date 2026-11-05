import { InvokeArgs } from "@tauri-apps/api/core";

export interface Profile {
  name: string;
  status: string;
  arch: string;
  cpus: number;
  memory: number;
  disk: number;
  runtime: string;
  address?: string;
}

export interface StartOpts {
  name: string;
  cpus?: number;
  memory?: number;
  disk?: number;
  runtime?: string;
  kubernetes?: boolean;
}

export interface ResourceOpts {
  cpus?: number;
  memory?: number;
  disk?: number;
}

export interface Diagnostics {
  host: {
    cpus: number;
    memory: number;
    disk: number;
  };
  network: {
    interfaces: string[];
  };
  runtime: Record<string, unknown>;
}

export type RuntimeId = 'colima' | 'orbstack' | 'rancher' | 'podman' | 'docker-desktop';

export interface RuntimeAdapter {
  readonly id: RuntimeId;
  readonly name: string;
  readonly icon: string;

  // Detection
  isAvailable(): Promise<boolean>;
  getVersion(): Promise<string>;

  // Profiles/VMs
  listProfiles(): Promise<Profile[]>;
  startProfile(opts: StartOpts): Promise<void>;
  stopProfile(name: string): Promise<void>;
  applyResources(name: string, opts: ResourceOpts): Promise<void>;
  deleteProfile(name: string): Promise<void>;

  // Docker context
  getDockerContext(profileName: string): string;

  // Kubernetes (if supported)
  hasKubernetes(): boolean;
  getKubeContext(profileName: string): string;

  // Diagnostics
  getDiagnostics(): Promise<Diagnostics>;
}

export interface RuntimeInfo {
  adapter: RuntimeAdapter;
  available: boolean;
  version?: string;
  error?: string;
}
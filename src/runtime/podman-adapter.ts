import { RuntimeAdapter, Profile, StartOpts, ResourceOpts, Diagnostics } from "./types";
import { invoke } from "@tauri-apps/api/core";

export class PodmanAdapter implements RuntimeAdapter {
  readonly id = 'podman' as const;
  readonly name = 'Podman Desktop';
  readonly icon = 'podman';

  async isAvailable(): Promise<boolean> {
    try {
      await invoke('podman_version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return invoke('podman_version');
  }

  async listProfiles(): Promise<Profile[]> {
    throw new Error('Not yet implemented');
  }

  async startProfile(_opts: StartOpts): Promise<void> {
    throw new Error('Not yet implemented');
  }

  async stopProfile(_name: string): Promise<void> {
    throw new Error('Not yet implemented');
  }

  async applyResources(_name: string, _opts: ResourceOpts): Promise<void> {
    throw new Error('Not yet implemented');
  }

  async deleteProfile(_name: string): Promise<void> {
    throw new Error('Not yet implemented');
  }

  getDockerContext(_profileName: string): string {
    return 'podman';
  }

  hasKubernetes(): boolean {
    return false;
  }

  getKubeContext(_profileName: string): string {
    return '';
  }

  async getDiagnostics(): Promise<Diagnostics> {
    const host = await invoke('host_resources');
    return {
      host: host as Diagnostics['host'],
      network: { interfaces: [] },
      runtime: {},
    };
  }
}
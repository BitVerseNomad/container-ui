import { RuntimeAdapter, Profile, StartOpts, ResourceOpts, Diagnostics } from "./types";
import { invoke } from "@tauri-apps/api/core";

export class RancherAdapter implements RuntimeAdapter {
  readonly id = 'rancher' as const;
  readonly name = 'Rancher Desktop';
  readonly icon = 'rancher';

  async isAvailable(): Promise<boolean> {
    try {
      await invoke('rdctl_version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return invoke('rdctl_version');
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
    return 'rancher-desktop';
  }

  hasKubernetes(): boolean {
    return true;
  }

  getKubeContext(_profileName: string): string {
    return 'rancher-desktop';
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
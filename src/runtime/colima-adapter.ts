import { RuntimeAdapter, Profile, StartOpts, ResourceOpts, Diagnostics } from "./types";
import { invoke } from "@tauri-apps/api/core";

export class ColimaAdapter implements RuntimeAdapter {
  readonly id = 'colima' as const;
  readonly name = 'Colima';
  readonly icon = 'colima';

  async isAvailable(): Promise<boolean> {
    try {
      await invoke('colima_version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return invoke('colima_version');
  }

  async listProfiles(): Promise<Profile[]> {
    return invoke('list_profiles');
  }

  async startProfile(opts: StartOpts): Promise<void> {
    return invoke('start_profile', { opts });
  }

  async stopProfile(name: string): Promise<void> {
    return invoke('stop_profile', { name });
  }

  async applyResources(name: string, opts: ResourceOpts): Promise<void> {
    return invoke('apply_resources', { name, opts, restart: true });
  }

  async deleteProfile(name: string): Promise<void> {
    return invoke('delete_profile', { name });
  }

  getDockerContext(profileName: string): string {
    return profileName === 'default' ? 'colima' : `colima-${profileName}`;
  }

  hasKubernetes(): boolean {
    return true;
  }

  getKubeContext(profileName: string): string {
    return this.getDockerContext(profileName);
  }

  async getDiagnostics(): Promise<Diagnostics> {
    const [host, network] = await Promise.all([
      invoke('host_resources'),
      invoke('network_facts'),
    ]);
    return {
      host: host as Diagnostics['host'],
      network: network as Diagnostics['network'],
      runtime: {},
    };
  }
}
import { RuntimeAdapter, Profile, StartOpts, ResourceOpts, Diagnostics } from "./types";
import { invoke } from "@tauri-apps/api/core";

export class OrbStackAdapter implements RuntimeAdapter {
  readonly id = 'orbstack' as const;
  readonly name = 'OrbStack';
  readonly icon = 'orbstack';

  async isAvailable(): Promise<boolean> {
    try {
      await invoke('orb_version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return invoke('orb_version');
  }

  async listProfiles(): Promise<Profile[]> {
    return invoke('orb_list_vms');
  }

  async startProfile(opts: StartOpts): Promise<void> {
    return invoke('orb_start_vm', { name: opts.name });
  }

  async stopProfile(name: string): Promise<void> {
    return invoke('orb_stop_vm', { name });
  }

  async applyResources(_name: string, _opts: ResourceOpts): Promise<void> {
    throw new Error('OrbStack VMs have fixed resources; recreate VM to change');
  }

  async deleteProfile(name: string): Promise<void> {
    return invoke('orb_delete_vm', { name });
  }

  getDockerContext(_profileName: string): string {
    return 'orbstack';
  }

  hasKubernetes(): boolean {
    return true;
  }

  getKubeContext(_profileName: string): string {
    return 'orbstack';
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
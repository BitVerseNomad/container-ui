import { RuntimeAdapter, Profile, StartOpts, ResourceOpts, Diagnostics } from "./types";
import { invoke } from "@tauri-apps/api/core";

export class DockerDesktopAdapter implements RuntimeAdapter {
  readonly id = 'docker-desktop' as const;
  readonly name = 'Docker Desktop';
  readonly icon = 'docker-desktop';

  async isAvailable(): Promise<boolean> {
    try {
      await invoke('docker_desktop_version');
      return true;
    } catch {
      return false;
    }
  }

  async getVersion(): Promise<string> {
    return invoke('docker_desktop_version');
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
    return 'desktop-linux';
  }

  hasKubernetes(): boolean {
    return true;
  }

  getKubeContext(_profileName: string): string {
    return 'docker-desktop';
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
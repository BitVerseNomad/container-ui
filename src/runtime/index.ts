import { RuntimeAdapter, RuntimeInfo, RuntimeId } from "./types";
import { ColimaAdapter } from "./colima-adapter";
import { OrbStackAdapter } from "./orbstack-adapter";
import { RancherAdapter } from "./rancher-adapter";
import { PodmanAdapter } from "./podman-adapter";
import { DockerDesktopAdapter } from "./docker-desktop-adapter";

export class RuntimeRegistry {
  private adapters: Map<RuntimeId, RuntimeAdapter> = new Map();
  private activeAdapter: RuntimeAdapter | null = null;

  register(adapter: RuntimeAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: RuntimeId): RuntimeAdapter | undefined {
    return this.adapters.get(id);
  }

  getAll(): RuntimeAdapter[] {
    return Array.from(this.adapters.values());
  }

  async detectAvailable(): Promise<RuntimeInfo[]> {
    const results = await Promise.all(
      this.getAll().map(async (adapter) => {
        try {
          const available = await adapter.isAvailable();
          let version: string | undefined;
          if (available) {
            version = await adapter.getVersion().catch(() => undefined);
          }
          return { adapter, available, version };
        } catch (error) {
          return { adapter, available: false, error: String(error) };
        }
      })
    );
    return results.filter((r) => r.available);
  }

  setActive(adapter: RuntimeAdapter): void {
    this.activeAdapter = adapter;
  }

  getActive(): RuntimeAdapter | null {
    return this.activeAdapter;
  }

  getActiveId(): RuntimeId | null {
    return this.activeAdapter?.id ?? null;
  }
}

export const runtimeRegistry = new RuntimeRegistry();

runtimeRegistry.register(new ColimaAdapter());
runtimeRegistry.register(new OrbStackAdapter());
runtimeRegistry.register(new RancherAdapter());
runtimeRegistry.register(new PodmanAdapter());
runtimeRegistry.register(new DockerDesktopAdapter());
import { DiagnosticsData, Problem, FixAction } from "./types";

export function detectProblems(data: DiagnosticsData): Problem[] {
  const problems: Problem[] = [];

  // VM-level problems
  problems.push(...detectVMProblems(data.vm, data.host));

  // Container-level problems
  for (const container of data.containers) {
    problems.push(...detectContainerProblems(container, data));
  }

  // Network problems
  problems.push(...detectNetworkProblems(data.networks, data.containers));

  // Image problems
  problems.push(...detectImageProblems(data.images));

  // Volume problems
  problems.push(...detectVolumeProblems(data.volumes));

  return problems;
}

function detectVMProblems(vm: DiagnosticsData['vm'], host: DiagnosticsData['host']): Problem[] {
  const problems: Problem[] = [];

  if (vm.status !== 'Running') {
    problems.push({
      id: 'vm-stopped',
      severity: 'critical',
      title: 'VM is stopped',
      description: `The VM "${vm.runtime}" is not running. Containers cannot start.`,
      fixable: true,
      fixAction: {
        type: 'docker',
        label: 'Start VM',
        args: ['start'],
      },
    });
  }

  // Memory pressure
  const memoryUsagePercent = (vm.memory / host.memory) * 100;
  if (memoryUsagePercent > 85) {
    problems.push({
      id: 'vm-memory-pressure',
      severity: 'warning',
      title: 'VM memory pressure',
      description: `VM is using ${memoryUsagePercent.toFixed(0)}% of host memory. Consider increasing VM memory.`,
      fixable: true,
      fixAction: {
        type: 'navigate',
        label: 'Adjust VM Resources',
        targetPage: 'Profiles',
      },
    });
  }

  // Disk pressure
  const diskUsagePercent = (vm.disk / host.disk) * 100;
  if (diskUsagePercent > 90) {
    problems.push({
      id: 'vm-disk-pressure',
      severity: 'warning',
      title: 'VM disk pressure',
      description: `VM disk is ${diskUsagePercent.toFixed(0)}% full. Clean up unused images/volumes.`,
      fixable: true,
      fixAction: {
        type: 'navigate',
        label: 'Clean Up',
        targetPage: 'Images',
      },
    });
  }

  return problems;
}

function detectContainerProblems(
  container: DiagnosticsData['containers'][0],
  data: DiagnosticsData
): Problem[] {
  const problems: Problem[] = [];

  // Health check failing
  if (container.health === 'unhealthy') {
    problems.push({
      id: `container-unhealthy-${container.id}`,
      severity: 'critical',
      title: `Container "${container.name}" is unhealthy`,
      description: 'Health check is failing. Check logs for details.',
      fixable: true,
      fixAction: {
        type: 'recreate',
        label: 'Recreate Container',
        dockerContext: data.vm.runtime,
        containerName: container.name,
        confirmation: 'This will recreate the container with the same settings. Continue?',
      },
    });
  }

  // Restarting too often
  if (container.restartCount > 3) {
    problems.push({
      id: `container-restart-loop-${container.id}`,
      severity: 'critical',
      title: `Container "${container.name}" keeps restarting`,
      description: `Restarted ${container.restartCount} times. Likely a crash loop.`,
      fixable: true,
      fixAction: {
        type: 'recreate',
        label: 'Fix Restart Loop',
        dockerContext: data.vm.runtime,
        containerName: container.name,
        confirmation: 'This will recreate the container with restart policy disabled temporarily. Continue?',
      },
    });
  }

  // OOM killed
  if (container.exitCode === 137 && container.state === 'exited') {
    problems.push({
      id: `container-oom-${container.id}`,
      severity: 'critical',
      title: `Container "${container.name}" ran out of memory`,
      description: 'Container was OOM-killed. Increase memory limit or VM memory.',
      fixable: true,
      fixAction: {
        type: 'recreate',
        label: 'Recreate with More Memory',
        dockerContext: data.vm.runtime,
        containerName: container.name,
        confirmation: 'Recreate with increased memory limit?',
      },
    });
  }

  // Exited with error
  if (container.state === 'exited' && container.exitCode !== 0 && container.exitCode !== 137) {
    problems.push({
      id: `container-exited-error-${container.id}`,
      severity: 'warning',
      title: `Container "${container.name}" exited with error`,
      description: `Exit code ${container.exitCode}. Check logs for details.`,
      fixable: true,
      fixAction: {
        type: 'command',
        label: 'View Logs',
        args: ['logs', container.name],
        dockerContext: data.vm.runtime,
      },
    });
  }

  // Localhost binding problem (container looking for another at localhost)
  const localhostEnvs = ['advertise', 'announce', 'publish', 'broadcast'];
  for (const mount of container.mounts) {
    // Check env vars for localhost references
  }

  return problems;
}

function detectNetworkProblems(
  networks: DiagnosticsData['networks'],
  containers: DiagnosticsData['containers']
): Problem[] {
  const problems: Problem[] = [];

  // Containers using each other's names but on default bridge (no DNS)
  const containerMap = new Map(containers.map(c => [c.name, c]));
  const defaultBridge = networks.find(n => n.name === 'bridge');

  if (defaultBridge) {
    for (const nc of defaultBridge.containers) {
      const container = containerMap.get(nc.name);
      if (container) {
        // Check if container has env vars pointing to other container names
        // This would need runtime inspection - placeholder for now
      }
    }
  }

  return problems;
}

function detectImageProblems(images: DiagnosticsData['images']): Problem[] {
  const problems: Problem[] = [];

  // Images for wrong architecture (would need runtime arch comparison)
  // Placeholder

  return problems;
}

function detectVolumeProblems(volumes: DiagnosticsData['volumes']): Problem[] {
  const problems: Problem[] = [];

  // Anonymous volumes not in use
  for (const vol of volumes) {
    if (vol.containers.length === 0 && !vol.name.match(/^[a-f0-9]{64}$/)) {
      // Named volume not in use
      problems.push({
        id: `volume-unused-${vol.name}`,
        severity: 'info',
        title: `Volume "${vol.name}" is not in use`,
        description: `Size: ${formatBytes(vol.size)}. Can be removed to free space.`,
        fixable: true,
        fixAction: {
          type: 'docker',
          label: 'Remove Volume',
          args: ['volume', 'rm', vol.name],
        },
      });
    }
  }

  return problems;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
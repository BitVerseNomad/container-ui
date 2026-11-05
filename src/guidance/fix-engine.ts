import { Problem, FixAction, DiagnosticsData } from "./types";
import { invoke } from "@tauri-apps/api/core";

export interface FixResult {
  success: boolean;
  message: string;
  details?: string;
}

export async function executeFix(
  problem: Problem,
  dockerContext: string
): Promise<FixResult> {
  const action = problem.fixAction;
  if (!action) {
    return { success: false, message: 'No fix action available' };
  }

  switch (action.type) {
    case 'docker':
      return executeDockerFix(action, dockerContext);
    case 'connect':
      return executeConnectFix(action, dockerContext);
    case 'recreate':
      return executeRecreateFix(action, dockerContext);
    case 'command':
      return executeCommandFix(action, dockerContext);
    case 'navigate':
      return executeNavigateFix(action);
    default:
      return { success: false, message: `Unknown fix type: ${action.type}` };
  }
}

async function executeDockerFix(action: FixAction, ctx: string): Promise<FixResult> {
  try {
    const args = action.args || [];
    await invoke('docker', { context: ctx, args, mergeStderr: false });
    return { success: true, message: `${action.label} completed` };
  } catch (e) {
    return { success: false, message: `Failed: ${e}`, details: String(e) };
  }
}

async function executeConnectFix(action: FixAction, ctx: string): Promise<FixResult> {
  try {
    // Connect containers to a shared network
    const networkName = `fix-net-${Date.now()}`;
    await invoke('docker', { context: ctx, args: ['network', 'create', networkName], mergeStderr: false });
    
    if (action.containerName) {
      await invoke('docker', { context: ctx, args: ['network', 'connect', networkName, action.containerName], mergeStderr: false });
    }
    
    return { success: true, message: `Connected to network ${networkName}` };
  } catch (e) {
    return { success: false, message: `Failed: ${e}`, details: String(e) };
  }
}

async function executeRecreateFix(action: FixAction, ctx: string): Promise<FixResult> {
  try {
    if (!action.containerName) {
      return { success: false, message: 'No container name provided' };
    }

    // Get current container config
    const inspect = await invoke('docker', {
      context: ctx,
      args: ['inspect', action.containerName],
      mergeStderr: false,
    });
    const container = JSON.parse(String(inspect))[0];

    // Build new run command with same settings
    const runArgs = buildRunArgsFromContainer(container, ctx);
    
    // Rename old container
    await invoke('docker', {
      context: ctx,
      args: ['rename', action.containerName, `${action.containerName}-old`],
      mergeStderr: false,
    });

    // Start new container
    await invoke('docker', {
      context: ctx,
      args: ['run', '-d', ...runArgs],
      mergeStderr: false,
    });

    return { success: true, message: `Recreated ${action.containerName}` };
  } catch (e) {
    // Try to restore old container
    if (action.containerName) {
      try {
        await invoke('docker', {
          context: ctx,
          args: ['rename', `${action.containerName}-old`, action.containerName],
          mergeStderr: false,
        });
      } catch {}
    }
    return { success: false, message: `Failed: ${e}`, details: String(e) };
  }
}

function buildRunArgsFromContainer(container: any, ctx: string): string[] {
  const args: string[] = [];

  // Name
  args.push('--name', container.Name.replace(/^\//, ''));

  // Image
  args.push(container.Config.Image);

  // Restart policy
  if (container.HostConfig.RestartPolicy.Name !== 'no') {
    args.push('--restart', container.HostConfig.RestartPolicy.Name);
  }

  // Ports
  if (container.HostConfig.PortBindings) {
    for (const [containerPort, bindings] of Object.entries(container.HostConfig.PortBindings)) {
      for (const binding of bindings as any[]) {
        const hostPort = binding.HostPort;
        const hostIp = binding.HostIp || '127.0.0.1';
        args.push('-p', `${hostIp}:${hostPort}:${containerPort}`);
      }
    }
  }

  // Volumes/Mounts
  if (container.Mounts) {
    for (const mount of container.Mounts) {
      if (mount.Type === 'bind') {
        args.push('-v', `${mount.Source}:${mount.Destination}${mount.RW ? '' : ':ro'}`);
      } else if (mount.Type === 'volume') {
        args.push('-v', `${mount.Name}:${mount.Destination}`);
      }
    }
  }

  // Environment
  if (container.Config.Env) {
    for (const env of container.Config.Env) {
      args.push('-e', env);
    }
  }

  // Network
  if (container.HostConfig.NetworkMode && container.HostConfig.NetworkMode !== 'default') {
    args.push('--network', container.HostConfig.NetworkMode);
  }

  // Labels
  if (container.Config.Labels) {
    for (const [key, value] of Object.entries(container.Config.Labels)) {
      args.push('--label', `${key}=${value}`);
    }
  }

  return args;
}

async function executeCommandFix(action: FixAction, ctx: string): Promise<FixResult> {
  try {
    const args = action.args || [];
    await invoke('docker', { context: ctx, args, mergeStderr: false });
    return { success: true, message: 'Command executed' };
  } catch (e) {
    return { success: false, message: `Failed: ${e}`, details: String(e) };
  }
}

function executeNavigateFix(action: FixAction): FixResult {
  // Navigation is handled by the UI
  return { 
    success: true, 
    message: `Navigate to ${action.targetPage}`,
    details: action.targetPage 
  };
}

export async function runDiagnostics(dockerContext: string): Promise<DiagnosticsData> {
  const parseJsonLines = (out: unknown) => String(out).trim().split('\n').filter(l => l).map((l: string) => JSON.parse(l));

  const [containers, networks, images, volumes, vm, host] = await Promise.all([
    invoke('docker', { context: dockerContext, args: ['ps', '-a', '--format', '{{json .}}'], mergeStderr: false })
      .then(parseJsonLines),
    invoke('docker', { context: dockerContext, args: ['network', 'ls', '--format', '{{json .}}'], mergeStderr: false })
      .then(parseJsonLines),
    invoke('docker', { context: dockerContext, args: ['images', '--format', '{{json .}}'], mergeStderr: false })
      .then(parseJsonLines),
    invoke('docker', { context: dockerContext, args: ['volume', 'ls', '--format', '{{json .}}'], mergeStderr: false })
      .then(parseJsonLines),
    invoke('host_resources'),
    invoke('host_resources'),
  ]);

  // Transform to DiagnosticsData format
  return {
    containers: containers.map(transformContainer),
    networks: networks.map(transformNetwork),
    images: images.map(transformImage),
    volumes: volumes.map(transformVolume),
    vm: vm as DiagnosticsData['vm'],
    host: host as DiagnosticsData['host'],
  };
}

function transformContainer(c: any): DiagnosticsData['containers'][0] {
  return {
    id: c.ID || c.Id,
    name: c.Names || c.Name,
    image: c.Image,
    status: c.Status,
    state: c.State,
    health: c.Health?.Status,
    ports: [],
    mounts: [],
    networks: [],
    labels: c.Labels || {},
    restartCount: parseInt(c.RestartCount || '0'),
    startedAt: c.StartedAt,
    finishedAt: c.FinishedAt,
    exitCode: c.ExitCode,
  };
}

function transformNetwork(n: any): DiagnosticsData['networks'][0] {
  return {
    name: n.Name,
    driver: n.Driver,
    containers: [],
  };
}

function transformImage(i: any): DiagnosticsData['images'][0] {
  return {
    id: i.ID,
    tags: i.Repository ? [i.Repository + ':' + (i.Tag || 'latest')] : [],
    size: parseInt(i.Size || '0'),
    created: i.CreatedSince,
  };
}

function transformVolume(v: any): DiagnosticsData['volumes'][0] {
  return {
    name: v.Name,
    driver: v.Driver,
    size: 0,
    containers: [],
  };
}
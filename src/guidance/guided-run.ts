import { DiagnosticsData, ContainerInfo } from "./types";
import { invoke } from "@tauri-apps/api/core";

export interface RunSuggestion {
  ports: PortSuggestion[];
  volumes: VolumeSuggestion[];
  envVars: EnvSuggestion[];
  network: string;
  warnings: string[];
  command: string;
}

export interface PortSuggestion {
  containerPort: number;
  protocol: string;
  hostPort?: number;
  hostIp: string;
  description: string;
}

export interface VolumeSuggestion {
  containerPath: string;
  type: 'named' | 'bind';
  name?: string;
  hostPath?: string;
  readOnly: boolean;
  description: string;
}

export interface EnvSuggestion {
  key: string;
  value?: string;
  description: string;
  required: boolean;
  secret: boolean;
}

export async function generateRunSuggestions(
  dockerContext: string,
  imageRef: string
): Promise<RunSuggestion> {
  // Inspect the image
  const inspect = await invoke('docker', {
    context: dockerContext,
    args: ['image', 'inspect', imageRef],
    mergeStderr: false,
  });

  const image = JSON.parse(String(inspect))[0];
  const config = image.Config || {};
  const exposedPorts = config.ExposedPorts || {};
  const volumes = config.Volumes || {};
  const env = config.Env || [];
  const labels = config.Labels || {};

  // Generate port suggestions
  const ports: PortSuggestion[] = [];
  for (const [portSpec, _] of Object.entries(exposedPorts)) {
    const [port, protocol] = portSpec.split('/');
    const containerPort = parseInt(port);
    const isWebPort = isWebPortCommon(containerPort);
    
    ports.push({
      containerPort,
      protocol: protocol || 'tcp',
      hostPort: isWebPort ? containerPort : undefined,
      hostIp: '127.0.0.1',
      description: getPortDescription(containerPort, protocol || 'tcp'),
    });
  }

  // Generate volume suggestions
  const volumeSuggestions: VolumeSuggestion[] = [];
  for (const [path, _] of Object.entries(volumes)) {
    const volName = sanitizeVolumeName(path, imageRef);
    volumeSuggestions.push({
      containerPath: path,
      type: 'named',
      name: volName,
      readOnly: false,
      description: `Data at ${path}`,
    });
  }

  // Generate env suggestions
  const envSuggestions: EnvSuggestion[] = [];
  for (const e of env) {
    const [key, value] = e.split('=');
    const isSecret = isSecretKey(key);
    envSuggestions.push({
      key,
      value: isSecret ? undefined : value,
      description: getEnvDescription(key, labels),
      required: isRequiredEnv(key, labels),
      secret: isSecret,
    });
  }

  // Build command
  const command = buildDockerRunCommand(imageRef, ports, volumeSuggestions, envSuggestions);

  // Generate warnings
  const warnings = generateWarnings(imageRef, image);

  return {
    ports,
    volumes: volumeSuggestions,
    envVars: envSuggestions,
    network: 'devnet', // Shared network for inter-container communication
    warnings,
    command,
  };
}

function isWebPortCommon(port: number): boolean {
  const webPorts = [80, 443, 8080, 8443, 3000, 3001, 4000, 5000, 5173, 8000, 8888, 9000, 9090];
  return webPorts.includes(port);
}

function getPortDescription(port: number, protocol: string): string {
  const known: Record<number, string> = {
    22: 'SSH',
    25: 'SMTP',
    53: 'DNS',
    80: 'HTTP',
    110: 'POP3',
    143: 'IMAP',
    443: 'HTTPS',
    465: 'SMTPS',
    587: 'SMTP Submission',
    993: 'IMAPS',
    995: 'POP3S',
    3306: 'MySQL',
    5432: 'PostgreSQL',
    6379: 'Redis',
    8080: 'HTTP Alt',
    8443: 'HTTPS Alt',
    27017: 'MongoDB',
  };
  return known[port] || `${protocol.toUpperCase()} ${port}`;
}

function sanitizeVolumeName(path: string, imageRef: string): string {
  const base = path.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
  const imageName = imageRef.split('/').pop()?.split(':')[0] || 'app';
  return `${imageName}-${base}`.substring(0, 63);
}

function getEnvDescription(key: string, labels: Record<string, string>): string {
  const envLabels: Record<string, string> = {
    'MYSQL_ROOT_PASSWORD': 'Root password for MySQL',
    'MYSQL_PASSWORD': 'Password for MySQL user',
    'MYSQL_USER': 'MySQL username',
    'MYSQL_DATABASE': 'Default database name',
    'POSTGRES_PASSWORD': 'PostgreSQL password',
    'POSTGRES_USER': 'PostgreSQL username',
    'POSTGRES_DB': 'Default database name',
    'REDIS_PASSWORD': 'Redis password',
    'MONGO_INITDB_ROOT_USERNAME': 'MongoDB root username',
    'MONGO_INITDB_ROOT_PASSWORD': 'MongoDB root password',
  };
  return envLabels[key] || labels[`org.opencontainers.image.description`] || 'Environment variable';
}

function isRequiredEnv(key: string, labels: Record<string, string>): boolean {
  const required = [
    'MYSQL_ROOT_PASSWORD',
    'POSTGRES_PASSWORD',
    'MONGO_INITDB_ROOT_PASSWORD',
  ];
  return required.includes(key);
}

function isSecretKey(key: string): boolean {
  const secretPatterns = [
    'PASSWORD', 'SECRET', 'KEY', 'TOKEN', 'PRIVATE', 'CERT', 'PASSPHRASE'
  ];
  return secretPatterns.some(p => key.toUpperCase().includes(p));
}

function buildDockerRunCommand(
  imageRef: string,
  ports: PortSuggestion[],
  volumes: VolumeSuggestion[],
  envVars: EnvSuggestion[]
): string {
  const parts: string[] = ['docker', 'run', '-d'];

  // Name will be added by user
  parts.push('--name', '<container-name>');

  // Network
  parts.push('--network', 'devnet');

  // Ports
  for (const p of ports) {
    if (p.hostPort) {
      parts.push('-p', `${p.hostIp}:${p.hostPort}:${p.containerPort}/${p.protocol}`);
    }
  }

  // Volumes
  for (const v of volumes) {
    if (v.type === 'named' && v.name) {
      parts.push('-v', `${v.name}:${v.containerPath}${v.readOnly ? ':ro' : ''}`);
    }
  }

  // Environment
  for (const e of envVars) {
    if (e.value !== undefined) {
      parts.push('-e', `${e.key}=${e.value}`);
    }
  }

  // Image
  parts.push(imageRef);

  return parts.join(' ');
}

function generateWarnings(imageRef: string, image: any): string[] {
  const warnings: string[] = [];

  // Check if image is for different architecture
  const arch = image.Architecture;
  if (arch && arch !== 'amd64' && arch !== 'arm64') {
    warnings.push(`Image is for ${arch} architecture. May not run on this VM.`);
  }

  // Check for latest tag
  if (imageRef.includes(':latest') || !imageRef.includes(':')) {
    warnings.push('Using "latest" tag - consider pinning to a specific version for reproducibility.');
  }

  // Check for root user
  if (!image.Config.User || image.Config.User === 'root' || image.Config.User === '0') {
    warnings.push('Container runs as root. Consider using a non-root user for security.');
  }

  return warnings;
}

export function validateRunConfig(
  suggestions: RunSuggestion,
  userConfig: {
    name: string;
    ports: PortSuggestion[];
    volumes: VolumeSuggestion[];
    envVars: EnvSuggestion[];
  }
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!userConfig.name.trim()) {
    errors.push('Container name is required');
  }

  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(userConfig.name)) {
    errors.push('Container name can only contain alphanumeric, underscore, dot, and dash');
  }

  // Check for port conflicts (would need runtime check)
  // Check for volume conflicts (would need runtime check)

  return { valid: errors.length === 0, errors };
}
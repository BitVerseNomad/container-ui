// Project configuration auto-detection library
// Scans a project directory for devcontainer.json, docker-compose.yml, Dockerfile, etc.

import { invoke } from "@tauri-apps/api/core";

export type ConfigType = 'devcontainer' | 'compose' | 'dockerfile' | 'auto';

export interface DevContainerSpec {
  image?: string;
  dockerfile?: string;
  build?: { context: string; dockerfile: string; args?: Record<string, string> };
  runArgs?: string[];
  containerEnv?: Record<string, string>;
  remoteEnv?: Record<string, string>;
  mounts?: MountSpec[];
  ports?: number[];
  forwardPorts?: number[];
  postCreateCommand?: string;
  postStartCommand?: string;
  customizations?: Record<string, unknown>;
}

export interface MountSpec {
  source: string;
  target: string;
  type: 'bind' | 'volume' | 'tmpfs';
  readonly: boolean;
}

export interface ComposeSpec {
  file: string;
  service: string;
  envFile?: string;
}

export interface DetectResult {
  configType: ConfigType;
  devcontainer?: DevContainerSpec;
  compose?: ComposeSpec;
  dockerfile?: string;
  language?: string;
}

/**
 * Detect project configuration by scanning the project directory
 * Priority: .devcontainer/devcontainer.json > docker-compose.yml > Dockerfile > language defaults
 */
export async function detectProjectConfig(projectPath: string): Promise<DetectResult> {
  // Use Tauri FS to read directory
  const entries = await invoke<string[]>('fs_read_dir', { path: projectPath });
  
  // 1. Check .devcontainer/devcontainer.json
  if (entries.includes('.devcontainer')) {
    const devcontainerEntries = await invoke<string[]>('fs_read_dir', { path: `${projectPath}/.devcontainer` });
    if (devcontainerEntries.includes('devcontainer.json')) {
      const content = await invoke<string>('fs_read_text_file', { path: `${projectPath}/.devcontainer/devcontainer.json` });
      const spec = await parseDevContainerJson(content, projectPath);
      
      // Check for referenced docker-compose
      if (devcontainerEntries.some(e => e.endsWith('.yml') || e.endsWith('.yaml'))) {
        return { configType: 'devcontainer', devcontainer: spec };
      }
      return { configType: 'devcontainer', devcontainer: spec };
    }
  }
  
  // 2. Check for compose files
  for (const file of ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']) {
    if (entries.includes(file)) {
      const services = await parseComposeServices(`${projectPath}/${file}`);
      return {
        configType: 'compose',
        compose: { file, service: services[0] || 'app', envFile: entries.includes('.env') ? '.env' : undefined }
      };
    }
  }
  
  // 3. Check for Dockerfile
  for (const file of ['Dockerfile', 'Dockerfile.dev', 'Dockerfile.development']) {
    if (entries.includes(file)) {
      return {
        configType: 'dockerfile',
        dockerfile: file,
        devcontainer: {
          dockerfile: file,
          build: { context: '.', dockerfile: file },
          forwardPorts: [3000, 8080, 5173],
        }
      };
    }
  }
  
  // 4. Language defaults
  const language = detectLanguage(entries);
  return {
    configType: 'auto',
    devcontainer: getLanguageDefaults(language),
    language,
  };
}

async function parseDevContainerJson(content: string, projectPath: string): Promise<DevContainerSpec> {
  // Strip JSON comments (devcontainer.json supports // and /* */)
  const stripped = stripJsonComments(content);
  const parsed = JSON.parse(stripped);
  
  // Handle "build" object
  if (parsed.build && typeof parsed.build === 'object') {
    parsed.build = {
      context: parsed.build.context || '.',
      dockerfile: parsed.build.dockerfile || 'Dockerfile',
      args: parsed.build.args,
    };
  }
  
  // Expand ~ in mounts
  if (parsed.mounts) {
    const homeDir = await invoke<string>('get_home_dir');
    parsed.mounts = parsed.mounts.map((m: any) => ({
      ...m,
      source: m.source.replace('~', homeDir.trim()),
      type: m.type || 'bind',
      readonly: m.readonly ?? false,
    }));
  }
  
  // Normalize ports
  if (parsed.ports && !parsed.forwardPorts) {
    parsed.forwardPorts = parsed.ports;
  }
  
  return parsed;
}

function stripJsonComments(json: string): string {
  let result = '';
  let inString = false;
  let inLineComment = false;
  let inBlockComment = false;
  let i = 0;
  
  while (i < json.length) {
    const char = json[i];
    const nextChar = json[i + 1];
    
    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
        result += char;
      }
      i++;
      continue;
    }
    
    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i += 2;
      } else {
        i++;
      }
      continue;
    }
    
    if (inString) {
      result += char;
      if (char === '"' && json[i - 1] !== '\\') {
        inString = false;
      }
      i++;
      continue;
    }
    
    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      i += 2;
      continue;
    }
    
    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i += 2;
      continue;
    }
    
    if (char === '"') {
      inString = true;
    }
    
    result += char;
    i++;
  }
  
  return result;
}

async function parseComposeServices(filePath: string): Promise<string[]> {
  const content = await invoke<string>('fs_read_text_file', { path: filePath });
  // Simple YAML parsing for services - look for "services:" key
  const servicesMatch = content.match(/services:\s*\n((?:\s+\w+:\s*\n)+)/);
  if (servicesMatch) {
    const servicesBlock = servicesMatch[1];
    const serviceNames = servicesBlock.match(/^\s+(\w+):/gm);
    if (serviceNames) {
      return serviceNames.map(s => s.trim().replace(':', ''));
    }
  }
  return [];
}

function detectLanguage(entries: string[]): string {
  if (entries.includes('package.json')) return 'node';
  if (entries.includes('pyproject.toml') || entries.includes('requirements.txt')) return 'python';
  if (entries.includes('Cargo.toml')) return 'rust';
  if (entries.includes('go.mod')) return 'go';
  if (entries.includes('pom.xml') || entries.includes('build.gradle')) return 'java';
  return 'generic';
}

function getLanguageDefaults(language: string): DevContainerSpec {
  const defaults: Record<string, DevContainerSpec> = {
    node: { image: 'node:20-bookworm', forwardPorts: [3000, 8080, 5173], postCreateCommand: 'npm install' },
    python: { image: 'python:3.12-bookworm', forwardPorts: [8000, 8080], postCreateCommand: 'pip install -e .' },
    rust: { image: 'rust:1.78-bookworm', postCreateCommand: 'cargo build' },
    go: { image: 'golang:1.22-bookworm', postCreateCommand: 'go mod download' },
    generic: { image: 'ubuntu:22.04' },
  };
  return defaults[language] || defaults.generic;
}
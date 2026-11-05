export interface AIProvider {
  readonly id: 'ollama' | 'openrouter';
  readonly name: string;
  readonly models: AIModel[];

  chat(messages: ChatMessage[]): AsyncIterable<string>;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<AIModel[]>;
  pullModel(model: string): Promise<void>;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  free: boolean;
  size?: string;
  modified?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  content: string;
  done: boolean;
}

export interface AIContext {
  problem?: {
    id: string;
    title: string;
    description: string;
    severity: string;
    containerName?: string;
    dockerContext?: string;
  };
  diagnostics?: {
    containers: Array<{ name: string; status: string; image: string }>;
    vm: { status: string; cpus: number; memory: number };
    networks: string[];
  };
  runtime: {
    id: string;
    name: string;
    version?: string;
  };
}

export const SYSTEM_PROMPT = `You are a Docker/Colima troubleshooting assistant. 
You help users diagnose and fix container problems on macOS.
Be concise, practical, and explain fixes in plain language.
When suggesting commands, show the exact command to run.
Prioritize safe, reversible actions.`;
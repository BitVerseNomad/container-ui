import { AIProvider, AIModel, ChatMessage, AIContext } from "../types";
import { invoke } from "@tauri-apps/api/core";

export class OllamaProvider implements AIProvider {
  readonly id = 'ollama' as const;
  readonly name = 'Ollama (Local)';
  readonly baseUrl = 'http://localhost:11434';
  readonly models: AIModel[] = [
    { id: 'llama3.1:8b', name: 'Llama 3.1 8B', description: 'Meta Llama 3.1 8B Instruct', contextWindow: 128000, free: true },
    { id: 'gemma2:9b', name: 'Gemma 2 9B', description: 'Google Gemma 2 9B Instruct', contextWindow: 8192, free: true },
    { id: 'phi3:mini', name: 'Phi-3 Mini', description: 'Microsoft Phi-3 Mini 128K Instruct', contextWindow: 128000, free: true },
  ];

  async isAvailable(): Promise<boolean> {
    try {
      const result = await invoke('ollama_list_models');
      return true;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<AIModel[]> {
    const result = await invoke('ollama_list_models');
    return JSON.parse(String(result)) as AIModel[];
  }

  async pullModel(model: string): Promise<void> {
    await invoke('ollama_pull', { model });
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    const response = await invoke('ollama_chat', { 
      model: 'llama3.1:8b', // default, will be configurable
      messages 
    });
    
    // For now, return full response. Streaming would need event-based approach.
    yield response as string;
  }

  // Build context-aware prompt for troubleshooting
  buildTroubleshootingPrompt(context: AIContext, userQuestion: string): ChatMessage[] {
    const contextParts: string[] = [];

    if (context.problem) {
      contextParts.push(`**Current Problem:** ${context.problem.title}`);
      contextParts.push(`**Description:** ${context.problem.description}`);
      contextParts.push(`**Severity:** ${context.problem.severity}`);
      if (context.problem.containerName) {
        contextParts.push(`**Container:** ${context.problem.containerName}`);
      }
      if (context.problem.dockerContext) {
        contextParts.push(`**Docker Context:** ${context.problem.dockerContext}`);
      }
    }

    if (context.diagnostics) {
      contextParts.push(`**Running Containers:** ${context.diagnostics.containers.map((c: any) => `${c.name} (${c.status}) - ${c.image}`).join(', ')}`);
      contextParts.push(`**VM:** ${context.diagnostics.vm.status} (${context.diagnostics.vm.cpus} CPUs, ${context.diagnostics.vm.memory} GB)`);
      contextParts.push(`**Networks:** ${context.diagnostics.networks.join(', ')}`);
    }

    contextParts.push(`**Runtime:** ${context.runtime.name} (${context.runtime.id})${context.runtime.version ? ` v${context.runtime.version}` : ''}`);

    return [
      { role: 'system', content: `You are a Docker/Colima troubleshooting assistant. Be concise and practical.\n\n**Context:**\n${contextParts.join('\n')}` },
      { role: 'user', content: userQuestion },
    ];
  }
}

export const ollamaProvider = new OllamaProvider();
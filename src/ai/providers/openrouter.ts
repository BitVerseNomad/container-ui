import { AIProvider, AIModel, ChatMessage } from "../types";
import { invoke } from "@tauri-apps/api/core";

const OPENROUTER_API = 'https://openrouter.ai/api/v1';
const FREE_MODELS: AIModel[] = [
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B', description: 'Meta Llama 3.1 8B Instruct (free)', contextWindow: 128000, free: true },
  { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B', description: 'Google Gemma 2 9B Instruct (free)', contextWindow: 8192, free: true },
  { id: 'microsoft/phi-3-mini-128k-instruct:free', name: 'Phi-3 Mini', description: 'Microsoft Phi-3 Mini 128K Instruct (free)', contextWindow: 128000, free: true },
];

export class OpenRouterProvider implements AIProvider {
  readonly id = 'openrouter' as const;
  readonly name = 'OpenRouter (Cloud)';
  readonly models = FREE_MODELS;

  private apiKey: string | null = null;

  async isAvailable(): Promise<boolean> {
    if (!this.apiKey) {
      try {
        this.apiKey = await invoke('get_openrouter_key');
      } catch {
        return false;
      }
    }
    return !!this.apiKey;
  }

  async listModels(): Promise<AIModel[]> {
    if (!await this.isAvailable()) return [];
    
    try {
      const response = await fetch(`${OPENROUTER_API}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      const data = await response.json();
      return data.data
        .filter((m: any) => m.id.endsWith(':free'))
        .map((m: any) => ({
          id: m.id,
          name: m.name,
          description: m.description,
          contextWindow: m.context_length,
          free: true,
        }));
    } catch {
      return FREE_MODELS;
    }
  }

  async pullModel(_model: string): Promise<void> {
    // Not applicable for OpenRouter
  }

  async *chat(messages: ChatMessage[]): AsyncIterable<string> {
    if (!await this.isAvailable()) {
      throw new Error('OpenRouter not configured. Set API key in settings.');
    }

    const response = await fetch(`${OPENROUTER_API}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/filipesousaduty/colima-ui',
        'X-Title': 'Container UI',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) yield content;
            } catch {}
          }
        }
      }
    }
  }
}

export const openRouterProvider = new OpenRouterProvider();
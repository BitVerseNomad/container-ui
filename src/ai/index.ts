import { AIProvider, AIModel, ChatMessage, AIContext } from "./types";
import { ollamaProvider } from "./providers/ollama";
import { openRouterProvider } from "./providers/openrouter";

export type ProviderId = 'ollama' | 'openrouter';

export class AIManager {
  private providers: Map<ProviderId, AIProvider> = new Map();
  private activeProvider: ProviderId = 'ollama';

  constructor() {
    this.providers.set('ollama', ollamaProvider);
    this.providers.set('openrouter', openRouterProvider);
  }

  getProvider(id: ProviderId): AIProvider {
    return this.providers.get(id)!;
  }

  getActiveProvider(): AIProvider {
    return this.providers.get(this.activeProvider)!;
  }

  setActiveProvider(id: ProviderId): void {
    this.activeProvider = id;
  }

  getAvailableProviders(): ProviderId[] {
    return Array.from(this.providers.keys());
  }

  async checkAvailability(): Promise<Record<ProviderId, boolean>> {
    const results: Record<ProviderId, boolean> = {
      ollama: false,
      openrouter: false,
    };

    for (const [id, provider] of this.providers) {
      try {
        results[id] = await provider.isAvailable();
      } catch {
        results[id] = false;
      }
    }

    return results;
  }

  async listAllModels(): Promise<Record<ProviderId, AIModel[]>> {
    const results: Record<ProviderId, AIModel[]> = {
      ollama: [],
      openrouter: [],
    };

    for (const [id, provider] of this.providers) {
      try {
        if (await provider.isAvailable()) {
          results[id] = await provider.listModels();
        }
      } catch {
        results[id] = [];
      }
    }

    return results;
  }

  async *chat(messages: ChatMessage[], providerId?: ProviderId): AsyncIterable<string> {
    const provider = this.providers.get(providerId || this.activeProvider)!;
    yield* provider.chat(messages);
  }

  async pullModel(model: string, providerId: ProviderId): Promise<void> {
    const provider = this.providers.get(providerId)!;
    return provider.pullModel(model);
  }

  // Build troubleshooting prompt with context
  buildTroubleshootingPrompt(context: AIContext, userQuestion: string, providerId: ProviderId = 'ollama'): ChatMessage[] {
    const provider = this.providers.get(providerId)!;
    if ('buildTroubleshootingPrompt' in provider) {
      return (provider as any).buildTroubleshootingPrompt(context, userQuestion);
    }
    return [
      { role: 'system', content: 'You are a Docker/Colima troubleshooting assistant.' },
      { role: 'user', content: userQuestion },
    ];
  }
}

export const aiManager = new AIManager();
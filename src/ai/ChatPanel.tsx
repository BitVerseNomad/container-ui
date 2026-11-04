import { useState, useRef, useEffect } from "react";
import { aiManager, ProviderId } from "./index";
import { AIContext, ChatMessage, AIModel } from "./types";
import { Icon, IconName } from "../ui/icons";
import { usePoll } from "../hooks";
import { invoke } from "@tauri-apps/api/core";

export default function AIChatPanel({
  context,
  onClose,
}: {
  context: AIContext;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");
  const [provider, setProvider] = useState<ProviderId>('ollama');
  const [providers, setProviders] = useState<Record<ProviderId, { available: boolean; error?: string }>>({ 
    ollama: { available: false }, 
    openrouter: { available: false } 
  });
  const [models, setModels] = useState<Record<ProviderId, AIModel[]>>({ ollama: [], openrouter: [] });
  const [selectedModelId, setSelectedModelId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Poll provider availability
  const { data: availData } = usePoll(async () => {
    return aiManager.checkAvailability();
  }, [], 10000, true);

  useEffect(() => {
    if (availData) {
      setProviders(prev => ({
        ollama: { available: availData.ollama },
        openrouter: { available: availData.openrouter },
      }));
    }
  }, [availData]);

  // Load models when provider changes
  useEffect(() => {
    const loadModels = async () => {
      const allModels = await aiManager.listAllModels();
      setModels(allModels);
      const providerModels = allModels[provider] || [];
      if (providerModels.length) {
        setSelectedModelId(providerModels[0].id);
      }
    };
    loadModels();
  }, [provider, providers[provider]?.available]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedModel = models[provider]?.find(m => m.id === selectedModelId);

  const formatContextWindow = (tokens: number) => {
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}k`;
    return tokens.toString();
  };

  const formatSize = (bytes?: string) => {
    if (!bytes) return null;
    const b = parseInt(bytes);
    if (b >= 1024 * 1024 * 1024) return `${(b / 1024 / 1024 / 1024).toFixed(1)} GB`;
    if (b >= 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
    return `${(b / 1024).toFixed(0)} KB`;
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput("");
    setLoading(true);
    setError(null);

    const newMessages = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);

    try {
      const prompt = aiManager.buildTroubleshootingPrompt(context, userMessage, provider);
      
      for await (const chunk of aiManager.chat(prompt, provider)) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last.role === 'assistant') {
            return [...prev.slice(0, -1), { role: 'assistant', content: last.content + chunk }];
          }
          return [...prev, { role: 'assistant', content: chunk }];
        });
      }
    } catch (e) {
      setError(String(e));
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderProviderPicker = () => (
    <div className="ai-provider-picker" role="radiogroup" aria-label="AI Provider">
      {(['ollama', 'openrouter'] as ProviderId[]).map(id => {
        const p = providers[id];
        return (
          <button
            key={id}
            className={`ai-provider-card ${provider === id ? 'active' : ''} ${!p?.available ? 'unavailable' : ''}`}
            onClick={() => p?.available && setProvider(id)}
            disabled={!p?.available || loading}
            role="radio"
            aria-checked={provider === id}
            title={p?.available ? undefined : p?.error || 'Not available'}
          >
            <div className="ai-provider-icon">
              {id === 'ollama' ? <Icon name="box" size={18} /> : <Icon name="terminal" size={18} />}
            </div>
            <div className="ai-provider-info">
              <span className="ai-provider-name">{id === 'ollama' ? 'Ollama' : 'OpenRouter'}</span>
              <span className="ai-provider-desc">{id === 'ollama' ? 'Local (privado)' : 'Cloud (modelos free)'}</span>
            </div>
            <span className={`ai-provider-status ${p?.available ? 'ok' : 'off'}`}>
              {p?.available ? '✓' : '✗'}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderModelSelector = () => {
    const providerModels = models[provider] || [];
    if (!providerModels.length) return null;

    return (
      <div className="ai-model-selector">
        <select
          className="ai-model-select"
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
          disabled={loading}
          aria-label="Select model"
        >
          {providerModels.map(m => (
            <option key={m.id} value={m.id}>
              {m.name} {m.free ? '(Free)' : ''}
            </option>
          ))}
        </select>
        {selectedModel && (
          <div className="ai-model-info">
            <div className="ai-model-badges">
              {selectedModel.free && <span className="ai-badge free">Free</span>}
              <span className="ai-badge context">{formatContextWindow(selectedModel.contextWindow)} context</span>
              {selectedModel.size && <span className="ai-badge size">{formatSize(selectedModel.size)}</span>}
            </div>
            <p className="ai-model-desc">{selectedModel.description}</p>
          </div>
        )}
      </div>
    );
  };

  const renderWelcome = () => (
    <div className="ai-chat-welcome">
      <Icon name="hammer" size={28} />
      <h3>Como posso ajudar?</h3>
      <p>Pergunte sobre containers, Docker, Colima, Kafka, redes, volumes...</p>
      <div className="ai-suggestions" role="list">
        {[
          { text: "Por que meu container reinicia?", icon: "restart" },
          { text: "Como corrigir conflito de porta?", icon: "network" },
          { text: "Kafka UI não conecta no Kafka", icon: "alert" },
          { text: "Container sem memória (OOM)", icon: "gauge" },
        ].map((s, i) => (
          <button 
            key={i} 
            className="ai-suggestion-btn"
            onClick={() => { setInput(s.text); sendMessage(); }}
            disabled={loading}
          >
            <Icon name={s.icon as IconName} size={14} />
            <span>{s.text}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderMessages = () => (
    <div className="ai-chat-messages">
      {messages.length === 0 && renderWelcome()}
      {messages.map((msg, i) => (
        <div key={i} className={`ai-message ${msg.role}`}>
          <div className="ai-message-bubble">{msg.content}</div>
        </div>
      ))}
      {loading && (
        <div className="ai-message assistant">
          <div className="ai-message-bubble ai-typing">
            <span></span><span></span><span></span>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="ai-chat-title">
          <Icon name="hammer" size={16} />
          <span>AI Assistant</span>
        </div>
        <div className="ai-chat-controls">
          {renderProviderPicker()}
          {renderModelSelector()}
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      {renderMessages()}

      {error && (
        <div className="ai-error" role="alert">{error}</div>
      )}

      <div className="ai-chat-input">
        <textarea
          ref={inputRef}
          className="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte sobre containers, Docker, Colima..."
          disabled={loading}
          rows={2}
          aria-label="Sua pergunta"
        />
        <button className="primary ai-send" onClick={sendMessage} disabled={!input.trim() || loading} aria-label="Enviar">
          {loading ? <Icon name="restart" size={14} /> : <Icon name="play" size={14} />}
        </button>
      </div>
    </div>
  );
}
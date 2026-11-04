import { useState, useRef, useEffect } from "react";
import { aiManager, ProviderId } from "./index";
import { AIContext, ChatMessage } from "./types";
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
  const [providers, setProviders] = useState<Record<ProviderId, boolean>>({ ollama: false, openrouter: false });
  const [models, setModels] = useState<Record<ProviderId, Array<{ id: string; name: string }>>>({ ollama: [], openrouter: [] });
  const [selectedModel, setSelectedModel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Poll provider availability
  const { data: availData } = usePoll(async () => {
    return aiManager.checkAvailability();
  }, [], 10000, true);

  useEffect(() => {
    if (availData) setProviders(availData);
  }, [availData]);

  // Load models when provider changes
  useEffect(() => {
    const loadModels = async () => {
      const allModels = await aiManager.listAllModels();
      setModels(allModels);
      if (allModels[provider]?.length) {
        setSelectedModel(allModels[provider][0].id);
      }
    };
    loadModels();
  }, [provider, providers[provider]]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  return (
    <div className="ai-chat-panel">
      <div className="ai-chat-header">
        <div className="ai-chat-title">
          <Icon name="hammer" size={16} />
          <span>AI Assistant</span>
        </div>
        <div className="ai-chat-controls">
          <select
            className="ai-provider-select"
            value={provider}
            onChange={(e) => setProvider(e.target.value as ProviderId)}
            disabled={loading}
          >
            {Object.entries(providers).map(([id, available]) => (
              <option key={id} value={id} disabled={!available}>
                {id === 'ollama' ? 'Ollama (Local)' : 'OpenRouter (Cloud)'} {available ? '✓' : '✗'}
              </option>
            ))}
          </select>
          {models[provider]?.length && (
            <select
              className="ai-model-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={loading}
            >
              {models[provider].map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
        </div>
      </div>

      <div className="ai-chat-messages">
        {messages.length === 0 && (
          <div className="ai-chat-welcome">
            <Icon name="hammer" size={24} />
            <p>Ask me about container problems, Docker commands, or Colima setup.</p>
            <div className="ai-suggestions">
              <button onClick={() => { setInput("Why is my container restarting?"); sendMessage(); }}>Why is my container restarting?</button>
              <button onClick={() => { setInput("How do I fix a port conflict?"); sendMessage(); }}>How do I fix a port conflict?</button>
              <button onClick={() => { setInput("My Kafka UI can't connect to Kafka"); sendMessage(); }}>Kafka connection issues</button>
            </div>
          </div>
        )}
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

      {error && (
        <div className="ai-error">{error}</div>
      )}

      <div className="ai-chat-input">
        <textarea
          ref={inputRef}
          className="ai-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about containers, Docker, Colima..."
          disabled={loading}
          rows={2}
        />
        <button className="primary ai-send" onClick={sendMessage} disabled={!input.trim() || loading}>
          {loading ? <Icon name="restart" size={14} /> : <Icon name="play" size={14} />}
        </button>
      </div>
    </div>
  );
}
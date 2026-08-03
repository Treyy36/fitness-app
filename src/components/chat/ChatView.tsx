import { useState, useRef, useEffect } from 'react';
import { useChat, type ChatMessage } from '../../context/ChatContext';
import { stripActions } from '../../services/intentParser';
import { MessageBubble } from './MessageBubble';

export function ChatView() {
  const { messages, isStreaming, sendMessage, clearChat, hasApiKey } = useChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    setInput('');
    await sendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur border-b border-slate-800 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">GymTracker AI</h1>
          <p className="text-xs text-slate-400">
            {hasApiKey ? '🟢 AI Ready' : '⚫ Set API key in Settings'}
          </p>
        </div>
        <button
          onClick={clearChat}
          className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded"
          title="Clear chat"
        >
          Clear
        </button>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto chat-scroll px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 gap-3">
            <span className="text-5xl">🏋️</span>
            <div>
              <p className="text-sm font-medium text-slate-400">Welcome to GymTracker AI</p>
              <p className="text-xs mt-1 max-w-xs">
                Ask for your workout, log a session, or get recommendations.<br />
                Try: <span className="text-brand-400">"What's today's workout?"</span>
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isStreaming && (
          <div className="flex gap-2 items-start">
            <span className="text-lg mt-1">🤖</span>
            <div className="bg-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="px-4 py-3 bg-slate-900/80 border-t border-slate-800 shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={hasApiKey ? 'Ask about your workout...' : 'Set API key in Settings first...'}
            disabled={!hasApiKey}
            rows={1}
            className="flex-1 bg-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition disabled:opacity-50 resize-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || isStreaming || !hasApiKey}
            className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition shrink-0"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

import type { ChatMessage } from '../../context/ChatContext';
import { stripActions } from '../../services/intentParser';
import ReactMarkdown from 'react-markdown';

interface Props {
  message: ChatMessage;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const displayContent = isUser ? message.content : stripActions(message.content);

  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      <span className="text-lg mt-1 shrink-0">{isUser ? '👤' : '🤖'}</span>
      <div
        className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm leading-relaxed ${
          isUser
            ? 'bg-brand-600 text-white rounded-tr-sm'
            : 'bg-slate-800 text-slate-200 rounded-tl-sm'
        }`}
      >
        {isUser ? (
          <p>{displayContent}</p>
        ) : (
          <div className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_strong]:text-brand-300">
            <ReactMarkdown>{displayContent}</ReactMarkdown>
          </div>
        )}

        {message.actions && message.actions.length > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-700/50">
            {message.actions.map((a, i) => (
              <span
                key={i}
                className={`inline-block text-[10px] px-2 py-0.5 rounded-full mr-1 mt-1 ${
                  a.success ? 'bg-emerald-900/50 text-emerald-300' : 'bg-red-900/50 text-red-300'
                }`}
              >
                {a.success ? '✓' : '✗'} {a.summary}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

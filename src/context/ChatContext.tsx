import { createContext, useContext, useState, useCallback, type ReactNode, useRef, useEffect } from 'react';
import { useApp } from './AppContext';
import { sendToDeepSeek, buildSystemPrompt } from '../services/deepseek';
import { parseActions, executeActions, type ExecuteActionsResult } from '../services/intentParser';
import type { WorkoutPlan } from '../db/database';
import { db, upsertPreference } from '../db/database';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  actions?: ActionResult[];
}

export interface ActionResult {
  type: string;
  success: boolean;
  summary: string;
}

interface ChatContextValue {
  messages: ChatMessage[];
  isStreaming: boolean;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
  setApiKey: (key: string) => void;
  hasApiKey: boolean;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const app = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [apiKey, setApiKeyState] = useState<string>('');
  const messagesRef = useRef<ChatMessage[]>([]);

  // Load API key and chat history from DB
  useEffect(() => {
    (async () => {
      const keyPref = await db.userPreferences.get({ key: 'deepseek_api_key' });
      if (keyPref) setApiKeyState(keyPref.value);

      const savedMessages = await db.userPreferences.get({ key: 'chat_history' });
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages.value);
          setMessages(parsed);
          messagesRef.current = parsed;
        } catch { /* ignore */ }
      }
    })();
  }, []);

  const setApiKey = useCallback(async (key: string) => {
    setApiKeyState(key);
    await upsertPreference('deepseek_api_key', key);
  }, []);

  const buildContext = useCallback(async (): Promise<string> => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Today's plan
    const todaysPlan = app.getPlanForDay(dayOfWeek);

    // Recent sessions (last 20 — full detail for first 10, condensed for older)
    const recentSessions = await db.sessions.orderBy('date').reverse().limit(20).toArray();
    let recentSessionData = '';
    for (let i = 0; i < recentSessions.length; i++) {
      const session = recentSessions[i];
      const exercises = await db.sessionExercises.where('sessionId').equals(session.id!).toArray();
      const typeLabel = session.sessionType && session.sessionType !== 'standard' ? ` [${session.sessionType}]` : '';

      if (i < 10) {
        // Full detail for 10 most recent
        const exSummary = exercises.map((e) => {
          const setSummary = e.sets.map((s) => `Set${s.setNumber}: ${s.weight}lbs x ${s.reps}${s.completed ? '' : ' (FAILED)'}${s.rpe ? ` RPE${s.rpe}` : ''}`).join(', ');
          return `  - ${e.exerciseName}: ${setSummary}`;
        }).join('\n');
        recentSessionData += `\n${session.date} — ${session.planName || 'Session'}${typeLabel}${session.feedback ? ` (Feedback: ${session.feedback})` : ''}\n${exSummary}\n`;
      } else {
        // Condensed for older sessions: just exercise names with avg weight
        const exSummary = exercises.map((e) => {
          const avgWeight = e.sets.length > 0 ? Math.round(e.sets.reduce((sum, s) => sum + s.weight, 0) / e.sets.length) : 0;
          return `  - ${e.exerciseName}: avg ${avgWeight}lbs x ${e.sets[0]?.reps ?? '?'}`;
        }).join('\n');
        recentSessionData += `\n${session.date} — ${session.planName || 'Session'}${typeLabel}\n${exSummary}\n`;
      }
    }

    // Recommendation history summary (last 10)
    let recommendationSummary = '';
    try {
      const recs = await db.recommendations.orderBy('createdAt').reverse().limit(10).toArray();
      if (recs.length > 0) {
        recommendationSummary = recs.map((r) =>
          `[${r.acknowledged ? '✓' : '○'}] ${r.type} ${r.exercise ? `(${r.exercise})` : ''}: ${r.message}`
        ).join('\n');
      }
    } catch { /* ignore */ }

    const allPlans = app.plans.map((p) => {
      const exNames = p.exercises.map((pe) => {
        const ex = app.exercises.find((e) => e.id === pe.exerciseId);
        return `${ex?.name ?? 'Unknown'} (${pe.sets}x${pe.reps})`;
      }).join(', ');
      const dayLabel = p.dayOfWeek !== undefined ? days[p.dayOfWeek] : 'Unscheduled';
      return `- ${p.name} [${dayLabel}]: ${exNames}`;
    }).join('\n');

    // Build exercise catalog string grouped by category
    const categories = new Map<string, string[]>();
    for (const ex of app.exercises) {
      const cat = categories.get(ex.category) || [];
      cat.push(ex.name);
      categories.set(ex.category, cat);
    }
    const exerciseCatalog = Array.from(categories.entries())
      .map(([cat, names]) => `  ${cat}: ${names.join(', ')}`)
      .join('\n');

    return buildSystemPrompt({
      today: days[dayOfWeek],
      todayDayIndex: dayOfWeek,
      todaysPlan: todaysPlan ? {
        name: todaysPlan.name,
        exercises: todaysPlan.exercises.map((pe) => {
          const ex = app.exercises.find((e) => e.id === pe.exerciseId);
          return `${ex?.name ?? 'Unknown'} — ${pe.sets} sets x ${pe.reps} reps`;
        }),
      } : null,
      allPlans,
      exerciseCatalog,
      recentSessionData,
      recommendationSummary,
      activeSessionId: app.activeSessionId,
      preferences: [] as string[],
    });
  }, [app]);

  const sendMessage = useCallback(async (text: string) => {
    if (!apiKey.trim()) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: '⚠️ Please set your DeepSeek API key in the Settings tab first.', timestamp: Date.now() },
      ]);
      return;
    }

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    messagesRef.current = [...messagesRef.current, userMsg];
    setIsStreaming(true);

    try {
      const systemPrompt = await buildContext();
      const conversationHistory = messagesRef.current.slice(-10).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const response = await sendToDeepSeek({
        apiKey,
        systemPrompt,
        messages: [...conversationHistory, { role: 'user' as const, content: text }],
      });

      // Parse and execute actions
      const actions = parseActions(response);
      const execResult: ExecuteActionsResult = await executeActions(actions, app, response);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        actions: execResult.results,
      };

      const newMessages = [...messagesRef.current, assistantMsg];

      // Inject query results as system messages so AI sees them next turn
      if (execResult.queryResults && execResult.queryResults.length > 0) {
        for (const qr of execResult.queryResults) {
          newMessages.push(qr);
        }
      }

      setMessages(newMessages);
      messagesRef.current = newMessages;

      // Persist chat history
      await upsertPreference(
        'chat_history',
        JSON.stringify(messagesRef.current.slice(-50))
      );
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `❌ Error: ${err.message || 'Failed to reach DeepSeek API. Check your API key and connection.'}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      messagesRef.current = [...messagesRef.current, errorMsg];
    } finally {
      setIsStreaming(false);
    }
  }, [apiKey, buildContext, app]);

  const clearChat = useCallback(async () => {
    setMessages([]);
    messagesRef.current = [];
    await db.userPreferences.where('key').equals('chat_history').delete();
  }, []);

  return (
    <ChatContext.Provider value={{ messages, isStreaming, sendMessage, clearChat, setApiKey, hasApiKey: !!apiKey }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be inside ChatProvider');
  return ctx;
}

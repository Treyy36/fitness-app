import { db, type SetRecord, type Recommendation } from '../db/database';
import type { ActionResult } from '../context/ChatContext';

interface ParsedAction {
  action: string;
  data: Record<string, any>;
}

// Extract <!--ACTION:{...}--> blocks from AI response
export function parseActions(text: string): ParsedAction[] {
  const actions: ParsedAction[] = [];
  const regex = /<!--ACTION:(.*?)-->/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed.action && parsed.data) {
        actions.push(parsed);
      }
    } catch {
      console.warn('[IntentParser] Failed to parse action block:', match[1]);
    }
  }

  return actions;
}

// Strip action blocks from display text
export function stripActions(text: string): string {
  return text.replace(/<!--ACTION:.*?-->/g, '').trim();
}

// Execute parsed actions against the database
export async function executeActions(
  actions: ParsedAction[],
  app: {
    getPlanByName: (name: string) => { id?: number; name: string; exercises: Array<{ exerciseId: number; sets: number; reps: number }> } | null;
    getPlanForDay: (day: number) => { id?: number; name: string; exercises: Array<{ exerciseId: number; sets: number; reps: number }> } | null;
    createPlan: (plan: any) => Promise<number>;
    createSession: (session: any) => Promise<number>;
    completeSession: (id: number, feedback?: string) => Promise<void>;
    addSessionExercise: (ex: any) => Promise<void>;
    exercises: { id?: number; name: string }[];
    refreshSessions: () => Promise<void>;
    setActiveSessionId: (id: number | null) => void;
  },
  responseText: string
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const { action, data } of actions) {
    try {
      switch (action) {
        case 'create_plan': {
          const exerciseIds = data.exercises.map((e: { name: string; sets: number; reps: number }) => {
            const found = app.exercises.find((ex) => ex.name.toLowerCase() === e.name.toLowerCase());
            return { exerciseId: found?.id ?? 1, sets: e.sets, reps: e.reps };
          });

          await app.createPlan({
            name: data.name,
            dayOfWeek: data.dayOfWeek,
            exercises: exerciseIds,
            createdAt: new Date().toISOString(),
          });
          results.push({ type: 'create_plan', success: true, summary: `Plan "${data.name}" created with ${exerciseIds.length} exercises.` });
          break;
        }

        case 'log_session': {
          // Find the plan
          let plan: { id?: number; name?: string } | null = data.planId ? { id: data.planId } : null;
          if (!plan && data.planName) plan = app.getPlanByName(data.planName);
          if (!plan) plan = app.getPlanForDay(new Date().getDay());

          const sessionId = await app.createSession({
            planId: plan?.id,
            planName: plan?.name ?? data.planName ?? 'Custom',
            date: new Date().toISOString().split('T')[0],
            completedAt: new Date().toISOString(),
            feedback: data.feedback,
          });

          // Add exercises
          for (const ex of data.exercises || []) {
            const found = app.exercises.find((e) => e.name.toLowerCase() === ex.name.toLowerCase());
            const sets: SetRecord[] = (ex.sets || []).map((s: any) => ({
              setNumber: s.setNumber,
              reps: s.reps,
              weight: s.weight,
              completed: s.completed !== false,
              rpe: s.rpe,
            }));

            await app.addSessionExercise({
              sessionId,
              exerciseId: found?.id ?? 0,
              exerciseName: ex.name,
              sets,
            });
          }

          await app.completeSession(sessionId);
          app.setActiveSessionId(null);
          await app.refreshSessions();
          results.push({ type: 'log_session', success: true, summary: `Session #${sessionId} logged with ${data.exercises?.length ?? 0} exercises.` });
          break;
        }

        case 'save_recommendation': {
          await db.recommendations.add({
            sessionId: data.sessionId,
            type: data.type || 'general',
            exercise: data.exercise,
            message: data.message,
            action: data.action,
            acknowledged: false,
            createdAt: new Date().toISOString(),
          } as Recommendation);
          results.push({ type: 'save_recommendation', success: true, summary: `Recommendation saved: ${data.message?.slice(0, 50)}...` });
          break;
        }

        default:
          results.push({ type: action, success: false, summary: `Unknown action: ${action}` });
      }
    } catch (err: any) {
      results.push({ type: action, success: false, summary: `Error: ${err.message}` });
    }
  }

  return results;
}

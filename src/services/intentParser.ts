import { db, type SetRecord, type Recommendation, type MuscleGroup } from '../db/database';
import type { ActionResult, ChatMessage } from '../context/ChatContext';

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

export interface ExecuteActionsResult {
  results: ActionResult[];
  queryResults?: ChatMessage[];
}

// Execute parsed actions against the database
export async function executeActions(
  actions: ParsedAction[],
  app: {
    getPlanByName: (name: string) => { id?: number; name: string; exercises: Array<{ exerciseId: number; sets: number; reps: number }> } | null;
    getPlanForDay: (day: number) => { id?: number; name: string; exercises: Array<{ exerciseId: number; sets: number; reps: number }> } | null;
    createPlan: (plan: any) => Promise<number>;
    updatePlan: (id: number, updates: any) => Promise<void>;
    createSession: (session: any) => Promise<number>;
    completeSession: (id: number, feedback?: string) => Promise<void>;
    updateSession: (id: number, updates: any) => Promise<void>;
    deleteSession: (id: number) => Promise<void>;
    addSessionExercise: (ex: any) => Promise<void>;
    addExercise: (name: string, category: MuscleGroup, defaultSets?: number, defaultReps?: number) => Promise<number>;
    exercises: { id?: number; name: string }[];
    refreshSessions: () => Promise<void>;
    setActiveSessionId: (id: number | null) => void;
  },
  responseText: string
): Promise<ExecuteActionsResult> {
  const results: ActionResult[] = [];
  const queryResults: ChatMessage[] = [];

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
            sessionType: data.sessionType ?? 'standard',
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

        case 'update_session': {
          await app.updateSession(data.sessionId, {
            ...(data.feedback !== undefined && { feedback: data.feedback }),
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.sessionType !== undefined && { sessionType: data.sessionType }),
          });

          if (data.exercises && Array.isArray(data.exercises)) {
            // Replace all session exercises: delete old ones, insert new ones
            await db.sessionExercises.where('sessionId').equals(data.sessionId).delete();
            for (const ex of data.exercises) {
              const found = app.exercises.find((e) => e.name.toLowerCase() === ex.name.toLowerCase());
              const sets: SetRecord[] = (ex.sets || []).map((s: any) => ({
                setNumber: s.setNumber,
                reps: s.reps,
                weight: s.weight,
                completed: s.completed !== false,
                rpe: s.rpe,
              }));
              await app.addSessionExercise({
                sessionId: data.sessionId,
                exerciseId: found?.id ?? 0,
                exerciseName: ex.name,
                sets,
              });
            }
          }

          await app.refreshSessions();
          results.push({ type: 'update_session', success: true, summary: `Session #${data.sessionId} updated.` });
          break;
        }

        case 'delete_session': {
          await app.deleteSession(data.sessionId);
          results.push({ type: 'delete_session', success: true, summary: `Session #${data.sessionId} deleted.` });
          break;
        }

        case 'add_exercise': {
          const category = (data.category || 'other') as MuscleGroup;
          const id = await app.addExercise(data.name, category, data.defaultSets, data.defaultReps);
          results.push({ type: 'add_exercise', success: true, summary: `Exercise "${data.name}" added to catalog (ID #${id}).` });
          break;
        }

        case 'update_plan': {
          const updates: any = {};
          if (data.name !== undefined) updates.name = data.name;
          if (data.dayOfWeek !== undefined) updates.dayOfWeek = data.dayOfWeek;
          if (data.exercises && Array.isArray(data.exercises)) {
            updates.exercises = data.exercises.map((e: { name: string; sets: number; reps: number }) => {
              const found = app.exercises.find((ex) => ex.name.toLowerCase() === e.name.toLowerCase());
              return { exerciseId: found?.id ?? 0, sets: e.sets, reps: e.reps };
            });
          }
          await app.updatePlan(data.planId, updates);
          results.push({ type: 'update_plan', success: true, summary: `Plan #${data.planId} updated.` });
          break;
        }

        case 'get_session_history': {
          let sessionsQuery = db.sessions.orderBy('date').reverse();

          const matchingSessions: any[] = [];
          let collection = await sessionsQuery.toArray();

          for (const session of collection) {
            let match = true;

            if (data.sessionType && session.sessionType !== data.sessionType) match = false;
            if (data.planName && session.planName?.toLowerCase() !== data.planName.toLowerCase()) match = false;
            if (data.dateFrom && session.date < data.dateFrom) match = false;
            if (data.dateTo && session.date > data.dateTo) match = false;

            if (data.exerciseName && match) {
              const exs = await db.sessionExercises.where('sessionId').equals(session.id!).toArray();
              const hasExercise = exs.some((e) => e.exerciseName.toLowerCase() === data.exerciseName.toLowerCase());
              if (!hasExercise) match = false;
            }

            if (match) matchingSessions.push(session);
          }

          const limit = data.limit || 20;
          const limited = matchingSessions.slice(0, limit);

          let text = `\n📊 Session History Query Results:\n`;
          if (data.exerciseName) text += `Filtered by exercise: "${data.exerciseName}"\n`;
          if (data.sessionType) text += `Filtered by type: ${data.sessionType}\n`;
          if (data.planName) text += `Filtered by plan: ${data.planName}\n`;
          text += `Found ${matchingSessions.length} matching sessions (showing ${limited.length}):\n`;

          for (const session of limited) {
            const exs = await db.sessionExercises.where('sessionId').equals(session.id!).toArray();
            const exSummary = exs.map((e) => {
              const setSummary = e.sets.map((s) => `${s.weight}lbs x ${s.reps}${s.completed ? '' : ' (FAILED)'}${s.rpe ? ` RPE${s.rpe}` : ''}`).join(', ');
              return `  - ${e.exerciseName}: ${setSummary}`;
            }).join('\n');
            const typeLabel = session.sessionType && session.sessionType !== 'standard' ? ` [${session.sessionType}]` : '';
            text += `\n${session.date} — ${session.planName || 'Session'}${typeLabel}${session.feedback ? ` (${session.feedback})` : ''}\n${exSummary || '  No exercises recorded'}\n`;
          }

          queryResults.push({
            id: crypto.randomUUID(),
            role: 'system',
            content: text,
            timestamp: Date.now(),
          });
          results.push({ type: 'get_session_history', success: true, summary: `Found ${matchingSessions.length} matching sessions.` });
          break;
        }

        case 'get_recommendation_history': {
          let recs = db.recommendations.orderBy('createdAt').reverse();
          const allRecs = await recs.toArray();

          const filtered = allRecs.filter((r) => {
            if (data.exercise && r.exercise?.toLowerCase() !== data.exercise.toLowerCase()) return false;
            if (data.type && r.type !== data.type) return false;
            if (data.acknowledged !== undefined && r.acknowledged !== data.acknowledged) return false;
            return true;
          });

          const limit = data.limit || 15;
          const limited = filtered.slice(0, limit);

          let text = `\n📋 Recommendation History:\n`;
          if (data.exercise) text += `Filtered by exercise: "${data.exercise}"\n`;
          if (data.type) text += `Filtered by type: ${data.type}\n`;
          text += `Found ${filtered.length} recommendations (showing ${limited.length}):\n`;

          for (const rec of limited) {
            const status = rec.acknowledged ? '✓' : '○';
            text += `\n${status} [${rec.type}] ${rec.exercise ? `(${rec.exercise}) ` : ''}${rec.message}\n`;
            if (rec.action) text += `  → Action: ${rec.action}\n`;
            text += `  Created: ${rec.createdAt}\n`;
          }

          queryResults.push({
            id: crypto.randomUUID(),
            role: 'system',
            content: text,
            timestamp: Date.now(),
          });
          results.push({ type: 'get_recommendation_history', success: true, summary: `Found ${filtered.length} recommendations.` });
          break;
        }

        case 'get_rpe_trend': {
          const exerciseName = data.exerciseName;
          const allSE = await db.sessionExercises.toArray();

          const matching = allSE.filter((se) => se.exerciseName.toLowerCase() === exerciseName.toLowerCase());

          if (matching.length === 0) {
            queryResults.push({
              id: crypto.randomUUID(),
              role: 'system',
              content: `\n📈 RPE Trend for "${exerciseName}": No data found.\n`,
              timestamp: Date.now(),
            });
            results.push({ type: 'get_rpe_trend', success: true, summary: `No RPE data for "${exerciseName}".` });
            break;
          }

          let text = `\n📈 RPE Trend Analysis for "${exerciseName}":\n`;
          let totalSets = 0;
          let rpeSum = 0;
          let rpeCount = 0;

          for (const se of matching) {
            const session = await db.sessions.get(se.sessionId);
            const date = session?.date ?? 'unknown';
            const setsWithRpe = se.sets.filter((s) => s.rpe !== undefined);
            if (setsWithRpe.length === 0) continue;

            const setSummaries = se.sets.map((s) => {
              if (s.rpe !== undefined) {
                rpeSum += s.rpe;
                rpeCount++;
              }
              totalSets++;
              return `Set${s.setNumber}: ${s.weight}lbs x ${s.reps}${s.rpe ? ` @RPE${s.rpe}` : ''}${s.completed ? '' : ' (FAILED)'}`;
            }).join(', ');

            text += `\n${date} — ${se.exerciseName}: ${setSummaries}`;
          }

          const avgRpe = rpeCount > 0 ? (rpeSum / rpeCount).toFixed(1) : 'N/A';
          text += `\n\nSummary: ${matching.length} sessions, ${totalSets} total sets.\n`;
          text += `Average RPE: ${avgRpe} (across ${rpeCount} sets with RPE data).\n`;

          queryResults.push({
            id: crypto.randomUUID(),
            role: 'system',
            content: text,
            timestamp: Date.now(),
          });
          results.push({ type: 'get_rpe_trend', success: true, summary: `RPE trend for "${exerciseName}": avg RPE ${avgRpe} across ${matching.length} sessions.` });
          break;
        }

        default:
          results.push({ type: action, success: false, summary: `Unknown action: ${action}` });
      }
    } catch (err: any) {
      results.push({ type: action, success: false, summary: `Error: ${err.message}` });
    }
  }

  return { results, queryResults: queryResults.length > 0 ? queryResults : undefined };
}

import { useCallback, useEffect, useState } from 'react';
import { db, type Session, type SessionExercise, type SetRecord, type SessionType } from '../db/database';

export function useSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await db.sessions.orderBy('date').reverse().toArray();
    setSessions(all);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getSession = useCallback((id: number) => db.sessions.get(id), []);

  const getSessionExercises = useCallback(
    async (sessionId: number) => db.sessionExercises.where('sessionId').equals(sessionId).toArray(),
    []
  );

  const getSessionsForPlan = useCallback(
    async (planId: number, limit = 10) =>
      db.sessions.where('planId').equals(planId).reverse().sortBy('date').then((r) => r.slice(0, limit)),
    []
  );

  const createSession = useCallback(
    async (session: Omit<Session, 'id'>) => {
      const id = await db.sessions.add(session as Session);
      await refresh();
      return id;
    },
    [refresh]
  );

  const completeSession = useCallback(
    async (id: number, feedback?: string) => {
      await db.sessions.update(id, { completedAt: new Date().toISOString(), feedback });
      await refresh();
    },
    [refresh]
  );

  const updateSession = useCallback(
    async (id: number, updates: Partial<Session>) => {
      await db.sessions.update(id, updates);
      await refresh();
    },
    [refresh]
  );

  const deleteSession = useCallback(
    async (id: number) => {
      await db.sessionExercises.where('sessionId').equals(id).delete();
      await db.sessions.delete(id);
      await refresh();
    },
    [refresh]
  );

  const addSessionExercise = useCallback(
    async (exercise: Omit<SessionExercise, 'id'>) => {
      await db.sessionExercises.add(exercise as SessionExercise);
    },
    []
  );

  const updateSetRecord = useCallback(
    async (sessionExerciseId: number, sets: SetRecord[]) => {
      await db.sessionExercises.update(sessionExerciseId, { sets });
    },
    []
  );

  const getLastSessionExercise = useCallback(
    async (exerciseId: number, beforeDate?: string): Promise<SessionExercise | null> => {
      const all = await db.sessionExercises
        .where('exerciseId')
        .equals(exerciseId)
        .toArray();

      if (all.length === 0) return null;

      // Join with sessions to get dates
      const sessionIds = [...new Set(all.map((se) => se.sessionId))];
      const relevantSessions = await db.sessions
        .where('id')
        .anyOf(sessionIds)
        .filter((s) => !beforeDate || s.date < beforeDate)
        .sortBy('date');

      if (relevantSessions.length === 0) return null;

      const lastSessionId = relevantSessions[relevantSessions.length - 1].id!;
      return all.find((se) => se.sessionId === lastSessionId) ?? null;
    },
    []
  );

  return {
    sessions,
    loading,
    refresh,
    getSession,
    getSessionExercises,
    getSessionsForPlan,
    createSession,
    completeSession,
    updateSession,
    deleteSession,
    addSessionExercise,
    updateSetRecord,
    getLastSessionExercise,
  };
}

export function createDefaultSets(setCount: number): SetRecord[] {
  return Array.from({ length: setCount }, (_, i) => ({
    setNumber: i + 1,
    reps: 0,
    weight: 0,
    completed: false,
  }));
}

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { WorkoutPlan, Exercise, Session, MuscleGroup, SessionExercise, Recommendation } from '../firebase/types';
import * as db from '../firebase';

interface AppContextValue {
  // Plans
  plans: WorkoutPlan[];
  plansLoading: boolean;
  getPlanForDay: (day: number) => WorkoutPlan | null;
  getPlanByName: (name: string) => WorkoutPlan | null;
  createPlan: (plan: Omit<WorkoutPlan, 'id'>) => Promise<string>;
  updatePlan: (id: string, updates: Partial<WorkoutPlan>) => Promise<void>;

  // Exercises
  exercises: Exercise[];
  exercisesLoading: boolean;
  addExercise: (name: string, category: MuscleGroup, defaultSets?: number, defaultReps?: number) => Promise<string>;

  // Sessions
  sessions: Session[];
  sessionsLoading: boolean;
  createSession: (s: Omit<Session, 'id'>) => Promise<string>;
  completeSession: (id: string, feedback?: string) => Promise<void>;
  updateSession: (id: string, updates: Partial<Session>) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  getSessionExercises: (sessionId: string) => Promise<SessionExercise[]>;
  addSessionExercise: (ex: Omit<SessionExercise, 'id'>) => Promise<string>;
  getLastSessionExercise: (exerciseId: string, beforeDate?: string) => Promise<{ sessionExercise: SessionExercise; sessionDate: string } | null>;
  refreshSessions: () => Promise<void>;

  // Recommendations
  recommendationsHook: RecommendationsHook;

  // Current active session
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;

  // Init
  initialized: boolean;
  userId: string;
}

export interface RecommendationsHook {
  recommendations: Recommendation[];
  refresh: () => Promise<void>;
  addRecommendation: (rec: Omit<Recommendation, 'id'>) => Promise<string>;
  acknowledgeRecommendation: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

// ─── Recommendations Hook (migrated from useRecommendations.ts) ──────

function useRecommendationsHook(userId: string): RecommendationsHook {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);

  const refresh = useCallback(async () => {
    const all = await db.getAllRecommendations(userId);
    setRecommendations(all);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const addRecommendation = useCallback(async (rec: Omit<Recommendation, 'id'>) => {
    const id = await db.addRecommendation(userId, rec);
    await refresh();
    return id;
  }, [userId, refresh]);

  const acknowledgeRecommendation = useCallback(async (id: string) => {
    await db.acknowledgeRecommendation(userId, id);
    await refresh();
  }, [userId, refresh]);

  return { recommendations, refresh, addRecommendation, acknowledgeRecommendation };
}

// ─── Provider ────────────────────────────────────────────────────────

export function AppProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const [initialized, setInitialized] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // State
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  const recommendationsHook = useRecommendationsHook(userId);

  // ─── Refresh helpers ──────────────────────────────────────────────

  const refreshPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlans(await db.getAllPlans(userId));
    setPlansLoading(false);
  }, [userId]);

  const refreshExercises = useCallback(async () => {
    setExercisesLoading(true);
    setExercises(await db.getAllExercises(userId));
    setExercisesLoading(false);
  }, [userId]);

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    setSessions(await db.getAllSessions(userId));
    setSessionsLoading(false);
  }, [userId]);

  // ─── Plans ────────────────────────────────────────────────────────

  const getPlanForDay = useCallback(
    (dayOfWeek: number) => plans.find(p => p.dayOfWeek === dayOfWeek) ?? null,
    [plans],
  );

  const getPlanByName = useCallback(
    (name: string) => plans.find(p => p.name.toLowerCase() === name.toLowerCase()) ?? null,
    [plans],
  );

  const createPlan = useCallback(async (plan: Omit<WorkoutPlan, 'id'>) => {
    const id = await db.createPlan(userId, plan);
    await refreshPlans();
    return id;
  }, [userId, refreshPlans]);

  const updatePlanCtx = useCallback(async (id: string, updates: Partial<WorkoutPlan>) => {
    await db.updatePlan(userId, id, updates);
    await refreshPlans();
  }, [userId, refreshPlans]);

  // ─── Exercises ────────────────────────────────────────────────────

  const addExercise = useCallback(async (name: string, category: MuscleGroup, defaultSets = 3, defaultReps = 10) => {
    const id = await db.addExercise(userId, name, category, defaultSets, defaultReps);
    await refreshExercises();
    return id;
  }, [userId, refreshExercises]);

  // ─── Sessions ─────────────────────────────────────────────────────

  const createSession = useCallback(async (s: Omit<Session, 'id'>) => {
    const id = await db.createSession(userId, s);
    await refreshSessions();
    return id;
  }, [userId, refreshSessions]);

  const completeSession = useCallback(async (id: string, feedback?: string) => {
    await db.completeSession(userId, id, feedback);
    await refreshSessions();
  }, [userId, refreshSessions]);

  const updateSessionCtx = useCallback(async (id: string, updates: Partial<Session>) => {
    await db.updateSession(userId, id, updates);
    await refreshSessions();
  }, [userId, refreshSessions]);

  const deleteSessionCtx = useCallback(async (id: string) => {
    await db.deleteSession(userId, id);
    await refreshSessions();
  }, [userId, refreshSessions]);

  const getSessionExercisesCtx = useCallback(
    (sessionId: string) => db.getSessionExercises(userId, sessionId),
    [userId],
  );

  const addSessionExerciseCtx = useCallback(async (ex: Omit<SessionExercise, 'id'>) => {
    const id = await db.addSessionExercise(userId, ex.sessionId, ex);
    return id;
  }, [userId]);

  const getLastSessionExerciseCtx = useCallback(
    (exerciseId: string, beforeDate?: string) => db.getLastSessionExercise(userId, exerciseId, beforeDate),
    [userId],
  );

  // ─── Init ─────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      await Promise.all([refreshPlans(), refreshExercises(), refreshSessions()]);
      setInitialized(true);
    })();
  }, [userId, refreshPlans, refreshExercises, refreshSessions]);

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <AppContext.Provider
      value={{
        plans, plansLoading, getPlanForDay, getPlanByName, createPlan, updatePlan: updatePlanCtx,
        exercises, exercisesLoading, addExercise,
        sessions, sessionsLoading, createSession, completeSession, updateSession: updateSessionCtx, deleteSession: deleteSessionCtx,
        getSessionExercises: getSessionExercisesCtx, addSessionExercise: addSessionExerciseCtx,
        getLastSessionExercise: getLastSessionExerciseCtx, refreshSessions,
        recommendationsHook,
        activeSessionId, setActiveSessionId,
        initialized,
        userId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

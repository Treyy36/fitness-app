import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { db, type WorkoutPlan, type Exercise, type Session } from '../db/database';
import { seedDatabase } from '../db/seed';
import { useWorkoutPlans, useExercises } from '../hooks/useWorkoutPlans';
import { useSessions } from '../hooks/useSessions';
import { useRecommendations } from '../hooks/useRecommendations';

interface AppContextValue {
  // Plans
  plans: WorkoutPlan[];
  plansLoading: boolean;
  getPlanForDay: (day: number) => WorkoutPlan | null;
  getPlanByName: (name: string) => WorkoutPlan | null;
  createPlan: (plan: Omit<WorkoutPlan, 'id'>) => Promise<number>;
  updatePlan: (id: number, updates: Partial<WorkoutPlan>) => Promise<void>;

  // Exercises
  exercises: Exercise[];
  exercisesLoading: boolean;

  // Sessions
  sessions: Session[];
  sessionsLoading: boolean;
  createSession: (s: Omit<Session, 'id'>) => Promise<number>;
  completeSession: (id: number, feedback?: string) => Promise<void>;
  getSessionExercises: (sessionId: number) => ReturnType<ReturnType<typeof useSessions>['getSessionExercises']>;
  addSessionExercise: ReturnType<typeof useSessions>['addSessionExercise'];
  getLastSessionExercise: ReturnType<typeof useSessions>['getLastSessionExercise'];
  refreshSessions: () => Promise<void>;

  // Recommendations
  recommendationsHook: ReturnType<typeof useRecommendations>;

  // Current active session
  activeSessionId: number | null;
  setActiveSessionId: (id: number | null) => void;

  // Init
  initialized: boolean;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);

  const { plans, loading: plansLoading, getPlanForDay, getPlanByName, createPlan, updatePlan, refresh: refreshPlans } = useWorkoutPlans();
  const { exercises, loading: exercisesLoading, refresh: refreshExercises } = useExercises();
  const { sessions, loading: sessionsLoading, createSession, completeSession, getSessionExercises, addSessionExercise, getLastSessionExercise, refresh: refreshSessions } = useSessions();
  const recommendationsHook = useRecommendations();

  // Seed and initialize — refresh hooks after seeding to pick up the data
  useEffect(() => {
    (async () => {
      await seedDatabase();
      await Promise.all([refreshPlans(), refreshExercises(), refreshSessions()]);
      setInitialized(true);
    })();
  }, []);

  return (
    <AppContext.Provider
      value={{
        plans, plansLoading, getPlanForDay, getPlanByName, createPlan, updatePlan,
        exercises, exercisesLoading,
        sessions, sessionsLoading, createSession, completeSession, getSessionExercises,
        addSessionExercise, getLastSessionExercise, refreshSessions,
        recommendationsHook,
        activeSessionId, setActiveSessionId,
        initialized,
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

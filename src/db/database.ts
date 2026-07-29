import Dexie, { type EntityTable } from 'dexie';

// --- Type Definitions ---

export interface Exercise {
  id?: number;
  name: string;
  category: MuscleGroup;
  defaultSets: number;
  defaultReps: number;
  notes?: string;
}

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'abs'
  | 'other';

export interface WorkoutPlanExercise {
  exerciseId: number;
  sets: number;
  reps: number;
  notes?: string;
}

export interface WorkoutPlan {
  id?: number;
  name: string;
  dayOfWeek?: number; // 0=Sun, 1=Mon, ... 6=Sat. undefined = not day-locked
  exercises: WorkoutPlanExercise[];
  createdAt: string;
}

export interface SetRecord {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
  rpe?: number; // Rate of Perceived Exertion (1-10)
}

export interface SessionExercise {
  id?: number;
  sessionId: number;
  exerciseId: number;
  exerciseName: string;
  sets: SetRecord[];
}

export interface Session {
  id?: number;
  planId?: number;
  planName?: string;
  date: string; // ISO date
  completedAt?: string;
  notes?: string;
  feedback?: string; // user's post-workout freeform notes
}

export interface Recommendation {
  id?: number;
  sessionId?: number;
  type: 'weight_increase' | 'weight_decrease' | 'exercise_swap' | 'rest_more' | 'form_tip' | 'general';
  exercise?: string;
  message: string;
  action?: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface UserPreference {
  id?: number;
  key: string;
  value: string;
}

// --- Database ---

export class FitnessDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  workoutPlans!: EntityTable<WorkoutPlan, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sessionExercises!: EntityTable<SessionExercise, 'id'>;
  recommendations!: EntityTable<Recommendation, 'id'>;
  userPreferences!: EntityTable<UserPreference, 'id'>;

  constructor() {
    super('FitnessDB');

    this.version(1).stores({
      exercises: '++id, name, category',
      workoutPlans: '++id, name, dayOfWeek',
      sessions: '++id, planId, date',
      sessionExercises: '++id, sessionId, exerciseId',
      recommendations: '++id, sessionId, type, createdAt',
      userPreferences: '++id, &key',
    });
  }
}

export const db = new FitnessDB();

/** Safely upsert a user preference by key. Uses the existing record's id if present. */
export async function upsertPreference(key: string, value: string): Promise<void> {
  const existing = await db.userPreferences.where('key').equals(key).first();
  if (existing && existing.id !== undefined) {
    await db.userPreferences.update(existing.id, { value });
  } else {
    await db.userPreferences.add({ key, value });
  }
}

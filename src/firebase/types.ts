// Firestore document types — migrated from Dexie, all IDs are strings
// Path: src/firebase/types.ts

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'abs' | 'other';

// ─── Exercise Catalog ───────────────────────────────────────

export interface Exercise {
  id: string;
  name: string;
  category: MuscleGroup;
  defaultSets: number;
  defaultReps: number;
  prWeight?: number;          // heaviest weight at defaultSets × defaultReps
  prDate?: string;            // ISO date when PR was set
  notes?: string;
}

// ─── Workout Plans (templates) ──────────────────────────────

export interface WorkoutPlanExercise {
  exerciseId: string;         // → exercises/{id}
  targetSets: number;         // planned sets
  targetReps: number;         // planned reps
  notes?: string;
}

export interface WorkoutPlan {
  id: string;
  name: string;
  dayOfWeek?: number;         // 0=Sun…6=Sat, undefined = unscheduled
  exercises: WorkoutPlanExercise[];  // embedded array
  createdAt: string;
}

// ─── Sessions (completed workouts) ──────────────────────────

export type SessionType = 'standard' | 'test' | 'deload';

export interface Session {
  id: string;
  planId?: string;            // → workoutPlans/{id}
  planName?: string;          // snapshot at session time
  date: string;               // ISO date "2026-08-05"
  completedAt?: string;       // ISO timestamp
  notes?: string;
  feedback?: string;          // post-workout freeform
  sessionType?: SessionType;
  /** Exercise substitutions made during this session (planned → actual). */
  substitutions?: SubstitutionRecord[];
}

export interface SubstitutionRecord {
  planned: string;   // exercise name from the plan template
  actual: string;    // exercise name actually performed
  reason?: string;   // why the substitution was made
}

// ─── Session Exercises (subcollection under sessions) ───────

export interface SetRecord {
  setNumber: number;
  reps: number;               // actual reps performed
  weight: number;             // actual weight used
  completed: boolean;         // hit target reps?
  rpe?: number;               // Rate of Perceived Exertion (1-10)
}

export interface SessionExercise {
  id: string;
  sessionId: string;          // → sessions/{id}
  exerciseId: string;         // → exercises/{id}
  exerciseName: string;       // snapshot (survives catalog renames)
  sets: SetRecord[];
}

// ─── Session Logging Result (verbose verification) ──────────

export interface SetWriteResult {
  setNumber: number;
  reps: number;
  weight: number;
  completed: boolean;
  rpe?: number;
}

export interface ExerciseWriteResult {
  exerciseDocId: string;      // Firestore doc ID in the sessionExercises subcollection
  exerciseCatalogId: string;  // → exercises/{id} (empty string if not in catalog)
  exerciseName: string;
  sets: SetWriteResult[];
}

export interface LogSessionResult {
  sessionId: string;
  planName: string;
  planId?: string;
  date: string;
  completedAt: string;
  sessionType: SessionType;
  feedback?: string;
  substitutions?: SubstitutionRecord[];
  exercises: ExerciseWriteResult[];
  exerciseCount: number;
  totalSets: number;
  /** True if all exercises matched catalog entries and all sets were written. */
  verified: boolean;
}

// ─── Recommendations ────────────────────────────────────────

export interface Recommendation {
  id: string;
  sessionId?: string;
  type: 'weight_increase' | 'weight_decrease' | 'exercise_swap'
      | 'rest_more' | 'form_tip' | 'general';
  exercise?: string;
  message: string;
  action?: string;
  acknowledged: boolean;
  createdAt: string;
}

// ─── Tracking ───────────────────────────────────────────────

export interface BodyWeightLog {
  id: string;
  date: string;
  weight: number;
  notes?: string;
}

export interface MacroLog {
  id: string;
  date: string;
  description: string;        // "Chicken, rice, broccoli"
  protein: number;
  carbs: number;
  fat: number;
  calories?: number;
  notes?: string;
}

// ─── Preferences & Capabilities ─────────────────────────────

export interface UserPreference {
  id: string;
  key: string;                // unique per user (e.g., "deepseekApiKey")
  value: string;
}

export interface CapabilityRequest {
  id: string;
  title: string;
  description: string;
  problem: string;
  blockedFeature: string;
  suggestedTools: string[];
  priority: 'blocking' | 'enhancement' | 'nice_to_have';
  conversationContext: string;
  status: 'pending' | 'approved' | 'building' | 'deployed' | 'dismissed';
  createdAt: string;
  deployedAt?: string;
}
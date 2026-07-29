import { db, type MuscleGroup, type WorkoutPlan } from './database';

// --- Exercise Catalog ---

interface SeedExercise {
  name: string;
  category: MuscleGroup;
  defaultSets: number;
  defaultReps: number;
  notes?: string;
}

export const EXERCISE_CATALOG: SeedExercise[] = [
  // Chest
  { name: 'Barbell Bench Press', category: 'chest', defaultSets: 4, defaultReps: 8, notes: 'Flat bench' },
  { name: 'Dumbbell Bench Press', category: 'chest', defaultSets: 4, defaultReps: 10 },
  { name: 'Incline Barbell Bench Press', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Incline Dumbbell Press', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Cable Flyes', category: 'chest', defaultSets: 3, defaultReps: 12 },
  { name: 'Dumbbell Flyes', category: 'chest', defaultSets: 3, defaultReps: 12 },
  { name: 'Dips (Chest Focus)', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Push-Ups', category: 'chest', defaultSets: 3, defaultReps: 15 },

  // Back
  { name: 'Barbell Row', category: 'back', defaultSets: 4, defaultReps: 8 },
  { name: 'Dumbbell Row', category: 'back', defaultSets: 4, defaultReps: 10 },
  { name: 'Pull-Ups', category: 'back', defaultSets: 3, defaultReps: 8 },
  { name: 'Lat Pulldown', category: 'back', defaultSets: 4, defaultReps: 10 },
  { name: 'Seated Cable Row', category: 'back', defaultSets: 3, defaultReps: 12 },
  { name: 'Face Pulls', category: 'back', defaultSets: 3, defaultReps: 15 },
  { name: 'Deadlift', category: 'back', defaultSets: 3, defaultReps: 5 },
  { name: 'T-Bar Row', category: 'back', defaultSets: 3, defaultReps: 10 },

  // Shoulders
  { name: 'Overhead Press (Barbell)', category: 'shoulders', defaultSets: 4, defaultReps: 8 },
  { name: 'Overhead Press (Dumbbell)', category: 'shoulders', defaultSets: 4, defaultReps: 10 },
  { name: 'Lateral Raise', category: 'shoulders', defaultSets: 4, defaultReps: 15 },
  { name: 'Front Raise', category: 'shoulders', defaultSets: 3, defaultReps: 12 },
  { name: 'Rear Delt Flye', category: 'shoulders', defaultSets: 3, defaultReps: 15 },
  { name: 'Arnold Press', category: 'shoulders', defaultSets: 3, defaultReps: 10 },

  // Biceps
  { name: 'Barbell Curl', category: 'biceps', defaultSets: 3, defaultReps: 10 },
  { name: 'Dumbbell Curl', category: 'biceps', defaultSets: 3, defaultReps: 12 },
  { name: 'Hammer Curl', category: 'biceps', defaultSets: 3, defaultReps: 12 },
  { name: 'Preacher Curl', category: 'biceps', defaultSets: 3, defaultReps: 10 },
  { name: 'Incline Dumbbell Curl', category: 'biceps', defaultSets: 3, defaultReps: 12 },

  // Triceps
  { name: 'Close-Grip Bench Press', category: 'triceps', defaultSets: 3, defaultReps: 10 },
  { name: 'Tricep Pushdown', category: 'triceps', defaultSets: 3, defaultReps: 12 },
  { name: 'Overhead Tricep Extension', category: 'triceps', defaultSets: 3, defaultReps: 12 },
  { name: 'Skull Crushers', category: 'triceps', defaultSets: 3, defaultReps: 10 },
  { name: 'Dips (Tricep Focus)', category: 'triceps', defaultSets: 3, defaultReps: 10 },

  // Quads
  { name: 'Barbell Squat', category: 'quads', defaultSets: 4, defaultReps: 8 },
  { name: 'Front Squat', category: 'quads', defaultSets: 3, defaultReps: 8 },
  { name: 'Leg Press', category: 'quads', defaultSets: 4, defaultReps: 10 },
  { name: 'Leg Extension', category: 'quads', defaultSets: 3, defaultReps: 12 },
  { name: 'Bulgarian Split Squat', category: 'quads', defaultSets: 3, defaultReps: 10 },
  { name: 'Walking Lunges', category: 'quads', defaultSets: 3, defaultReps: 12 },

  // Hamstrings
  { name: 'Romanian Deadlift', category: 'hamstrings', defaultSets: 3, defaultReps: 10 },
  { name: 'Lying Leg Curl', category: 'hamstrings', defaultSets: 3, defaultReps: 12 },
  { name: 'Seated Leg Curl', category: 'hamstrings', defaultSets: 3, defaultReps: 12 },
  { name: 'Nordic Hamstring Curl', category: 'hamstrings', defaultSets: 3, defaultReps: 8 },

  // Glutes
  { name: 'Hip Thrust', category: 'glutes', defaultSets: 3, defaultReps: 10 },
  { name: 'Glute Kickback', category: 'glutes', defaultSets: 3, defaultReps: 12 },
  { name: 'Cable Pull-Through', category: 'glutes', defaultSets: 3, defaultReps: 12 },

  // Calves
  { name: 'Standing Calf Raise', category: 'calves', defaultSets: 4, defaultReps: 15 },
  { name: 'Seated Calf Raise', category: 'calves', defaultSets: 3, defaultReps: 15 },

  // Abs
  { name: 'Plank', category: 'abs', defaultSets: 3, defaultReps: 60, notes: 'Seconds' },
  { name: 'Hanging Leg Raise', category: 'abs', defaultSets: 3, defaultReps: 12 },
  { name: 'Cable Crunch', category: 'abs', defaultSets: 3, defaultReps: 15 },
  { name: 'Ab Wheel Rollout', category: 'abs', defaultSets: 3, defaultReps: 10 },

  // Other
  { name: 'Barbell Shrugs', category: 'other', defaultSets: 3, defaultReps: 12 },
];

// --- Workout Plan Templates ---

function findExerciseId(name: string, catalog: SeedExercise[]): number {
  const idx = catalog.findIndex((e) => e.name === name);
  return idx + 1; // Dexie auto-increment starts at 1
}

export async function seedDatabase(): Promise<void> {
  const existing = await db.exercises.count();
  if (existing > 0) return; // Already seeded

  // Seed exercises
  await db.exercises.bulkAdd(EXERCISE_CATALOG);

  // Get IDs for template exercises
  const exercises = await db.exercises.toArray();
  const eid = (name: string) => exercises.find((e) => e.name === name)?.id ?? 1;

  const now = new Date().toISOString();

  // Push A (Chest, Shoulders, Triceps) — Monday
  const pushA: WorkoutPlan = {
    name: 'Push A',
    dayOfWeek: 1,
    exercises: [
      { exerciseId: eid('Barbell Bench Press'), sets: 4, reps: 8 },
      { exerciseId: eid('Incline Dumbbell Press'), sets: 3, reps: 10 },
      { exerciseId: eid('Overhead Press (Barbell)'), sets: 4, reps: 8 },
      { exerciseId: eid('Lateral Raise'), sets: 4, reps: 15 },
      { exerciseId: eid('Tricep Pushdown'), sets: 3, reps: 12 },
      { exerciseId: eid('Overhead Tricep Extension'), sets: 3, reps: 12 },
    ],
    createdAt: now,
  };

  // Pull A (Back, Biceps) — Tuesday
  const pullA: WorkoutPlan = {
    name: 'Pull A',
    dayOfWeek: 2,
    exercises: [
      { exerciseId: eid('Deadlift'), sets: 3, reps: 5 },
      { exerciseId: eid('Barbell Row'), sets: 4, reps: 8 },
      { exerciseId: eid('Lat Pulldown'), sets: 4, reps: 10 },
      { exerciseId: eid('Seated Cable Row'), sets: 3, reps: 12 },
      { exerciseId: eid('Face Pulls'), sets: 3, reps: 15 },
      { exerciseId: eid('Barbell Curl'), sets: 3, reps: 10 },
      { exerciseId: eid('Hammer Curl'), sets: 3, reps: 12 },
    ],
    createdAt: now,
  };

  // Legs A (Quads, Hamstrings, Glutes, Calves) — Wednesday
  const legsA: WorkoutPlan = {
    name: 'Legs A',
    dayOfWeek: 3,
    exercises: [
      { exerciseId: eid('Barbell Squat'), sets: 4, reps: 8 },
      { exerciseId: eid('Romanian Deadlift'), sets: 3, reps: 10 },
      { exerciseId: eid('Leg Press'), sets: 4, reps: 10 },
      { exerciseId: eid('Leg Extension'), sets: 3, reps: 12 },
      { exerciseId: eid('Lying Leg Curl'), sets: 3, reps: 12 },
      { exerciseId: eid('Standing Calf Raise'), sets: 4, reps: 15 },
    ],
    createdAt: now,
  };

  // Push B — Thursday
  const pushB: WorkoutPlan = {
    name: 'Push B',
    dayOfWeek: 4,
    exercises: [
      { exerciseId: eid('Overhead Press (Dumbbell)'), sets: 4, reps: 10 },
      { exerciseId: eid('Dumbbell Bench Press'), sets: 4, reps: 10 },
      { exerciseId: eid('Incline Barbell Bench Press'), sets: 3, reps: 10 },
      { exerciseId: eid('Arnold Press'), sets: 3, reps: 10 },
      { exerciseId: eid('Cable Flyes'), sets: 3, reps: 12 },
      { exerciseId: eid('Skull Crushers'), sets: 3, reps: 10 },
    ],
    createdAt: now,
  };

  // Pull B — Friday
  const pullB: WorkoutPlan = {
    name: 'Pull B',
    dayOfWeek: 5,
    exercises: [
      { exerciseId: eid('Pull-Ups'), sets: 3, reps: 8 },
      { exerciseId: eid('Dumbbell Row'), sets: 4, reps: 10 },
      { exerciseId: eid('T-Bar Row'), sets: 3, reps: 10 },
      { exerciseId: eid('Rear Delt Flye'), sets: 3, reps: 15 },
      { exerciseId: eid('Barbell Shrugs'), sets: 3, reps: 12 },
      { exerciseId: eid('Preacher Curl'), sets: 3, reps: 10 },
      { exerciseId: eid('Incline Dumbbell Curl'), sets: 3, reps: 12 },
    ],
    createdAt: now,
  };

  // Legs B — Saturday
  const legsB: WorkoutPlan = {
    name: 'Legs B',
    dayOfWeek: 6,
    exercises: [
      { exerciseId: eid('Front Squat'), sets: 3, reps: 8 },
      { exerciseId: eid('Hip Thrust'), sets: 3, reps: 10 },
      { exerciseId: eid('Bulgarian Split Squat'), sets: 3, reps: 10 },
      { exerciseId: eid('Walking Lunges'), sets: 3, reps: 12 },
      { exerciseId: eid('Seated Leg Curl'), sets: 3, reps: 12 },
      { exerciseId: eid('Seated Calf Raise'), sets: 3, reps: 15 },
      { exerciseId: eid('Hanging Leg Raise'), sets: 3, reps: 12 },
    ],
    createdAt: now,
  };

  await db.workoutPlans.bulkAdd([pushA, pullA, legsA, pushB, pullB, legsB]);

  console.log('[Seed] Database seeded with exercises and PPL workout plans');
}

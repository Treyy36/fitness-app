import { db, type WorkoutPlan, type MuscleGroup, type Session, type SessionExercise, type SetRecord } from './database';

// --- Planet Fitness Exercise Catalog ---

interface SeedExercise {
  name: string;
  category: MuscleGroup;
  defaultSets: number;
  defaultReps: number;
  notes?: string;
}

export const EXERCISE_CATALOG: SeedExercise[] = [
  // Push exercises
  { name: 'Machine Chest Press', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Incline Dumbbell Press', category: 'chest', defaultSets: 3, defaultReps: 10 },
  { name: 'Pec Deck', category: 'chest', defaultSets: 3, defaultReps: 12 },
  { name: 'Machine Shoulder Press', category: 'shoulders', defaultSets: 3, defaultReps: 10 },
  { name: 'Lateral Raise', category: 'shoulders', defaultSets: 3, defaultReps: 15 },
  { name: 'Cable Triceps Pushdown', category: 'triceps', defaultSets: 3, defaultReps: 12 },

  // Pull exercises
  { name: 'Lat Pulldown', category: 'back', defaultSets: 3, defaultReps: 10 },
  { name: 'Standalone Seated Row', category: 'back', defaultSets: 3, defaultReps: 10 },
  { name: 'Rear Delt Fly', category: 'shoulders', defaultSets: 3, defaultReps: 12 },
  { name: 'Hammer Curl', category: 'biceps', defaultSets: 3, defaultReps: 10 },
  { name: 'Dumbbell Curl', category: 'biceps', defaultSets: 3, defaultReps: 10 },
  { name: 'Cable Curl', category: 'biceps', defaultSets: 3, defaultReps: 10 },

  // Leg exercises
  { name: 'Leg Press', category: 'quads', defaultSets: 3, defaultReps: 10 },
  { name: 'Seated Leg Curl', category: 'hamstrings', defaultSets: 3, defaultReps: 10 },
  { name: 'Leg Extension', category: 'quads', defaultSets: 3, defaultReps: 12 },
  { name: 'Romanian Deadlift', category: 'hamstrings', defaultSets: 3, defaultReps: 10 },
  { name: 'Calf Raise Machine', category: 'calves', defaultSets: 3, defaultReps: 15 },
];

// --- Helpers ---

function eid(exercises: { id?: number; name: string }[], name: string): number {
  return exercises.find((e) => e.name === name)?.id ?? 1;
}

function makeSets(count: number, weight: number, reps: number): SetRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    setNumber: i + 1,
    reps,
    weight,
    completed: true,
  }));
}

function daysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

// --- Seed All Data ---

export async function seedDatabase(): Promise<void> {
  const existing = await db.exercises.count();
  if (existing > 0) return;

  // 1. Seed exercises
  await db.exercises.bulkAdd(EXERCISE_CATALOG);
  const exercises = await db.exercises.toArray();
  const now = new Date().toISOString();

  // 2. Create workout plans matching the athlete's split
  const pushA: WorkoutPlan = {
    name: 'Push A',
    dayOfWeek: 1,
    exercises: [
      { exerciseId: eid(exercises, 'Machine Chest Press'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Incline Dumbbell Press'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Machine Shoulder Press'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Pec Deck'), sets: 3, reps: 12 },
      { exerciseId: eid(exercises, 'Lateral Raise'), sets: 3, reps: 15 },
      { exerciseId: eid(exercises, 'Cable Triceps Pushdown'), sets: 3, reps: 12 },
    ],
    createdAt: now,
  };

  const pullA: WorkoutPlan = {
    name: 'Pull A',
    dayOfWeek: 2,
    exercises: [
      { exerciseId: eid(exercises, 'Lat Pulldown'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Standalone Seated Row'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Rear Delt Fly'), sets: 3, reps: 12 },
      { exerciseId: eid(exercises, 'Hammer Curl'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Dumbbell Curl'), sets: 3, reps: 10 },
    ],
    createdAt: now,
  };

  const legs: WorkoutPlan = {
    name: 'Legs',
    dayOfWeek: 3,
    exercises: [
      { exerciseId: eid(exercises, 'Leg Press'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Seated Leg Curl'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Leg Extension'), sets: 3, reps: 12 },
      { exerciseId: eid(exercises, 'Romanian Deadlift'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Calf Raise Machine'), sets: 3, reps: 15 },
    ],
    createdAt: now,
  };

  const pushB: WorkoutPlan = {
    name: 'Push B',
    dayOfWeek: 4,
    exercises: [
      { exerciseId: eid(exercises, 'Machine Chest Press'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Machine Shoulder Press'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Incline Dumbbell Press'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Pec Deck'), sets: 3, reps: 12 },
      { exerciseId: eid(exercises, 'Lateral Raise'), sets: 3, reps: 15 },
      { exerciseId: eid(exercises, 'Cable Triceps Pushdown'), sets: 3, reps: 12 },
    ],
    createdAt: now,
  };

  const pullB: WorkoutPlan = {
    name: 'Pull B',
    dayOfWeek: 5,
    exercises: [
      { exerciseId: eid(exercises, 'Lat Pulldown'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Standalone Seated Row'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Rear Delt Fly'), sets: 3, reps: 12 },
      { exerciseId: eid(exercises, 'Hammer Curl'), sets: 3, reps: 10 },
      { exerciseId: eid(exercises, 'Dumbbell Curl'), sets: 3, reps: 10 },
    ],
    createdAt: now,
  };

  await db.workoutPlans.bulkAdd([pushA, pullA, legs, pushB, pullB]);

  // 3. Seed workout history (6 sessions)

  // --- Week 2 Push A ---
  let sid = await db.sessions.add({
    planName: 'Push A',
    date: daysAgo(14),
    completedAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    feedback: 'Machine Chest Press 70 too easy → increase to 80. Shoulder Press reduced from 50 to 40. Triceps Pushdown reduced from 40 to 20.',
  } as Session);
  await db.sessionExercises.bulkAdd([
    { sessionId: sid, exerciseId: eid(exercises, 'Machine Chest Press'), exerciseName: 'Machine Chest Press', sets: makeSets(3, 70, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Incline Dumbbell Press'), exerciseName: 'Incline Dumbbell Press', sets: makeSets(3, 25, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Machine Shoulder Press'), exerciseName: 'Machine Shoulder Press', sets: makeSets(3, 40, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Pec Deck'), exerciseName: 'Pec Deck', sets: [
      { setNumber: 1, reps: 15, weight: 60, completed: true },
      { setNumber: 2, reps: 13, weight: 60, completed: true },
      { setNumber: 3, reps: 12, weight: 60, completed: true },
    ]},
    { sessionId: sid, exerciseId: eid(exercises, 'Lateral Raise'), exerciseName: 'Lateral Raise', sets: makeSets(3, 10, 15) },
    { sessionId: sid, exerciseId: eid(exercises, 'Cable Triceps Pushdown'), exerciseName: 'Cable Triceps Pushdown', sets: [
      { setNumber: 1, reps: 12, weight: 20, completed: true },
      { setNumber: 2, reps: 11, weight: 20, completed: true },
      { setNumber: 3, reps: 10, weight: 20, completed: true },
    ]},
  ] as SessionExercise[]);

  // --- Week 2 Pull A ---
  sid = await db.sessions.add({
    planName: 'Pull A',
    date: daysAgo(13),
    completedAt: new Date(Date.now() - 13 * 86400000).toISOString(),
    feedback: 'Lat Pulldown 70 & Seated Row 70 too easy → increase to 85. Rear Delt Fly challenging at 50. Hammer Curl & Cable Curl working weight 15.',
  } as Session);
  await db.sessionExercises.bulkAdd([
    { sessionId: sid, exerciseId: eid(exercises, 'Lat Pulldown'), exerciseName: 'Lat Pulldown', sets: makeSets(3, 70, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Standalone Seated Row'), exerciseName: 'Standalone Seated Row', sets: makeSets(3, 70, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Rear Delt Fly'), exerciseName: 'Rear Delt Fly', sets: [
      { setNumber: 1, reps: 10, weight: 50, completed: true },
      { setNumber: 2, reps: 8, weight: 50, completed: false },
      { setNumber: 3, reps: 8, weight: 50, completed: false },
    ]},
    { sessionId: sid, exerciseId: eid(exercises, 'Hammer Curl'), exerciseName: 'Hammer Curl', sets: makeSets(3, 15, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Cable Curl'), exerciseName: 'Cable Curl', sets: makeSets(3, 15, 10) },
  ] as SessionExercise[]);

  // --- Week 2 Push B ---
  sid = await db.sessions.add({
    planName: 'Push B',
    date: daysAgo(11),
    completedAt: new Date(Date.now() - 11 * 86400000).toISOString(),
    feedback: 'All felt good. Pec Deck skipped due to appointment.',
  } as Session);
  await db.sessionExercises.bulkAdd([
    { sessionId: sid, exerciseId: eid(exercises, 'Machine Chest Press'), exerciseName: 'Machine Chest Press', sets: makeSets(3, 80, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Machine Shoulder Press'), exerciseName: 'Machine Shoulder Press', sets: makeSets(3, 40, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Incline Dumbbell Press'), exerciseName: 'Incline Dumbbell Press', sets: makeSets(3, 25, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Lateral Raise'), exerciseName: 'Lateral Raise', sets: makeSets(3, 10, 15) },
    { sessionId: sid, exerciseId: eid(exercises, 'Cable Triceps Pushdown'), exerciseName: 'Cable Triceps Pushdown', sets: makeSets(3, 20, 12) },
  ] as SessionExercise[]);

  // --- Week 3 Pull A ---
  sid = await db.sessions.add({
    planName: 'Pull A',
    date: daysAgo(6),
    completedAt: new Date(Date.now() - 6 * 86400000).toISOString(),
    feedback: 'Lat Pulldown 85 and Seated Row 85 felt good. Dumbbell Curl reduced to 10 lb for perfect form — slow eccentric, squeeze at top.',
  } as Session);
  await db.sessionExercises.bulkAdd([
    { sessionId: sid, exerciseId: eid(exercises, 'Lat Pulldown'), exerciseName: 'Lat Pulldown', sets: makeSets(3, 85, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Standalone Seated Row'), exerciseName: 'Standalone Seated Row', sets: makeSets(3, 85, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Rear Delt Fly'), exerciseName: 'Rear Delt Fly', sets: makeSets(3, 50, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Hammer Curl'), exerciseName: 'Hammer Curl', sets: makeSets(3, 15, 10) },
    { sessionId: sid, exerciseId: eid(exercises, 'Dumbbell Curl'), exerciseName: 'Dumbbell Curl', sets: makeSets(3, 10, 10) },
  ] as SessionExercise[]);

  // --- Week 3 Legs ---
  sid = await db.sessions.add({
    planName: 'Legs',
    date: daysAgo(5),
    completedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    feedback: 'First logged leg day. Leg Press 180 with burnout set of 20 → increase to 210. Seated Leg Curl 55 working weight. Calf raises skipped.',
  } as Session);
  await db.sessionExercises.bulkAdd([
    { sessionId: sid, exerciseId: eid(exercises, 'Leg Press'), exerciseName: 'Leg Press', sets: [
      { setNumber: 1, reps: 10, weight: 180, completed: true },
      { setNumber: 2, reps: 10, weight: 180, completed: true },
      { setNumber: 3, reps: 20, weight: 180, completed: true },
    ]},
    { sessionId: sid, exerciseId: eid(exercises, 'Seated Leg Curl'), exerciseName: 'Seated Leg Curl', sets: [
      { setNumber: 1, reps: 10, weight: 50, completed: true },
      { setNumber: 2, reps: 10, weight: 55, completed: true },
      { setNumber: 3, reps: 10, weight: 55, completed: true },
    ]},
    { sessionId: sid, exerciseId: eid(exercises, 'Leg Extension'), exerciseName: 'Leg Extension', sets: [
      { setNumber: 1, reps: 12, weight: 50, completed: true },
      { setNumber: 2, reps: 12, weight: 50, completed: true },
      { setNumber: 3, reps: 10, weight: 50, completed: true },
    ]},
    { sessionId: sid, exerciseId: eid(exercises, 'Romanian Deadlift'), exerciseName: 'Romanian Deadlift', sets: makeSets(3, 25, 10) },
  ] as SessionExercise[]);

  console.log('[Seed] Planet Fitness exercises, PPL split, and 6-session history seeded');
}

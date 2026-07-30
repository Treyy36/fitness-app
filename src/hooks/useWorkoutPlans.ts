import { useCallback, useEffect, useState } from 'react';
import { db, type WorkoutPlan, type Exercise, type WorkoutPlanExercise, type MuscleGroup } from '../db/database';

export function useWorkoutPlans() {
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const all = await db.workoutPlans.toArray();
    setPlans(all);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getPlan = useCallback((id: number) => db.workoutPlans.get(id), []);

  const getPlanForDay = useCallback(
    (dayOfWeek: number) => plans.find((p) => p.dayOfWeek === dayOfWeek) ?? null,
    [plans]
  );

  const getPlanByName = useCallback(
    (name: string) => plans.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null,
    [plans]
  );

  const createPlan = useCallback(
    async (plan: Omit<WorkoutPlan, 'id'>) => {
      const id = await db.workoutPlans.add(plan as WorkoutPlan);
      await refresh();
      return id;
    },
    [refresh]
  );

  const updatePlan = useCallback(
    async (id: number, updates: Partial<WorkoutPlan>) => {
      await db.workoutPlans.update(id, updates);
      await refresh();
    },
    [refresh]
  );

  const deletePlan = useCallback(
    async (id: number) => {
      await db.workoutPlans.delete(id);
      await refresh();
    },
    [refresh]
  );

  return { plans, loading, refresh, getPlan, getPlanForDay, getPlanByName, createPlan, updatePlan, deletePlan };
}

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await db.exercises.toArray();
    setExercises(all);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const getExercise = useCallback((id: number) => db.exercises.get(id), []);

  const getByIds = useCallback(
    (ids: number[]) => exercises.filter((e) => e.id !== undefined && ids.includes(e.id)),
    [exercises]
  );

  const addExercise = useCallback(
    async (name: string, category: MuscleGroup, defaultSets = 3, defaultReps = 10) => {
      const id = await db.exercises.add({ name, category, defaultSets, defaultReps });
      await refresh();
      return id;
    },
    [refresh]
  );

  return { exercises, loading, refresh, getExercise, getByIds, addExercise };
}

export function getExerciseName(
  exercisePlans: WorkoutPlanExercise[],
  allExercises: Exercise[]
): { exerciseId: number; name: string; sets: number; reps: number; notes?: string }[] {
  return exercisePlans.map((ep) => {
    const ex = allExercises.find((e) => e.id === ep.exerciseId);
    return {
      exerciseId: ep.exerciseId,
      name: ex?.name ?? 'Unknown Exercise',
      sets: ep.sets,
      reps: ep.reps,
      notes: ep.notes,
    };
  });
}

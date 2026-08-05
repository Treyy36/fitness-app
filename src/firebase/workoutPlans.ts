import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from './config';
import type { WorkoutPlan, WorkoutPlanExercise } from './types';

function col(userId: string) { return collection(db, 'users', userId, 'workoutPlans'); }
function ref(userId: string, id: string) { return doc(db, 'users', userId, 'workoutPlans', id); }

export async function getAllPlans(userId: string): Promise<WorkoutPlan[]> {
  const snap = await getDocs(col(userId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkoutPlan));
}

export async function getPlanById(userId: string, id: string): Promise<WorkoutPlan | null> {
  const snap = await getDoc(ref(userId, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as WorkoutPlan) : null;
}

export async function getPlanForDay(userId: string, dayOfWeek: number): Promise<WorkoutPlan | null> {
  const all = await getAllPlans(userId);
  return all.find(p => p.dayOfWeek === dayOfWeek) ?? null;
}

export async function getPlanByName(userId: string, name: string): Promise<WorkoutPlan | null> {
  const all = await getAllPlans(userId);
  return all.find(p => p.name.toLowerCase() === name.toLowerCase()) ?? null;
}

export async function createPlan(
  userId: string,
  plan: Omit<WorkoutPlan, 'id'>,
): Promise<string> {
  const docRef = await addDoc(col(userId), plan);
  return docRef.id;
}

export async function updatePlan(
  userId: string,
  id: string,
  updates: Partial<Omit<WorkoutPlan, 'id'>>,
): Promise<void> {
  await updateDoc(ref(userId, id), updates);
}

export async function deletePlan(userId: string, id: string): Promise<void> {
  await deleteDoc(ref(userId, id));
}

/** Replace the entire exercises array on a plan (e.g., after reordering or swapping). */
export async function updatePlanExercises(
  userId: string,
  planId: string,
  exercises: WorkoutPlanExercise[],
): Promise<void> {
  await updateDoc(ref(userId, planId), { exercises });
}

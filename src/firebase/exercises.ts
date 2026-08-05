import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc, writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { Exercise, MuscleGroup } from './types';

function col(userId: string) { return collection(db, 'users', userId, 'exercises'); }
function ref(userId: string, id: string) { return doc(db, 'users', userId, 'exercises', id); }

export async function getAllExercises(userId: string): Promise<Exercise[]> {
  const snap = await getDocs(col(userId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Exercise));
}

export async function getExerciseById(userId: string, id: string): Promise<Exercise | null> {
  const snap = await getDoc(ref(userId, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Exercise) : null;
}

export async function getExercisesByIds(userId: string, ids: string[]): Promise<Exercise[]> {
  if (ids.length === 0) return [];
  const all = await getAllExercises(userId);
  return all.filter(e => ids.includes(e.id));
}

export async function addExercise(
  userId: string,
  name: string,
  category: MuscleGroup,
  defaultSets = 3,
  defaultReps = 10,
): Promise<string> {
  const docRef = await addDoc(col(userId), { name, category, defaultSets, defaultReps });
  return docRef.id;
}

export async function updateExercise(
  userId: string,
  id: string,
  updates: Partial<Omit<Exercise, 'id'>>,
): Promise<void> {
  await updateDoc(ref(userId, id), updates);
}

export async function deleteExercise(userId: string, id: string): Promise<void> {
  await deleteDoc(ref(userId, id));
}

/** Bulk-add exercises (for seeding). Returns array of Firestore auto-generated IDs. */
export async function bulkAddExercises(
  userId: string,
  exercises: Omit<Exercise, 'id'>[],
): Promise<string[]> {
  const batch = writeBatch(db);
  const ids: string[] = [];
  for (const ex of exercises) {
    const docRef = doc(col(userId));
    batch.set(docRef, ex);
    ids.push(docRef.id);
  }
  await batch.commit();
  return ids;
}

/** Check if a logged set beats the current PR. Updates the exercise if so. */
export async function checkAndUpdatePR(
  userId: string,
  exerciseId: string,
  weight: number,
  reps: number,
  date: string,
): Promise<boolean> {
  const exercise = await getExerciseById(userId, exerciseId);
  if (!exercise) return false;

  // PR only counts if reps >= defaultReps
  if (reps < exercise.defaultReps) return false;

  const isNewPR = !exercise.prWeight || weight > exercise.prWeight;
  if (isNewPR) {
    await updateExercise(userId, exerciseId, { prWeight: weight, prDate: date });
  }
  return isNewPR;
}

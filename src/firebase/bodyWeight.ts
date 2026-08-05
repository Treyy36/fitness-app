import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from './config';
import type { BodyWeightLog } from './types';

function col(userId: string) { return collection(db, 'users', userId, 'bodyWeightLogs'); }
function ref(userId: string, id: string) { return doc(db, 'users', userId, 'bodyWeightLogs', id); }

export async function getAllWeightLogs(userId: string): Promise<BodyWeightLog[]> {
  const q = query(col(userId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BodyWeightLog));
}

export async function getWeightLogsInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<BodyWeightLog[]> {
  const q = query(
    col(userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as BodyWeightLog));
}

export async function addWeightLog(
  userId: string,
  log: Omit<BodyWeightLog, 'id'>,
): Promise<string> {
  const docRef = await addDoc(col(userId), log);
  return docRef.id;
}

export async function updateWeightLog(
  userId: string,
  id: string,
  updates: Partial<Omit<BodyWeightLog, 'id'>>,
): Promise<void> {
  await updateDoc(ref(userId, id), updates);
}

export async function deleteWeightLog(userId: string, id: string): Promise<void> {
  await deleteDoc(ref(userId, id));
}

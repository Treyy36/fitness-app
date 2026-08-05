import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from './config';
import type { MacroLog } from './types';

function col(userId: string) { return collection(db, 'users', userId, 'macroLogs'); }
function ref(userId: string, id: string) { return doc(db, 'users', userId, 'macroLogs', id); }

export async function getAllMacroLogs(userId: string): Promise<MacroLog[]> {
  const q = query(col(userId), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MacroLog));
}

export async function getMacroLogsInRange(
  userId: string,
  startDate: string,
  endDate: string,
): Promise<MacroLog[]> {
  const q = query(
    col(userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as MacroLog));
}

export async function addMacroLog(
  userId: string,
  log: Omit<MacroLog, 'id'>,
): Promise<string> {
  const docRef = await addDoc(col(userId), log);
  return docRef.id;
}

export async function updateMacroLog(
  userId: string,
  id: string,
  updates: Partial<Omit<MacroLog, 'id'>>,
): Promise<void> {
  await updateDoc(ref(userId, id), updates);
}

export async function deleteMacroLog(userId: string, id: string): Promise<void> {
  await deleteDoc(ref(userId, id));
}

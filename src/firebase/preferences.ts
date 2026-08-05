import { collection, getDocs, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import { db } from './config';
import type { UserPreference } from './types';

function col(userId: string) { return collection(db, 'users', userId, 'userPreferences'); }

export async function getAllPreferences(userId: string): Promise<UserPreference[]> {
  const snap = await getDocs(col(userId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as UserPreference));
}

export async function getPreference(userId: string, key: string): Promise<string | null> {
  const q = query(col(userId), where('key', '==', key));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return (snap.docs[0].data() as UserPreference).value;
}

export async function setPreference(userId: string, key: string, value: string): Promise<void> {
  const q = query(col(userId), where('key', '==', key));
  const snap = await getDocs(q);

  if (snap.empty) {
    await addDoc(col(userId), { key, value });
  } else {
    const docRef = doc(col(userId), snap.docs[0].id);
    await updateDoc(docRef, { value });
  }
}

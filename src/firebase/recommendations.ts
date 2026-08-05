import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, limit as limitQuery } from 'firebase/firestore';
import { db } from './config';
import type { Recommendation } from './types';

function col(userId: string) { return collection(db, 'users', userId, 'recommendations'); }
function ref(userId: string, id: string) { return doc(db, 'users', userId, 'recommendations', id); }

export async function getAllRecommendations(
  userId: string,
  maxResults = 20,
): Promise<Recommendation[]> {
  const q = query(col(userId), orderBy('createdAt', 'desc'), limitQuery(maxResults));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Recommendation));
}

export async function getUnacknowledged(userId: string): Promise<Recommendation[]> {
  const all = await getDocs(query(col(userId), orderBy('createdAt', 'desc')));
  return all.docs
    .map(d => ({ id: d.id, ...d.data() } as Recommendation))
    .filter(r => !r.acknowledged);
}

export async function addRecommendation(
  userId: string,
  rec: Omit<Recommendation, 'id'>,
): Promise<string> {
  const docRef = await addDoc(col(userId), rec);
  return docRef.id;
}

export async function acknowledgeRecommendation(
  userId: string,
  id: string,
): Promise<void> {
  await updateDoc(ref(userId, id), { acknowledged: true });
}

import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from './config';
import type { CapabilityRequest } from './types';

function col(userId: string) { return collection(db, 'users', userId, 'capabilityRequests'); }
function ref(userId: string, id: string) { return doc(db, 'users', userId, 'capabilityRequests', id); }

export async function getAllCapabilityRequests(userId: string): Promise<CapabilityRequest[]> {
  const q = query(col(userId), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CapabilityRequest));
}

export async function getPendingRequests(userId: string): Promise<CapabilityRequest[]> {
  const q = query(col(userId), where('status', 'in', ['pending', 'approved', 'building']));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as CapabilityRequest));
}

export async function addCapabilityRequest(
  userId: string,
  request: Omit<CapabilityRequest, 'id'>,
): Promise<string> {
  const docRef = await addDoc(col(userId), request);
  return docRef.id;
}

export async function updateCapabilityRequest(
  userId: string,
  id: string,
  updates: Partial<Omit<CapabilityRequest, 'id'>>,
): Promise<void> {
  await updateDoc(ref(userId, id), updates);
}

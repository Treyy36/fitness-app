import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc,
  query, orderBy, where, limit as limitQuery,
} from 'firebase/firestore';
import { db } from './config';
import type { Session, SessionExercise, SessionType, SetRecord } from './types';

// --- Session collection ---

function sessionsCol(userId: string) { return collection(db, 'users', userId, 'sessions'); }
function sessionRef(userId: string, id: string) { return doc(db, 'users', userId, 'sessions', id); }

// --- SessionExercises subcollection ---

function exercisesCol(userId: string, sessionId: string) {
  return collection(db, 'users', userId, 'sessions', sessionId, 'exercises');
}
export function exerciseRef(userId: string, sessionId: string, exerciseId: string) {
  return doc(db, 'users', userId, 'sessions', sessionId, 'exercises', exerciseId);
}

// ─── Session CRUD ───────────────────────────────────────────────

export async function getAllSessions(
  userId: string,
  maxResults = 100,
): Promise<Session[]> {
  const q = query(sessionsCol(userId), orderBy('date', 'desc'), limitQuery(maxResults));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Session));
}

export async function getRecentSessions(userId: string, count = 20): Promise<Session[]> {
  return getAllSessions(userId, count);
}

export async function getSessionsForPlan(
  userId: string,
  planName: string,
  maxResults = 10,
): Promise<Session[]> {
  const q = query(
    sessionsCol(userId),
    where('planName', '==', planName),
    orderBy('date', 'desc'),
    limitQuery(maxResults),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Session));
}

export async function getSessionById(userId: string, id: string): Promise<Session | null> {
  const snap = await getDoc(sessionRef(userId, id));
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as Session) : null;
}

export async function createSession(
  userId: string,
  session: Omit<Session, 'id'>,
): Promise<string> {
  const docRef = await addDoc(sessionsCol(userId), session);
  return docRef.id;
}

export async function completeSession(
  userId: string,
  sessionId: string,
  feedback?: string,
): Promise<void> {
  await updateDoc(sessionRef(userId, sessionId), {
    completedAt: new Date().toISOString(),
    ...(feedback ? { feedback } : {}),
  });
}

export async function updateSession(
  userId: string,
  sessionId: string,
  updates: Partial<Omit<Session, 'id'>>,
): Promise<void> {
  await updateDoc(sessionRef(userId, sessionId), updates);
}

export async function deleteSession(userId: string, sessionId: string): Promise<void> {
  // Delete all subcollection exercises first
  const exercises = await getSessionExercises(userId, sessionId);
  await Promise.all(exercises.map(e => deleteDoc(exerciseRef(userId, sessionId, e.id))));
  await deleteDoc(sessionRef(userId, sessionId));
}

// ─── SessionExercise CRUD ───────────────────────────────────────

export async function getSessionExercises(
  userId: string,
  sessionId: string,
): Promise<SessionExercise[]> {
  const snap = await getDocs(exercisesCol(userId, sessionId));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SessionExercise));
}

export async function addSessionExercise(
  userId: string,
  sessionId: string,
  exercise: Omit<SessionExercise, 'id'>,
): Promise<string> {
  // Strip undefined values from sets (Firestore rejects undefined)
  const sanitized = {
    ...exercise,
    sets: exercise.sets.map((s) => {
      const clean: any = { setNumber: s.setNumber, reps: s.reps, weight: s.weight, completed: s.completed };
      if (s.rpe !== undefined && s.rpe !== null) clean.rpe = s.rpe;
      return clean;
    }),
  };
  const docRef = await addDoc(exercisesCol(userId, sessionId), sanitized);
  return docRef.id;
}

export async function updateSessionExercise(
  userId: string,
  sessionId: string,
  exerciseId: string,
  updates: Partial<Omit<SessionExercise, 'id'>>,
): Promise<void> {
  await updateDoc(exerciseRef(userId, sessionId, exerciseId), updates);
}

/** Delete a session exercise by its doc ID. Requires sessionId since exercises are a subcollection. */
export async function deleteSessionExercise(
  userId: string,
  sessionId: string,
  exerciseId: string,
): Promise<void> {
  await deleteDoc(exerciseRef(userId, sessionId, exerciseId));
}

/** Delete a session exercise doc when only the exercise doc ID is known (searches all sessions). */
export async function deleteSessionExerciseById(
  userId: string,
  exerciseDocId: string,
): Promise<boolean> {
  const sessions = await getAllSessions(userId);
  for (const session of sessions) {
    const exercises = await getSessionExercises(userId, session.id);
    const found = exercises.find(e => e.id === exerciseDocId);
    if (found) {
      await deleteDoc(exerciseRef(userId, session.id, exerciseDocId));
      return true;
    }
  }
  return false;
}

/** Get the most recent SessionExercise for a given exercise across all sessions. */
export async function getLastSessionExercise(
  userId: string,
  exerciseId: string,
  beforeDate?: string,
): Promise<{ sessionExercise: SessionExercise; sessionDate: string } | null> {
  const sessions = await getAllSessions(userId);

  // Sort by date descending, filter by beforeDate if given
  const filtered = beforeDate
    ? sessions.filter(s => s.date < beforeDate)
    : sessions;

  filtered.sort((a, b) => b.date.localeCompare(a.date));

  for (const session of filtered) {
    const exercises = await getSessionExercises(userId, session.id);
    const match = exercises.find(e => e.exerciseId === exerciseId);
    if (match) {
      return { sessionExercise: match, sessionDate: session.date };
    }
  }

  return null;
}

/** Log a full session with exercises in one operation. */
export async function logCompleteSession(
  userId: string,
  session: Omit<Session, 'id'>,
  exercises: Omit<SessionExercise, 'id'>[],
): Promise<{ sessionId: string; exerciseIds: string[] }> {
  const sessionId = await createSession(userId, session);
  const exerciseIds: string[] = [];

  // Add each exercise to the subcollection
  for (const ex of exercises) {
    const id = await addSessionExercise(userId, sessionId, { ...ex, sessionId });
    exerciseIds.push(id);
  }

  return { sessionId, exerciseIds };
}

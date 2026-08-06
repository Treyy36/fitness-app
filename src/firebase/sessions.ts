import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, getDoc,
  query, orderBy, where, limit as limitQuery, writeBatch,
} from 'firebase/firestore';
import { db } from './config';
import type { Session, SessionExercise, SessionType, SetRecord, LogSessionResult, SetWriteResult, ExerciseWriteResult, SubstitutionRecord } from './types';

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

/** Strip undefined values from sets so Firestore doesn't reject the document. */
function sanitizeSets(sets: SetRecord[]): SetRecord[] {
  return sets.map((s) => {
    const clean: any = { setNumber: s.setNumber, reps: s.reps, weight: s.weight, completed: s.completed };
    if (s.rpe !== undefined && s.rpe !== null) clean.rpe = s.rpe;
    return clean;
  });
}

/**
 * Log a full session atomically using a Firestore batch write.
 *
 * All session + exercise writes succeed or fail together — no partial sessions.
 * Returns a verbose `LogSessionResult` so the caller can verify exactly what
 * was written without needing a follow-up query.
 */
export async function logCompleteSession(
  userId: string,
  session: Omit<Session, 'id'>,
  exercises: Omit<SessionExercise, 'id'>[],
  substitutions?: SubstitutionRecord[],
): Promise<LogSessionResult> {
  const batch = writeBatch(db);

  // ── Pre-generate IDs so we can use batch.set() ──
  const sessionDocRef = doc(sessionsCol(userId));
  const sessionId = sessionDocRef.id;

  const exerciseDocRefs = exercises.map(() => doc(exercisesCol(userId, sessionId)));

  // ── Write session doc ──
  const completedAt = session.completedAt || new Date().toISOString();
  batch.set(sessionDocRef, {
    planId: session.planId || null,
    planName: session.planName || null,
    date: session.date,
    completedAt,
    feedback: session.feedback || null,
    sessionType: session.sessionType || 'standard',
    notes: session.notes || null,
    substitutions: (substitutions && substitutions.length > 0) ? substitutions : null,
  });

  // ── Write exercise subcollection docs ──
  const exerciseResults: ExerciseWriteResult[] = [];
  let allCatalogMatched = true;

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i];
    const docRef = exerciseDocRefs[i];
    const cleanSets = sanitizeSets(ex.sets);

    batch.set(docRef, {
      sessionId,
      exerciseId: ex.exerciseId || '',
      exerciseName: ex.exerciseName,
      sets: cleanSets,
    });

    if (!ex.exerciseId) allCatalogMatched = false;

    const setResults: SetWriteResult[] = cleanSets.map((s) => ({
      setNumber: s.setNumber,
      reps: s.reps,
      weight: s.weight,
      completed: s.completed,
      ...(s.rpe !== undefined ? { rpe: s.rpe } : {}),
    }));

    exerciseResults.push({
      exerciseDocId: docRef.id,
      exerciseCatalogId: ex.exerciseId || '',
      exerciseName: ex.exerciseName,
      sets: setResults,
    });
  }

  // ── Commit atomically ──
  await batch.commit();

  const totalSets = exerciseResults.reduce((sum, e) => sum + e.sets.length, 0);

  return {
    sessionId,
    planName: session.planName || 'Custom',
    planId: session.planId,
    date: session.date,
    completedAt,
    sessionType: session.sessionType || 'standard',
    feedback: session.feedback,
    substitutions: substitutions && substitutions.length > 0 ? substitutions : undefined,
    exercises: exerciseResults,
    exerciseCount: exerciseResults.length,
    totalSets,
    verified: allCatalogMatched,
  };
}

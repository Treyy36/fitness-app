/**
 * Deduplication & canonicalization for Exercises and Workout Plans.
 *
 * Problem: Duplicate exercises and plans with different Firestore IDs cause:
 *   - Ambiguous plan prescription (which "Push A" is the real one?)
 *   - Fragmented PR tracking (same exercise has prWeight=0 on one record, 40 on the other)
 *   - Broken trend analysis across sessions
 *
 * Strategy:
 *   1. Group by normalized name (lowercase trim).
 *   2. Pick a canonical record per group (best PR data → most sessions → earliest creation).
 *   3. Rewrite ALL foreign-key references to point to the canonical ID.
 *   4. Delete the duplicate (non-canonical) records.
 *
 * References that get rewritten:
 *   Exercise merges → workoutPlans[].exerciseId, sessionExercises[].exerciseId
 *   Plan merges    → sessions[].planId
 */

import { deleteDoc, updateDoc, doc } from 'firebase/firestore';
import { db } from './config';
import { getAllExercises } from './exercises';
import { getAllPlans } from './workoutPlans';
import { getAllSessions, getSessionExercises, exerciseRef } from './sessions';
import type { Exercise, WorkoutPlan, Session, SessionExercise } from './types';

// ─── Helpers ──────────────────────────────────────────────────

const normalize = (s: string) => s.trim().toLowerCase();

function docRef(userId: string, collectionName: string, id: string) {
  return doc(db, 'users', userId, collectionName, id);
}

// ─── Report types ─────────────────────────────────────────────

export interface DedupReport {
  /** Total duplicates found (non-canonical records). */
  duplicatesFound: number;
  /** Number of duplicate docs deleted. */
  duplicatesDeleted: number;
  /** Number of reference fields rewritten. */
  referencesUpdated: number;
  /** Human-readable summary of every action taken. */
  actions: string[];
}

// ─── Exercise deduplication ───────────────────────────────────

/**
 * Merge duplicate exercises (same name, different Firestore IDs).
 *
 * Canonical selection: prefers exercise with prWeight > 0, then earliest prDate,
 * then any record (first encountered).
 *
 * Rewrites:
 *   - workoutPlans[].exercises[].exerciseId
 *   - sessionExercises[].exerciseId
 *
 * Then deletes the duplicate exercise docs.
 */
export async function deduplicateExercises(userId: string): Promise<DedupReport> {
  const report: DedupReport = { duplicatesFound: 0, duplicatesDeleted: 0, referencesUpdated: 0, actions: [] };

  const exercises = await getAllExercises(userId);
  const plans = await getAllPlans(userId);
  const sessions = await getAllSessions(userId);

  // 1. Group exercises by normalized name
  const groups = new Map<string, Exercise[]>();
  for (const ex of exercises) {
    const key = normalize(ex.name);
    const list = groups.get(key) || [];
    list.push(ex);
    groups.set(key, list);
  }

  // 2. Build canonical mapping: duplicateId → canonicalId
  const canonicalMap = new Map<string, string>(); // duplicateId → canonicalId

  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    // Sort: prefer prWeight > 0, then higher prWeight, then prDate exists, then keep stable
    const sorted = [...group].sort((a, b) => {
      const aHasPR = (a.prWeight ?? 0) > 0 ? 1 : 0;
      const bHasPR = (b.prWeight ?? 0) > 0 ? 1 : 0;
      if (aHasPR !== bHasPR) return bHasPR - aHasPR;
      if (a.prWeight !== b.prWeight) return (b.prWeight ?? 0) - (a.prWeight ?? 0);
      if (a.prDate && !b.prDate) return -1;
      if (!a.prDate && b.prDate) return 1;
      return 0;
    });

    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    report.actions.push(
      `Exercise "${canonical.name}": canonical=${canonical.id} (prWeight=${canonical.prWeight ?? 0}), ` +
      `duplicates=[${duplicates.map(d => d.id).join(', ')}]`,
    );

    for (const dup of duplicates) {
      canonicalMap.set(dup.id, canonical.id);
      report.duplicatesFound++;
    }
  }

  if (canonicalMap.size === 0) {
    report.actions.push('No duplicate exercises found.');
    return report;
  }

  // 3. Rewrite workoutPlans that reference duplicate exercise IDs
  for (const plan of plans) {
    let planChanged = false;
    const newExercises = plan.exercises.map(pe => {
      const canonicalId = canonicalMap.get(pe.exerciseId);
      if (canonicalId) {
        report.referencesUpdated++;
        planChanged = true;
        return { ...pe, exerciseId: canonicalId };
      }
      return pe;
    });

    if (planChanged) {
      await updateDoc(docRef(userId, 'workoutPlans', plan.id), { exercises: newExercises });
      report.actions.push(`  Updated plan "${plan.name}" (${plan.id}): remapped exercise refs.`);
    }
  }

  // 4. Rewrite sessionExercises that reference duplicate exercise IDs
  for (const session of sessions) {
    const sessionExs = await getSessionExercises(userId, session.id);
    for (const se of sessionExs) {
      const canonicalId = canonicalMap.get(se.exerciseId);
      if (canonicalId) {
        await updateDoc(exerciseRef(userId, session.id, se.id), { exerciseId: canonicalId });
        report.referencesUpdated++;
        report.actions.push(`  Updated sessionExercise ${se.id} (session ${session.id}): ` +
          `exerciseId ${se.exerciseId} → ${canonicalId}`);
      }
    }
  }

  // 5. Delete duplicate exercise docs
  for (const [dupId] of canonicalMap) {
    await deleteDoc(docRef(userId, 'exercises', dupId));
    report.duplicatesDeleted++;
  }

  report.actions.push(
    `Done: ${report.duplicatesDeleted} duplicate exercises deleted, ${report.referencesUpdated} references remapped.`,
  );

  return report;
}

// ─── Plan deduplication ───────────────────────────────────────

/**
 * Merge duplicate workout plans (same name, different Firestore IDs).
 *
 * Canonical selection: prefers the plan with more session references,
 * then the earliest createdAt date.
 *
 * Rewrites:
 *   - sessions[].planId
 *
 * Then deletes the duplicate plan docs.
 */
export async function deduplicatePlans(userId: string): Promise<DedupReport> {
  const report: DedupReport = { duplicatesFound: 0, duplicatesDeleted: 0, referencesUpdated: 0, actions: [] };

  const plans = await getAllPlans(userId);
  const sessions = await getAllSessions(userId);

  // 1. Group plans by normalized name
  const groups = new Map<string, WorkoutPlan[]>();
  for (const plan of plans) {
    const key = normalize(plan.name);
    const list = groups.get(key) || [];
    list.push(plan);
    groups.set(key, list);
  }

  // 2. Count session references per plan ID
  const sessionCounts = new Map<string, number>();
  for (const s of sessions) {
    if (s.planId) {
      sessionCounts.set(s.planId, (sessionCounts.get(s.planId) || 0) + 1);
    }
  }

  // 3. Build canonical mapping
  const canonicalMap = new Map<string, string>(); // duplicateId → canonicalId

  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    const sorted = [...group].sort((a, b) => {
      const aCount = sessionCounts.get(a.id) || 0;
      const bCount = sessionCounts.get(b.id) || 0;
      if (aCount !== bCount) return bCount - aCount;
      // Prefer earlier creation
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    const canonical = sorted[0];
    const duplicates = sorted.slice(1);

    report.actions.push(
      `Plan "${canonical.name}": canonical=${canonical.id} (sessions=${sessionCounts.get(canonical.id) || 0}), ` +
      `duplicates=[${duplicates.map(d => d.id).join(', ')}]`,
    );

    for (const dup of duplicates) {
      canonicalMap.set(dup.id, canonical.id);
      report.duplicatesFound++;
    }
  }

  if (canonicalMap.size === 0) {
    report.actions.push('No duplicate plans found.');
    return report;
  }

  // 4. Rewrite sessions that reference duplicate plan IDs
  for (const session of sessions) {
    if (session.planId && canonicalMap.has(session.planId)) {
      const newPlanId = canonicalMap.get(session.planId)!;
      await updateDoc(docRef(userId, 'sessions', session.id), { planId: newPlanId });
      report.referencesUpdated++;
      report.actions.push(`  Updated session ${session.id}: planId ${session.planId} → ${newPlanId}`);
    }
  }

  // 5. Delete duplicate plan docs
  for (const [dupId] of canonicalMap) {
    await deleteDoc(docRef(userId, 'workoutPlans', dupId));
    report.duplicatesDeleted++;
  }

  report.actions.push(
    `Done: ${report.duplicatesDeleted} duplicate plans deleted, ${report.referencesUpdated} session refs remapped.`,
  );

  return report;
}

// ─── Combined ──────────────────────────────────────────────────

/**
 * Run both deduplication passes. Exercises first (so plan exercises point to
 * canonical exercise IDs), then plans.
 */
export async function deduplicateAll(userId: string): Promise<{
  exercises: DedupReport;
  plans: DedupReport;
}> {
  const exerciseReport = await deduplicateExercises(userId);
  const planReport = await deduplicatePlans(userId);
  return { exercises: exerciseReport, plans: planReport };
}

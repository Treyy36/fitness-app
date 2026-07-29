import { db, type Session, type SessionExercise, type SetRecord, type Recommendation } from '../db/database';

// Local fallback recommendations when offline or as supplement to AI
interface RecommendationContext {
  exerciseName: string;
  currentWeight: number;
  currentReps: number;
  targetReps: number;
  recentSets: Array<{ weight: number; reps: number; completed: boolean; date: string }>;
}

export function analyzeExerciseProgression(ctx: RecommendationContext): Recommendation | null {
  const { exerciseName, currentWeight, currentReps, targetReps, recentSets } = ctx;

  // All sets completed at target reps with same weight for 2+ sessions = time to increase
  const completedSessions = recentSets.filter((s) => s.completed);
  if (
    completedSessions.length >= 2 &&
    completedSessions.every((s) => s.reps >= targetReps && s.weight === currentWeight)
  ) {
    const newWeight = currentWeight + (currentWeight < 50 ? 2.5 : 5);
    return {
      type: 'weight_increase',
      exercise: exerciseName,
      message: `You've hit ${targetReps}+ reps at ${currentWeight}lbs for ${completedSessions.length} sessions. Time to try ${newWeight}lbs next session.`,
      action: `Increase ${exerciseName} from ${currentWeight}lbs to ${newWeight}lbs`,
      acknowledged: false,
      createdAt: new Date().toISOString(),
    };
  }

  // Failed to hit target reps 2 sessions in a row = consider deload or form check
  const recentFailed = recentSets.filter((s) => !s.completed).length;
  if (recentFailed >= 2 && recentSets.length >= 2) {
    return {
      type: 'form_tip',
      exercise: exerciseName,
      message: `You've missed target reps on ${exerciseName} for ${recentFailed} recent sessions. Consider a deload (drop weight 10-15%) or check your form. Want me to suggest a variation?`,
      action: `Deload ${exerciseName} or try a variation`,
      acknowledged: false,
      createdAt: new Date().toISOString(),
    };
  }

  return null;
}

// Check all recently completed exercises for patterns
export async function generateLocalRecommendations(sessionId: number): Promise<Recommendation[]> {
  const recommendations: Recommendation[] = [];

  try {
    const sessionExercises = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();

    for (const se of sessionExercises) {
      // Get recent sessions for this exercise (last 4 occurrences)
      const allSE = await db.sessionExercises
        .where('exerciseId')
        .equals(se.exerciseId)
        .toArray();

      const recentSessions = allSE
        .filter((s) => s.id !== se.id)
        .slice(-4);

      const recentSets: Array<{ weight: number; reps: number; completed: boolean; date: string }> = [];
      for (const rse of recentSessions) {
        const session = await db.sessions.get(rse.sessionId);
        for (const set of rse.sets) {
          recentSets.push({
            weight: set.weight,
            reps: set.reps,
            completed: set.completed,
            date: session?.date ?? '',
          });
        }
      }

      if (recentSets.length > 0 && se.sets.length > 0) {
        const lastSet = se.sets[se.sets.length - 1];
        const plan = se.sets.length > 0 ? { targetReps: se.sets[0].reps } : { targetReps: 10 };

        const rec = analyzeExerciseProgression({
          exerciseName: se.exerciseName,
          currentWeight: lastSet.weight,
          currentReps: lastSet.reps,
          targetReps: plan.targetReps,
          recentSets,
        });

        if (rec) {
          rec.sessionId = sessionId;
          recommendations.push(rec);
        }
      }
    }
  } catch (err) {
    console.warn('[Recommendations] Failed to generate local recommendations:', err);
  }

  return recommendations;
}

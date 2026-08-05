import { useState, useEffect } from 'react';
import type { Session, SessionExercise, WorkoutPlan, Exercise } from '../../firebase/types';
import * as fb from '../../firebase';

interface TodayWorkoutCardProps {
  todaysSession: Session | null;
  todaysPlan: WorkoutPlan | null;
  exercises: SessionExercise[];
  loading: boolean;
  userId: string;
  exerciseCatalog: Exercise[];
}

export function TodayWorkoutCard({ todaysSession, todaysPlan, exercises, loading, userId, exerciseCatalog }: TodayWorkoutCardProps) {
  const [lastWeights, setLastWeights] = useState<Record<string, number>>({});

  const getName = (exerciseId: string) => exerciseCatalog.find(e => e.id === exerciseId)?.name ?? 'Unknown';

  useEffect(() => {
    if (!todaysPlan || todaysSession) return;
    (async () => {
      const weights: Record<string, number> = {};
      for (const pe of todaysPlan.exercises) {
        const last = await fb.getLastSessionExercise(userId, pe.exerciseId);
        if (last?.sessionExercise?.sets?.length) {
          weights[pe.exerciseId] = last.sessionExercise.sets[last.sessionExercise.sets.length - 1].weight;
        }
      }
      setLastWeights(weights);
    })();
  }, [todaysPlan, todaysSession, userId]);

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <p className="text-xs text-slate-400 mb-2">Today's Workout</p>

      {loading ? (
        <p className="text-sm text-slate-500">Loading...</p>
      ) : todaysSession ? (
        <div className="text-center py-3">
          <p className="text-2xl mb-1">✅</p>
          <p className="text-white font-semibold text-sm">
            {todaysSession.planName || 'Workout'} completed!
          </p>
          {todaysSession.feedback && (
            <p className="text-xs text-slate-400 mt-1 italic">"{todaysSession.feedback}"</p>
          )}
        </div>
      ) : todaysPlan ? (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h3 className="font-semibold text-white text-sm">{todaysPlan.name}</h3>
            <span className="text-xs text-slate-500">Planned</span>
          </div>
          <div className="space-y-1.5">
            {todaysPlan.exercises.map((pe) => (
              <div key={pe.exerciseId} className="flex justify-between text-xs">
                <span className="text-slate-300">
                  {getName(pe.exerciseId)}
                </span>
                <span className="text-slate-500 shrink-0">
                  {pe.targetSets}×{pe.targetReps}
                  {lastWeights[pe.exerciseId] ? ` · ~${lastWeights[pe.exerciseId]} lbs` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500">No workout planned for today.</p>
      )}
    </div>
  );
}

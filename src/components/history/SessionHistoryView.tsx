import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { db, type SessionExercise } from '../../db/database';

export function SessionHistoryView() {
  const { sessions, sessionsLoading, exercises } = useApp();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<SessionExercise[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const toggleExpand = async (sessionId: number) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    setLoadingDetails(true);
    const exs = await db.sessionExercises.where('sessionId').equals(sessionId).toArray();
    setExpandedExercises(exs);
    setLoadingDetails(false);
  };

  if (sessionsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Loading history...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-bold text-white">Session History</h1>
        <p className="text-xs text-slate-400">{sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {sessions.length === 0 && (
          <div className="text-center text-slate-500 py-10">
            <p className="text-4xl mb-2">📊</p>
            <p className="text-sm">No sessions yet. Complete a workout to see it here!</p>
          </div>
        )}

        {sessions.map((session) => {
          const isExpanded = expandedId === session.id;
          return (
            <div key={session.id}>
              <button
                onClick={() => toggleExpand(session.id!)}
                className="w-full bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 text-left hover:bg-slate-800 transition"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-sm">{session.planName || 'Workout'}</h3>
                    <p className="text-xs text-slate-400">
                      {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {session.completedAt && ' · Completed'}
                    </p>
                  </div>
                  <span className="text-slate-500 text-xs">{isExpanded ? '▲' : '▼'}</span>
                </div>
                {session.feedback && (
                  <p className="text-xs text-slate-500 mt-1 italic">"{session.feedback}"</p>
                )}
              </button>

              {isExpanded && (
                <div className="bg-slate-800/30 rounded-b-xl px-4 py-3 border border-t-0 border-slate-700/50 -mt-1">
                  {loadingDetails ? (
                    <p className="text-xs text-slate-500">Loading details...</p>
                  ) : expandedExercises.length === 0 ? (
                    <p className="text-xs text-slate-500">No exercise data recorded.</p>
                  ) : (
                    <div className="space-y-2">
                      {expandedExercises.map((ex) => (
                        <div key={ex.id}>
                          <p className="text-sm font-medium text-slate-300">{ex.exerciseName}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {ex.sets.map((set, i) => (
                              <span
                                key={i}
                                className={`text-xs px-2 py-0.5 rounded ${
                                  set.completed
                                    ? 'bg-emerald-900/30 text-emerald-300'
                                    : 'bg-red-900/30 text-red-300'
                                }`}
                              >
                                {set.weight > 0 ? `${set.weight}lbs` : 'BW'} × {set.reps}
                                {set.rpe && ` @${set.rpe}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

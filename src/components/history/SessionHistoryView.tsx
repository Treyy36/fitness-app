import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import type { SessionExercise, SessionType } from '../../firebase/types';
import * as fb from '../../firebase';

const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  standard: 'bg-blue-900/30 text-blue-300',
  test: 'bg-yellow-900/30 text-yellow-300',
  deload: 'bg-orange-900/30 text-orange-300',
};

const FILTER_OPTIONS: { label: string; value: SessionType | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Standard', value: 'standard' },
  { label: 'Test', value: 'test' },
  { label: 'Deload', value: 'deload' },
];

export function SessionHistoryView() {
  const { sessions, sessionsLoading, updateSession, deleteSession, refreshSessions, userId } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedExercises, setExpandedExercises] = useState<SessionExercise[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [typeFilter, setTypeFilter] = useState<SessionType | 'all'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFeedback, setEditFeedback] = useState('');
  const [editSessionType, setEditSessionType] = useState<SessionType>('standard');
  const [editExercises, setEditExercises] = useState<SessionExercise[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [dataView, setDataView] = useState<'workouts' | 'weight' | 'macros'>('workouts');
  const [weightLogs, setWeightLogs] = useState<any[]>([]);
  const [macroLogs, setMacroLogs] = useState<any[]>([]);

  const filteredSessions = typeFilter === 'all'
    ? sessions
    : sessions.filter((s) => (s.sessionType || 'standard') === typeFilter);

  // Load weight/macro data when view changes
  useEffect(() => {
    if (dataView === 'weight') {
      fb.getAllWeightLogs(userId).then(setWeightLogs);
    } else if (dataView === 'macros') {
      fb.getAllMacroLogs(userId).then(setMacroLogs);
    }
  }, [dataView, userId]);

  const toggleExpand = async (sessionId: string) => {
    if (expandedId === sessionId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(sessionId);
    setLoadingDetails(true);
    const exs = await fb.getSessionExercises(userId, sessionId);
    setExpandedExercises(exs);
    setLoadingDetails(false);
  };

  const startEditing = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const exs = await fb.getSessionExercises(userId, sessionId);
    setEditingId(sessionId);
    setEditFeedback(session.feedback || '');
    setEditSessionType(session.sessionType || 'standard');
    setEditExercises(exs);
    setExpandedId(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditFeedback('');
    setEditSessionType('standard');
    setEditExercises([]);
  };

  const saveEdit = async () => {
    if (editingId === null) return;

    await updateSession(editingId, {
      feedback: editFeedback || undefined,
      sessionType: editSessionType,
    });

    // Update each exercise's sets
    for (const ex of editExercises) {
      if (ex.id !== undefined) {
        await fb.updateSessionExercise(userId, editingId, ex.id, { sets: ex.sets });
      }
    }

    await refreshSessions();
    cancelEditing();
  };

  const handleDelete = async () => {
    if (deleteConfirmId === null) return;
    await deleteSession(deleteConfirmId);
    setDeleteConfirmId(null);
    if (expandedId === deleteConfirmId) setExpandedId(null);
  };

  const updateExerciseSet = (exerciseIndex: number, setIndex: number, field: string, value: number | boolean) => {
    const updated = [...editExercises];
    const sets = [...updated[exerciseIndex].sets];
    sets[setIndex] = { ...sets[setIndex], [field]: value };
    updated[exerciseIndex] = { ...updated[exerciseIndex], sets };
    setEditExercises(updated);
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
        <h1 className="text-lg font-bold text-white">History</h1>
        <p className="text-xs text-slate-400">
          {dataView === 'workouts' && `${sessions.length} session${sessions.length !== 1 ? 's' : ''} recorded`}
          {dataView === 'weight' && `${weightLogs.length} weigh-in${weightLogs.length !== 1 ? 's' : ''}`}
          {dataView === 'macros' && `${macroLogs.length} day${macroLogs.length !== 1 ? 's' : ''} logged`}
        </p>

        {/* View toggle */}
        <div className="flex gap-1.5 mt-2 mb-2">
          {([
            { label: '🏋️ Workouts', value: 'workouts' as const },
            { label: '⚖️ Weight', value: 'weight' as const },
            { label: '🍽️ Macros', value: 'macros' as const },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDataView(opt.value)}
              className={`text-xs px-3 py-1.5 rounded-lg transition ${
                dataView === opt.value
                  ? 'bg-brand-600 text-white'
                  : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Session type filter chips (only for workouts) */}
        {dataView === 'workouts' && (
          <div className="flex gap-1.5 flex-wrap">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTypeFilter(opt.value)}
                className={`text-xs px-2.5 py-1 rounded-full transition ${
                  typeFilter === opt.value
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {/* ── Workout View ── */}
        {dataView === 'workouts' && (
          <>
            {filteredSessions.length === 0 && (
              <div className="text-center text-slate-500 py-10">
                <p className="text-4xl mb-2">📊</p>
                <p className="text-sm">
                  {typeFilter !== 'all' ? `No ${typeFilter} sessions found.` : 'No sessions yet. Complete a workout to see it here!'}
                </p>
              </div>
            )}

        {/* Delete confirmation modal */}
        {deleteConfirmId !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setDeleteConfirmId(null)}>
            <div className="bg-slate-800 rounded-xl p-6 mx-4 max-w-sm w-full border border-slate-700" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white font-semibold mb-2">Delete Session?</h3>
              <p className="text-sm text-slate-400 mb-4">This permanently removes the session and all its exercise data. This cannot be undone.</p>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setDeleteConfirmId(null)} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition">Cancel</button>
                <button onClick={handleDelete} className="px-4 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editingId !== null && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 overflow-y-auto" onClick={cancelEditing}>
            <div className="bg-slate-800 rounded-xl p-6 mx-4 my-8 max-w-lg w-full border border-slate-700 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-white font-semibold mb-4">Edit Session</h3>

              {/* Session type */}
              <label className="text-xs text-slate-400 block mb-1">Session Type</label>
              <select
                value={editSessionType}
                onChange={(e) => setEditSessionType(e.target.value as SessionType)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 mb-3 outline-none"
              >
                <option value="standard">Standard</option>
                <option value="test">Test / Adjustment</option>
                <option value="deload">Deload</option>
              </select>

              {/* Feedback */}
              <label className="text-xs text-slate-400 block mb-1">Feedback</label>
              <textarea
                value={editFeedback}
                onChange={(e) => setEditFeedback(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-2 mb-4 outline-none resize-none"
                rows={2}
                placeholder="Post-workout notes..."
              />

              {/* Exercises */}
              <label className="text-xs text-slate-400 block mb-2">Exercises</label>
              <div className="space-y-3">
                {editExercises.map((ex, exIdx) => (
                  <div key={ex.id ?? exIdx} className="bg-slate-700/50 rounded-lg p-3">
                    <p className="text-sm font-medium text-slate-200 mb-2">{ex.exerciseName}</p>
                    {ex.sets.map((set, setIdx) => (
                      <div key={setIdx} className="flex items-center gap-2 mb-1.5">
                        <span className="text-xs text-slate-500 w-8">S{set.setNumber}</span>
                        <input
                          type="number"
                          value={set.weight}
                          onChange={(e) => updateExerciseSet(exIdx, setIdx, 'weight', Number(e.target.value))}
                          className="w-16 bg-slate-600 text-white text-xs rounded px-2 py-1 outline-none"
                          placeholder="lbs"
                        />
                        <span className="text-xs text-slate-500">lbs</span>
                        <input
                          type="number"
                          value={set.reps}
                          onChange={(e) => updateExerciseSet(exIdx, setIdx, 'reps', Number(e.target.value))}
                          className="w-12 bg-slate-600 text-white text-xs rounded px-2 py-1 outline-none"
                          placeholder="reps"
                        />
                        <span className="text-xs text-slate-500">×</span>
                        <input
                          type="number"
                          value={set.rpe ?? ''}
                          onChange={(e) => updateExerciseSet(exIdx, setIdx, 'rpe', e.target.value ? Number(e.target.value) : 0)}
                          className="w-12 bg-slate-600 text-white text-xs rounded px-2 py-1 outline-none"
                          placeholder="RPE"
                        />
                        <label className="flex items-center gap-1 text-xs text-slate-400 ml-1">
                          <input
                            type="checkbox"
                            checked={set.completed}
                            onChange={(e) => updateExerciseSet(exIdx, setIdx, 'completed', e.target.checked)}
                            className="rounded"
                          />
                          ✓
                        </label>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button onClick={cancelEditing} className="px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition">Cancel</button>
                <button onClick={saveEdit} className="px-4 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition">Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {filteredSessions.map((session) => {
          const isExpanded = expandedId === session.id;
          const st = session.sessionType || 'standard';
          return (
            <div key={session.id}>
              <div className="w-full bg-slate-800/50 rounded-xl border border-slate-700/50">
                {/* Session header — click to expand */}
                <div
                  onClick={() => toggleExpand(session.id!)}
                  className="w-full p-4 text-left flex items-center justify-between cursor-pointer"
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white text-sm truncate">{session.planName || 'Workout'}</h3>
                      {st !== 'standard' && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${SESSION_TYPE_COLORS[st]}`}>
                          {st}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      {session.completedAt && ' · Completed'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEditing(session.id!); }}
                      className="text-xs text-slate-500 hover:text-slate-300 px-1.5 py-1 rounded transition"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(session.id!); }}
                      className="text-xs text-slate-500 hover:text-red-400 px-1.5 py-1 rounded transition"
                      title="Delete"
                    >
                      🗑️
                    </button>
                    <span className="text-slate-500 text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Feedback preview */}
                {session.feedback && !isExpanded && (
                  <p className="text-xs text-slate-500 px-4 pb-3 italic truncate">"{session.feedback}"</p>
                )}

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="bg-slate-800/30 px-4 py-3 border-t border-slate-700/50">
                    {session.feedback && (
                      <p className="text-xs text-slate-500 mb-2 italic">"{session.feedback}"</p>
                    )}
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
            </div>
          );
        })}
          </>
        )}

        {/* Weight View */}
        {dataView === 'weight' && (
          <div className="space-y-2">
            {weightLogs.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                <p className="text-4xl mb-2">⚖️</p>
                <p className="text-sm">No weigh-ins yet. Ask the AI to log your weight!</p>
              </div>
            ) : (
              weightLogs.map((w) => (
                <div key={w.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold text-lg">{w.weight} lbs</p>
                      <p className="text-xs text-slate-400">
                        {new Date(w.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                    {w.notes && <p className="text-xs text-slate-500 italic max-w-[60%] text-right">{w.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Macros View */}
        {dataView === 'macros' && (
          <div className="space-y-2">
            {macroLogs.length === 0 ? (
              <div className="text-center text-slate-500 py-10">
                <p className="text-4xl mb-2">🍽️</p>
                <p className="text-sm">No macros logged yet. Ask the AI to log your nutrition!</p>
              </div>
            ) : (
              macroLogs.map((m) => (
                <div key={m.id} className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-400">
                      {new Date(m.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-white font-semibold text-sm">{m.calories ?? (m.protein*4 + m.carbs*4 + m.fat*9)} kcal</p>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-red-300 bg-red-900/20 px-2 py-1 rounded-lg">P: {m.protein}g</span>
                    <span className="text-yellow-300 bg-yellow-900/20 px-2 py-1 rounded-lg">C: {m.carbs}g</span>
                    <span className="text-blue-300 bg-blue-900/20 px-2 py-1 rounded-lg">F: {m.fat}g</span>
                  </div>
                  {m.notes && <p className="text-xs text-slate-500 mt-2 italic">{m.notes}</p>}
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  );
}

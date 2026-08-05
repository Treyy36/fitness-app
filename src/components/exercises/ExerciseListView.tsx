import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import type { MuscleGroup, Exercise } from '../../firebase/types';

const CATEGORY_COLORS: Record<string, string> = {
  chest: 'bg-red-900/30 text-red-300',
  back: 'bg-blue-900/30 text-blue-300',
  shoulders: 'bg-yellow-900/30 text-yellow-300',
  biceps: 'bg-green-900/30 text-green-300',
  triceps: 'bg-purple-900/30 text-purple-300',
  quads: 'bg-orange-900/30 text-orange-300',
  hamstrings: 'bg-pink-900/30 text-pink-300',
  glutes: 'bg-cyan-900/30 text-cyan-300',
  calves: 'bg-teal-900/30 text-teal-300',
  abs: 'bg-indigo-900/30 text-indigo-300',
  other: 'bg-slate-900/30 text-slate-300',
};

const GROUPS: { label: string; value: MuscleGroup | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Chest', value: 'chest' },
  { label: 'Back', value: 'back' },
  { label: 'Shoulders', value: 'shoulders' },
  { label: 'Biceps', value: 'biceps' },
  { label: 'Triceps', value: 'triceps' },
  { label: 'Quads', value: 'quads' },
  { label: 'Hamstrings', value: 'hamstrings' },
  { label: 'Calves', value: 'calves' },
  { label: 'Abs', value: 'abs' },
  { label: 'Other', value: 'other' },
];

export function ExerciseListView() {
  const { exercises, exercisesLoading } = useApp();
  const [filter, setFilter] = useState<MuscleGroup | 'all'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    let list = exercises;
    if (filter !== 'all') list = list.filter(e => e.category === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q));
    }
    return list;
  }, [exercises, filter, search]);

  if (exercisesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Loading exercises...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-bold text-white">Exercises</h1>
        <p className="text-xs text-slate-400">{exercises.length} in catalog</p>
      </header>

      {/* Search */}
      <div className="px-4 pt-3">
        <input
          type="text"
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-800/50 text-white text-sm rounded-lg px-3 py-2 outline-none border border-slate-700/50 focus:border-brand-500"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 px-4 pt-2 pb-1 overflow-x-auto shrink-0">
        {GROUPS.map(g => (
          <button
            key={g.value}
            onClick={() => setFilter(g.value)}
            className={`text-xs px-2.5 py-1 rounded-full whitespace-nowrap transition ${
              filter === g.value ? 'bg-brand-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center text-slate-500 py-10">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm">No exercises found.</p>
          </div>
        ) : (
          filtered.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} />
          ))
        )}
      </div>
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-medium text-white">{exercise.name}</h3>
        <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[exercise.category] || 'bg-slate-700 text-slate-400'}`}>
          {exercise.category}
        </span>
      </div>
      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span>Default: {exercise.defaultSets}×{exercise.defaultReps}</span>
        {exercise.prWeight && (
          <span className="text-amber-400">PR: {exercise.prWeight} lbs {exercise.prDate && `(${exercise.prDate})`}</span>
        )}
      </div>
    </div>
  );
}

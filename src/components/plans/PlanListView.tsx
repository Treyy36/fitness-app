import { useApp } from '../../context/AppContext';

function getExerciseName(
  exercisePlans: Array<{ exerciseId: string; targetSets: number; targetReps: number; notes?: string }>,
  allExercises: Array<{ id: string; name: string }>
): { exerciseId: string; name: string; targetSets: number; targetReps: number; notes?: string }[] {
  return exercisePlans.map((ep) => {
    const ex = allExercises.find((e) => e.id === ep.exerciseId);
    return {
      exerciseId: ep.exerciseId,
      name: ex?.name ?? 'Unknown Exercise',
      targetSets: ep.targetSets,
      targetReps: ep.targetReps,
      notes: ep.notes,
    };
  });
}

export function PlanListView() {
  const { plans, plansLoading, exercises } = useApp();

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (plansLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Loading plans...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-bold text-white">Workout Plans</h1>
        <p className="text-xs text-slate-400">{plans.length} plan{plans.length !== 1 ? 's' : ''} configured</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {plans.length === 0 && (
          <div className="text-center text-slate-500 py-10">
            <p className="text-4xl mb-2">📋</p>
            <p className="text-sm">No plans yet. Go to Chat and ask the AI to create one!</p>
            <p className="text-xs mt-1 text-slate-600">Try: "Create a Push/Pull/Legs split for me"</p>
          </div>
        )}

        {plans.map((plan) => {
          const planExercises = getExerciseName(plan.exercises, exercises);
          return (
            <div key={plan.id} className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">{plan.name}</h3>
                {plan.dayOfWeek !== undefined && (
                  <span className="text-xs px-2 py-0.5 bg-brand-900/50 text-brand-300 rounded-full">
                    {days[plan.dayOfWeek]}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {planExercises.map((ex) => (
                  <div key={ex.exerciseId} className="flex justify-between text-sm">
                    <span className="text-slate-300">{ex.name}</span>
                    <span className="text-slate-500">{ex.targetSets}×{ex.targetReps}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

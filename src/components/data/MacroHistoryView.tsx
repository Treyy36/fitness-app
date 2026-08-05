import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import * as fb from '../../firebase';
import type { MacroLog } from '../../firebase/types';

export function MacroHistoryView() {
  const { userId } = useApp();
  const navigate = useNavigate();
  const [macros, setMacros] = useState<MacroLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const all = await fb.getAllMacroLogs(userId);
      setMacros(all);
      setLoading(false);
    })();
  }, [userId]);

  // Group by date
  const grouped = macros.reduce<Record<string, MacroLog[]>>((acc, m) => {
    (acc[m.date] ||= []).push(m);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 shrink-0 flex items-center gap-3">
        <button onClick={() => navigate('/data')} className="text-slate-400 hover:text-white text-lg">←</button>
        <div>
          <h1 className="text-lg font-bold text-white">Macro History</h1>
          <p className="text-xs text-slate-400">{macros.length} entries across {Object.keys(grouped).length} days</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {macros.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-10">No macros logged yet.</p>
        ) : (
          Object.entries(grouped)
            .sort(([a], [b]) => b.localeCompare(a))
            .map(([date, entries]) => {
              const totals = entries.reduce(
                (acc, m) => ({
                  protein: acc.protein + m.protein,
                  carbs: acc.carbs + m.carbs,
                  fat: acc.fat + m.fat,
                  calories: acc.calories + (m.calories || m.protein * 4 + m.carbs * 4 + m.fat * 9),
                }),
                { protein: 0, carbs: 0, fat: 0, calories: 0 }
              );

              return (
                <div key={date} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{date}</p>
                      <p className="text-xs text-slate-500">{entries.length} meal{entries.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="text-right text-xs">
                      <p className="text-slate-300">{totals.protein}p · {totals.carbs}c · {totals.fat}f</p>
                      <p className="text-slate-500">{totals.calories} kcal</p>
                    </div>
                  </div>
                  <div className="border-t border-slate-700/50 px-4 py-2 space-y-1">
                    {entries.map(m => (
                      <div key={m.id} className="flex justify-between text-xs">
                        <span className="text-slate-400">{m.description}</span>
                        <span className="text-slate-500">
                          {m.protein}p {m.carbs}c {m.fat}f
                          {m.calories ? ` · ${m.calories}kcal` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
        )}
      </div>
    </div>
  );
}

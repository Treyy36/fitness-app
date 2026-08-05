import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import * as fb from '../../firebase';
import type { Session, SessionExercise, MacroLog, WorkoutPlan } from '../../firebase/types';
import { WeightCard } from './WeightCard';
import { TodayWorkoutCard } from './TodayWorkoutCard';

export function DataDashboard() {
  const { userId, sessions, plans, getPlanForDay, exercises } = useApp();
  const navigate = useNavigate();

  const [todaysSession, setTodaysSession] = useState<Session | null>(null);
  const [todaysExercises, setTodaysExercises] = useState<SessionExercise[]>([]);
  const [todaysPlan, setTodaysPlan] = useState<WorkoutPlan | null>(null);
  const [loadingWorkout, setLoadingWorkout] = useState(true);
  const [allMacros, setAllMacros] = useState<MacroLog[]>([]);
  const [proteinGoal, setProteinGoal] = useState(180);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [weightDate, setWeightDate] = useState<string | null>(null);
  const [weightTrend, setWeightTrend] = useState<'up' | 'down' | 'flat' | null>(null);

  const today = new Date().toLocaleDateString('en-CA');

  useEffect(() => {
    (async () => {
      const goal = await fb.getPreference(userId, 'protein_goal');
      if (goal) setProteinGoal(parseInt(goal) || 180);

      const macros = await fb.getAllMacroLogs(userId);
      setAllMacros(macros);

      const weights = await fb.getAllWeightLogs(userId);
      if (weights.length > 0) {
        const latest = weights[0];
        setCurrentWeight(latest.weight);
        setWeightDate(latest.date);
        if (weights.length > 1) {
          setWeightTrend(latest.weight > weights[1].weight ? 'up' : latest.weight < weights[1].weight ? 'down' : 'flat');
        }
      }
    })();
  }, [userId]);

  useEffect(() => {
    (async () => {
      setLoadingWorkout(true);
      const todaySession = sessions.find(s => s.date === today) || null;
      setTodaysSession(todaySession);
      const plan = getPlanForDay(new Date().getDay());
      setTodaysPlan(plan);
      if (todaySession) {
        const exs = await fb.getSessionExercises(userId, todaySession.id);
        setTodaysExercises(exs);
      }
      setLoadingWorkout(false);
    })();
  }, [sessions, plans, userId, today, getPlanForDay]);

  // ─── Computed ─────────────────────────────────────────────────────

  const todayMacros = useMemo(() => {
    const todayEntries = allMacros.filter(m => m.date === today);
    return {
      protein: todayEntries.reduce((s, m) => s + m.protein, 0),
      carbs: todayEntries.reduce((s, m) => s + m.carbs, 0),
      fat: todayEntries.reduce((s, m) => s + m.fat, 0),
      calories: todayEntries.reduce((s, m) => s + (m.calories || m.protein * 4 + m.carbs * 4 + m.fat * 9), 0),
    };
  }, [allMacros, today]);

  const weeklyAverages = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toLocaleDateString('en-CA');
    const weekEntries = allMacros.filter(m => m.date >= cutoff);
    const count = weekEntries.length || 1;
    return {
      protein: Math.round(weekEntries.reduce((s, m) => s + m.protein, 0) / count),
      carbs: Math.round(weekEntries.reduce((s, m) => s + m.carbs, 0) / count),
      fat: Math.round(weekEntries.reduce((s, m) => s + m.fat, 0) / count),
      calories: Math.round(weekEntries.reduce((s, m) => s + (m.calories || m.protein * 4 + m.carbs * 4 + m.fat * 9), 0) / count),
      days: weekEntries.length,
    };
  }, [allMacros]);

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-bold text-white">Dashboard</h1>
        <p className="text-xs text-slate-400">{today}</p>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        {/* ── Weight ── */}
        <WeightCard currentWeight={currentWeight} date={weightDate} trend={weightTrend} />

        {/* ── Today's Macros + Weekly ── */}
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <p className="text-xs text-slate-400 mb-3">Today's Macros</p>
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            <MacroStat label="Protein" value={`${todayMacros.protein} / ${proteinGoal}`} unit="g" color="text-blue-400" size="lg" />
            <MacroStat label="Carbs" value={todayMacros.carbs} unit="g" color="text-amber-400" size="lg" />
            <MacroStat label="Fat" value={todayMacros.fat} unit="g" color="text-red-400" size="lg" />
            <MacroStat label="Calories" value={todayMacros.calories} unit="kcal" color="text-green-400" size="lg" />
          </div>

          <div className="border-t border-slate-700/50 pt-2.5">
            <p className="text-[10px] text-slate-600 mb-1.5">7-day avg · {weeklyAverages.days}d logged</p>
            <div className="flex gap-1 text-center">
              <div className="flex-1"><p className="text-[11px] text-slate-500">{weeklyAverages.protein} <span className="text-slate-600">/ {proteinGoal * 7}</span></p></div>
              <div className="flex-1"><p className="text-[11px] text-slate-500">{weeklyAverages.carbs}</p></div>
              <div className="flex-1"><p className="text-[11px] text-slate-500">{weeklyAverages.fat}</p></div>
              <div className="flex-1"><p className="text-[11px] text-slate-500">{weeklyAverages.calories}</p></div>
            </div>
          </div>
        </div>

        {/* ── Today's Workout ── */}
        <TodayWorkoutCard todaysSession={todaysSession} todaysPlan={todaysPlan} exercises={todaysExercises} loading={loadingWorkout} userId={userId} exerciseCatalog={exercises} />

        {/* ── Macro History Link ── */}
        <button
          onClick={() => navigate('/macros')}
          className="w-full text-left flex items-center justify-between bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:bg-slate-800/70 transition"
        >
          <div>
            <span className="text-sm font-medium text-white">Macro History</span>
            <p className="text-xs text-slate-500">{allMacros.length} day{allMacros.length !== 1 ? 's' : ''}</p>
          </div>
          <span className="text-slate-500">→</span>
        </button>

        {/* ── Session History Link ── */}
        <button
          onClick={() => navigate('/history')}
          className="w-full text-left flex items-center justify-between bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:bg-slate-800/70 transition"
        >
          <div>
            <span className="text-sm font-medium text-white">Session History</span>
            <p className="text-xs text-slate-500">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
          </div>
          <span className="text-slate-500">→</span>
        </button>
      </div>
    </div>
  );
}

function MacroStat({ label, value, unit, color, size = 'lg' }: { label: string; value: string | number; unit: string; color: string; size?: 'lg' | 'sm' }) {
  return (
    <div>
      <p className={`${size === 'lg' ? 'text-lg' : 'text-sm'} font-bold ${color}`}>{value}</p>
      <p className={`${size === 'lg' ? 'text-[10px]' : 'text-[9px]'} text-slate-500`}>{unit}</p>
      <p className={`${size === 'lg' ? 'text-[10px]' : 'text-[9px]'} text-slate-400`}>{label}</p>
    </div>
  );
}

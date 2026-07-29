import { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { db } from '../../db/database';

export function SettingsView() {
  const { setApiKey, hasApiKey } = useChat();
  const [keyInput, setKeyInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [dbStats, setDbStats] = useState({ exercises: 0, plans: 0, sessions: 0 });

  useEffect(() => {
    (async () => {
      const keyPref = await db.userPreferences.get({ key: 'deepseek_api_key' });
      if (keyPref) setKeyInput(keyPref.value);

      const [ex, pl, se] = await Promise.all([
        db.exercises.count(),
        db.workoutPlans.count(),
        db.sessions.count(),
      ]);
      setDbStats({ exercises: ex, plans: pl, sessions: se });
    })();
  }, []);

  const handleSave = async () => {
    await setApiKey(keyInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = async () => {
    if (!confirm('This will delete ALL workout data (plans, sessions, history). This cannot be undone. Continue?')) return;
    await Promise.all([
      db.exercises.clear(),
      db.workoutPlans.clear(),
      db.sessions.clear(),
      db.sessionExercises.clear(),
      db.recommendations.clear(),
      db.userPreferences.clear(),
    ]);
    window.location.replace(window.location.origin + '/fitness-app/');
  };

  return (
    <div className="flex flex-col h-full">
      <header className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 shrink-0">
        <h1 className="text-lg font-bold text-white">Settings</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* API Key */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">DeepSeek API Key</h2>
          <div className="flex gap-2">
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="sk-..."
              className="flex-1 bg-slate-800 text-white placeholder-slate-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={handleSave}
              disabled={!keyInput.trim()}
              className="bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition"
            >
              {saved ? '✓ Saved' : 'Save'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {hasApiKey ? '🟢 API key configured. AI features active.' : '⚫ Enter your key to enable AI features.'}
            {' '}Your key is stored locally and only sent to DeepSeek's API.
          </p>
        </section>

        {/* Database Stats */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Local Data</h2>
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Exercises catalog</span>
              <span className="text-white">{dbStats.exercises}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Workout plans</span>
              <span className="text-white">{dbStats.plans}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Sessions recorded</span>
              <span className="text-white">{dbStats.sessions}</span>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section>
          <h2 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h2>
          <button
            onClick={handleReset}
            className="w-full bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 rounded-xl px-4 py-3 text-sm font-medium transition"
          >
            Reset All Data
          </button>
          <p className="text-xs text-slate-500 mt-1">Deletes all plans, sessions, and settings permanently.</p>
        </section>

        {/* About */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">About</h2>
          <p className="text-xs text-slate-500">
            GymTracker AI v0.1.0<br />
            Built with React + TypeScript + DeepSeek<br />
            All data stored locally on your device.
          </p>
        </section>
      </div>
    </div>
  );
}

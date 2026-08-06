import { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useApp } from '../../context/AppContext';
import * as fb from '../../firebase';
import type { DedupReport } from '../../firebase/dedup';
import { CapabilityRequestsView } from './CapabilityRequestsView';

export function SettingsView() {
  const { setApiKey, hasApiKey } = useChat();
  const { userId, exercises, plans, sessions } = useApp();
  const [keyInput, setKeyInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [dbStats, setDbStats] = useState({ exercises: 0, plans: 0, sessions: 0 });
  const [dedupRunning, setDedupRunning] = useState(false);
  const [dedupReport, setDedupReport] = useState<{ exercises: DedupReport; plans: DedupReport } | null>(null);
  const [dedupError, setDedupError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const key = await fb.getPreference(userId, 'deepseek_api_key');
      if (key) setKeyInput(key);

      setDbStats({ exercises: exercises.length, plans: plans.length, sessions: sessions.length });
    })();
  }, [userId, exercises, plans, sessions]);

  const handleSave = async () => {
    await setApiKey(keyInput.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDedup = async () => {
    if (!confirm(
      'This will merge duplicate exercises and workout plans into single canonical records.\n\n' +
      '• All session history is preserved\n' +
      '• Plan → exercise references are remapped\n' +
      '• Session → plan references are remapped\n' +
      '• Duplicate records are deleted\n\n' +
      'The app will reload after completion. Continue?',
    )) return;

    setDedupRunning(true);
    setDedupError(null);
    setDedupReport(null);

    try {
      const report = await fb.deduplicateAll(userId);
      setDedupReport(report);

      const totalDuplicates = report.exercises.duplicatesDeleted + report.plans.duplicatesDeleted;
      const totalRefUpdates = report.exercises.referencesUpdated + report.plans.referencesUpdated;

      if (totalDuplicates > 0) {
        // Reload to pick up canonicalized data
        setTimeout(() => window.location.reload(), 3000);
      }
    } catch (err: any) {
      setDedupError(err?.message || 'Deduplication failed. Check console for details.');
      console.error('Dedup failed:', err);
    } finally {
      setDedupRunning(false);
    }
  };

  const handleReset = async () => {
    // TODO: Implement Firestore-based reset (delete all user subcollections)
    if (!confirm('This will reload the app. To fully reset data, delete your user data from the Firebase console.')) return;
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

        {/* Data Maintenance */}
        <section>
          <h2 className="text-sm font-semibold text-slate-300 mb-2">Data Maintenance</h2>
          <div className="bg-slate-800/50 rounded-xl p-4 space-y-3">
            <p className="text-xs text-slate-400">
              If you have duplicate workout plans or exercises (same name, different IDs),
              this will merge them into canonical records while preserving all session history.
            </p>

            {dedupError && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-3 py-2 text-xs text-red-400">
                {dedupError}
              </div>
            )}

            {dedupReport && (
              <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-3 space-y-1 text-xs">
                <p className="text-green-400 font-medium mb-1">✓ Deduplication complete</p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Exercises:</span>{' '}
                  {dedupReport.exercises.duplicatesDeleted} duplicates merged,{' '}
                  {dedupReport.exercises.referencesUpdated} references remapped
                </p>
                <p className="text-slate-300">
                  <span className="text-slate-500">Plans:</span>{' '}
                  {dedupReport.plans.duplicatesDeleted} duplicates merged,{' '}
                  {dedupReport.plans.referencesUpdated} references remapped
                </p>
                {(dedupReport.exercises.duplicatesDeleted > 0 || dedupReport.plans.duplicatesDeleted > 0) && (
                  <p className="text-amber-400 mt-1">Reloading app in 3 seconds…</p>
                )}
                {dedupReport.exercises.duplicatesDeleted === 0 && dedupReport.plans.duplicatesDeleted === 0 && (
                  <p className="text-slate-500 mt-1">No duplicates found — your data is clean.</p>
                )}

                {/* Expandable action log */}
                <details className="mt-2">
                  <summary className="text-slate-500 cursor-pointer hover:text-slate-400">
                    Action log ({dedupReport.exercises.actions.length + dedupReport.plans.actions.length} entries)
                  </summary>
                  <div className="mt-2 space-y-0.5 max-h-48 overflow-y-auto bg-slate-900/50 rounded p-2 font-mono text-[10px]">
                    <p className="text-brand-400 font-semibold mb-1">── Exercises ──</p>
                    {dedupReport.exercises.actions.map((a, i) => (
                      <p key={`ex-${i}`} className="text-slate-400 break-all">{a}</p>
                    ))}
                    <p className="text-brand-400 font-semibold mb-1 mt-2">── Plans ──</p>
                    {dedupReport.plans.actions.map((a, i) => (
                      <p key={`pl-${i}`} className="text-slate-400 break-all">{a}</p>
                    ))}
                  </div>
                </details>
              </div>
            )}

            <button
              onClick={handleDedup}
              disabled={dedupRunning}
              className="w-full bg-amber-900/30 hover:bg-amber-900/50 disabled:bg-slate-700 disabled:text-slate-500 text-amber-400 border border-amber-800/50 rounded-xl px-4 py-3 text-sm font-medium transition"
            >
              {dedupRunning ? '⏳ Merging duplicates…' : 'Deduplicate Plans & Exercises'}
            </button>
          </div>
        </section>

        {/* Capability Requests */}
        <section>
          <CapabilityRequestsView />
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

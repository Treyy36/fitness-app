import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import type { CapabilityRequest } from '../../firebase/types';
import * as fb from '../../firebase';

const PRIORITY_COLORS: Record<string, string> = {
  blocking: 'text-red-400 bg-red-900/20 border-red-800/50',
  enhancement: 'text-yellow-400 bg-yellow-900/20 border-yellow-800/50',
  nice_to_have: 'text-blue-400 bg-blue-900/20 border-blue-800/50',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '⏳ Pending',
  approved: '✅ Approved',
  building: '🔨 Building',
  deployed: '🚀 Deployed',
  dismissed: '✕ Dismissed',
};

const PRIORITY_LABELS: Record<string, string> = {
  blocking: '🔴 Blocking',
  enhancement: '🟡 Enhancement',
  nice_to_have: '🔵 Nice to Have',
};

export function CapabilityRequestsView() {
  const { userId } = useApp();
  const [requests, setRequests] = useState<CapabilityRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // TODO: get from auth context when available
  const refresh = useCallback(async () => {
    const all = await fb.getAllCapabilityRequests(userId);
    // Sort: pending first, then by priority (blocking > enhancement > nice_to_have), then newest
    const priorityOrder: Record<string, number> = { blocking: 0, enhancement: 1, nice_to_have: 2 };
    const statusOrder: Record<string, number> = { pending: 0, approved: 1, building: 2, deployed: 3, dismissed: 4 };
    all.sort((a, b) => {
      const sDiff = (statusOrder[a.status] ?? 5) - (statusOrder[b.status] ?? 5);
      if (sDiff !== 0) return sDiff;
      const pDiff = (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
      if (pDiff !== 0) return pDiff;
      return b.createdAt.localeCompare(a.createdAt);
    });
    setRequests(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const updateStatus = async (id: string, status: CapabilityRequest['status']) => {
    await fb.updateCapabilityRequest(userId, id, {
      status,
      ...(status === 'deployed' ? { deployedAt: new Date().toISOString() } : {}),
    } as any);
    await refresh();
  };

  const copyToCopilot = async (req: CapabilityRequest) => {
    const prompt = `The Coach AI in GymTracker requested this capability:

---
**Title**: ${req.title}
**Priority**: ${req.priority}
**Problem**: ${req.problem}
**Blocked Feature**: ${req.blockedFeature}
**Description**: ${req.description}
**Suggested Tools**: ${req.suggestedTools?.join(', ') || 'None specified'}
---

Plan this out and help me implement it.`;

    try {
      await navigator.clipboard.writeText(prompt);
      setCopiedId(req.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for non-HTTPS or older browsers
      const ta = document.createElement('textarea');
      ta.value = prompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(req.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-8 text-center text-slate-400 text-sm">
        Loading capability requests...
      </div>
    );
  }

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">
          Capability Requests
          {pendingCount > 0 && (
            <span className="ml-2 bg-brand-600 text-white text-xs rounded-full px-2 py-0.5">
              {pendingCount}
            </span>
          )}
        </h2>
        <button
          onClick={refresh}
          className="text-xs text-slate-500 hover:text-slate-300 transition"
        >
          Refresh
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-6 text-center">
          <p className="text-slate-400 text-sm mb-1">No capability requests yet.</p>
          <p className="text-slate-500 text-xs">
            When the AI encounters a task it can't complete with its current tools,
            it will file a request here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              className={`rounded-xl border p-4 ${
                req.status === 'pending'
                  ? PRIORITY_COLORS[req.priority] || 'border-slate-700 bg-slate-800/30'
                  : req.status === 'deployed'
                  ? 'border-green-800/50 bg-green-900/10'
                  : req.status === 'dismissed'
                  ? 'border-slate-800 bg-slate-800/20 opacity-60'
                  : 'border-slate-700 bg-slate-800/30'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full border border-slate-700 text-slate-400">
                      {PRIORITY_LABELS[req.priority] || req.priority}
                    </span>
                    <span className="text-xs text-slate-500">
                      {STATUS_LABELS[req.status] || req.status}
                    </span>
                  </div>
                  <h3 className="text-white font-medium mt-1.5">{req.title}</h3>
                </div>
              </div>

              <p className="text-slate-400 text-sm mb-1">
                <span className="text-slate-500">Problem:</span> {req.problem}
              </p>
              <p className="text-slate-400 text-sm mb-1">
                <span className="text-slate-500">Blocked:</span> {req.blockedFeature}
              </p>
              <p className="text-slate-400 text-sm mb-2">{req.description}</p>

              {req.suggestedTools && req.suggestedTools.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {req.suggestedTools.map((tool) => (
                    <span key={tool} className="text-xs bg-slate-700/50 text-slate-300 rounded-lg px-2 py-0.5 font-mono">
                      {tool}
                    </span>
                  ))}
                </div>
              )}

              <div className="text-xs text-slate-500 mb-3">
                {new Date(req.createdAt).toLocaleDateString()} · {new Date(req.createdAt).toLocaleTimeString()}
                {req.deployedAt && ` · Deployed: ${new Date(req.deployedAt).toLocaleDateString()}`}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                {req.status === 'pending' && (
                  <>
                    <button
                      onClick={() => updateStatus(req.id, 'approved')}
                      className="text-xs bg-green-700/30 hover:bg-green-700/50 text-green-400 border border-green-700/50 rounded-lg px-3 py-1.5 transition"
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => updateStatus(req.id, 'dismissed')}
                      className="text-xs bg-slate-700/30 hover:bg-slate-700/50 text-slate-400 border border-slate-700/50 rounded-lg px-3 py-1.5 transition"
                    >
                      ✕ Dismiss
                    </button>
                  </>
                )}
                {req.status === 'approved' && (
                  <>
                    <button
                      onClick={() => copyToCopilot(req)}
                      className="text-xs bg-brand-700/30 hover:bg-brand-700/50 text-brand-400 border border-brand-700/50 rounded-lg px-3 py-1.5 transition"
                    >
                      {copiedId === req.id ? '✓ Copied!' : '📋 Copy for Copilot'}
                    </button>
                    <button
                      onClick={() => updateStatus(req.id, 'building')}
                      className="text-xs bg-blue-700/30 hover:bg-blue-700/50 text-blue-400 border border-blue-700/50 rounded-lg px-3 py-1.5 transition"
                    >
                      🔨 Start Building
                    </button>
                  </>
                )}
                {(req.status === 'approved' || req.status === 'building') && (
                  <button
                    onClick={() => updateStatus(req.id, 'deployed')}
                    className="text-xs bg-green-700/30 hover:bg-green-700/50 text-green-400 border border-green-700/50 rounded-lg px-3 py-1.5 transition"
                  >
                    🚀 Mark Deployed
                  </button>
                )}
                {req.status === 'deployed' && (
                  <span className="text-xs text-green-400 px-3 py-1.5">✓ Complete</span>
                )}
                {req.status === 'dismissed' && (
                  <button
                    onClick={() => updateStatus(req.id, 'pending')}
                    className="text-xs bg-slate-700/30 hover:bg-slate-700/50 text-slate-400 border border-slate-700/50 rounded-lg px-3 py-1.5 transition"
                  >
                    ↩ Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

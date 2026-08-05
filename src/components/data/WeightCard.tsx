interface WeightCardProps {
  currentWeight: number | null;
  date: string | null;
  trend: 'up' | 'down' | 'flat' | null;
}

export function WeightCard({ currentWeight, date, trend }: WeightCardProps) {
  const trendIcon = { up: '↗', down: '↘', flat: '→' };
  const trendColor = { up: 'text-red-400', down: 'text-green-400', flat: 'text-slate-400' };

  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
      <p className="text-xs text-slate-400 mb-1">Current Weight</p>
      {currentWeight ? (
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-white">{currentWeight}<span className="text-sm text-slate-400 font-normal"> lbs</span></p>
          {trend && (
            <span className={`text-sm ${trendColor[trend]}`}>{trendIcon[trend]}</span>
          )}
        </div>
      ) : (
        <p className="text-xl text-slate-500">—</p>
      )}
      {date && <p className="text-xs text-slate-500 mt-1">{date}</p>}
    </div>
  );
}

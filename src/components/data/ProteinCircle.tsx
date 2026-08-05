interface ProteinCircleProps {
  current: number;    // grams consumed today
  goal: number;       // daily goal in grams
}

export function ProteinCircle({ current, goal }: ProteinCircleProps) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center">
      <svg width="120" height="120" viewBox="0 0 120 120" className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke="rgb(30 41 59)" // slate-800
          strokeWidth="8"
        />
        {/* Progress arc */}
        <circle
          cx="60" cy="60" r={radius}
          fill="none"
          stroke={pct >= 1 ? 'rgb(34 197 94)' : 'rgb(99 102 241)'} // green or indigo
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }}
        />
      </svg>
      <div className="relative -mt-[90px] mb-2 text-center">
        <p className="text-2xl font-bold text-white">{current}</p>
        <p className="text-xs text-slate-400">of {goal}g</p>
      </div>
      <p className="text-xs text-slate-500 font-medium">Protein</p>
    </div>
  );
}

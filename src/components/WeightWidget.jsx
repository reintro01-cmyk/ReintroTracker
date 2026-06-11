import { useState } from "react";
import { TrendingDown, TrendingUp, Target, ArrowRight } from "lucide-react";

export function WeightWidget({ weights, weightGoal, onSetGoal, onNavigate }) {
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
  const startW = sorted.length > 0 ? sorted[0] : null;
  const [editing, setEditing] = useState(false);
  const [goalInput, setGoalInput] = useState(String(weightGoal ?? ""));

  const change = startW && latest && startW.date !== latest.date
    ? (latest.kg - startW.kg).toFixed(1)
    : null;

  const progress = latest && weightGoal && startW && startW.kg > weightGoal
    ? Math.max(0, Math.min(100, ((startW.kg - latest.kg) / (startW.kg - weightGoal)) * 100))
    : 0;

  function saveGoal() {
    const v = parseFloat(goalInput);
    onSetGoal(isNaN(v) ? null : v);
    setEditing(false);
  }

  const changeNum  = change == null ? null : parseFloat(change);
  const isPositive = changeNum != null && changeNum < 0;
  const isGain     = changeNum != null && changeNum > 0;
  const accentBorder = isPositive ? "border-l-4 border-l-emerald-500" : "border-l border-l-slate-200";

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 ${accentBorder}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Weight</div>
        <button onClick={() => onNavigate("profile")} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
          History <ArrowRight size={11} />
        </button>
      </div>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="text-3xl font-extrabold text-slate-900 tabular-nums leading-none">
            {latest ? latest.kg : "—"}
            <span className="text-base font-normal text-slate-500 ml-1">kg</span>
          </div>
          {changeNum != null && (
            <div className={`mt-2 flex items-baseline gap-1.5 font-extrabold tabular-nums ${
              isPositive ? "text-emerald-600" : isGain ? "text-rose-500" : "text-slate-600"
            }`}>
              {isPositive
                ? <TrendingDown size={18} className="self-center text-emerald-600" />
                : isGain
                ? <TrendingUp size={18} className="self-center text-rose-500" />
                : null}
              <span className="text-2xl leading-none">{isGain ? "+" : ""}{change} kg</span>
              <span className="text-xs font-semibold opacity-70">since start</span>
            </div>
          )}
          {!latest && (
            <div className="text-xs text-slate-500 mt-1">Log your first weight in Profile</div>
          )}
        </div>
        <div className="text-right shrink-0">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveGoal()}
                className="w-20 rounded-lg border-2 border-indigo-300 px-2 py-1 text-sm text-right focus:outline-none"
                placeholder="kg"
                autoFocus
              />
              <button onClick={saveGoal} className="text-xs font-bold text-emerald-600 hover:text-emerald-800 px-1">✓</button>
            </div>
          ) : (
            <button
              onClick={() => { setGoalInput(String(weightGoal ?? "")); setEditing(true); }}
              className="flex flex-col items-end group"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 flex items-center gap-1">
                <Target size={9} /> Goal
              </div>
              <div className="text-sm font-semibold text-slate-500 group-hover:text-indigo-600 transition-colors">
                {weightGoal ? `${weightGoal} kg` : <span className="text-xs text-indigo-500">Set goal</span>}
              </div>
            </button>
          )}
        </div>
      </div>
      {weightGoal && latest && (
        <div>
          <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1.5">
            <span>Current: {latest.kg} kg</span>
            <span>Goal: {weightGoal} kg</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="text-[10px] text-slate-500 mt-1.5 text-right font-semibold">
            {Math.round(progress)}% to goal · {Math.abs(latest.kg - weightGoal).toFixed(1)} kg to go
          </div>
        </div>
      )}
    </div>
  );
}

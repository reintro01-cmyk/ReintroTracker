import { displayDate } from "../utils/dates";
import { RingProgress } from "./RingProgress.jsx";

export function PhaseHeroCard({ phaseInfo, stats, reintroStart, nextFood, finishDate }) {
  const PHASE = {
    pre: {
      bg: "bg-indigo-50 border-indigo-100",
      bar: "bg-indigo-400",
      labelCls: "text-indigo-500",
      title: "Programme not started yet",
      valueCls: "text-indigo-800",
      ringAccent: "#6366f1",
      ringTrack:  "#c7d2fe",
    },
    detox: {
      bg: "bg-amber-50 border-amber-100",
      bar: "bg-amber-400",
      labelCls: "text-amber-600",
      title: "Detox Phase",
      valueCls: "text-amber-900",
      ringAccent: "#f59e0b",
      ringTrack:  "#fde68a",
    },
    reintro: {
      bg: "bg-emerald-50 border-emerald-100",
      bar: "bg-emerald-500",
      labelCls: "text-emerald-600",
      title: "Reintroduction",
      valueCls: "text-emerald-900",
      ringAccent: "#10b981",
      ringTrack:  "#a7f3d0",
    },
  };
  const c = PHASE[phaseInfo.phase] || PHASE.pre;
  const totalDays = phaseInfo.totalDays ?? 14;
  const progress = phaseInfo.phase === "detox"
    ? Math.round((phaseInfo.day / totalDays) * 100)
    : phaseInfo.phase === "reintro"
    ? Math.min(100, stats.percent)
    : 0;

  if (phaseInfo.phase === "detox") {
    const remaining = totalDays - phaseInfo.day;
    return (
      <div className={`rounded-2xl border ${c.bg} p-5`}>
        <div className="flex items-center gap-5">
          <RingProgress
            percent={progress}
            day={phaseInfo.day}
            total={totalDays}
            accent={c.ringAccent}
            track={c.ringTrack}
          />
          <div className="min-w-0 flex-1">
            <div className={`text-[11px] font-bold uppercase tracking-widest ${c.labelCls} mb-1`}>
              Current phase
            </div>
            <div className={`text-xl font-extrabold ${c.valueCls} leading-tight`}>{c.title}</div>
            <div className={`text-sm font-medium ${c.valueCls} opacity-80 mt-2`}>
              {remaining} {remaining === 1 ? "day" : "days"} remaining
              {nextFood && <> · Next: <span className="font-bold">{nextFood.name}</span></>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const kv = phaseInfo.phase === "reintro"
    ? [
        { label: "Foods tested", value: `${stats.done} / ${stats.active}` },
        { label: "Safe", value: stats.safe },
      ]
    : phaseInfo.daysUntilStart != null
    ? [{ label: "Starts in", value: `${phaseInfo.daysUntilStart} days` }]
    : [];

  return (
    <div className={`rounded-2xl border ${c.bg} p-5`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className={`text-[11px] font-bold uppercase tracking-widest ${c.labelCls} mb-1`}>
            Current phase
          </div>
          <div className={`text-xl font-extrabold ${c.valueCls}`}>{c.title}</div>
        </div>
        <div className={`text-3xl font-extrabold ${c.valueCls} shrink-0 tabular-nums`}>
          {stats.percent}<span className="text-base font-semibold opacity-50">%</span>
        </div>
      </div>

      <div className="w-full bg-white/60 rounded-full h-2 mb-4 overflow-hidden">
        <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${progress}%` }} />
      </div>

      <div className="flex gap-6 flex-wrap">
        {kv.map(({ label, value }) => (
          <div key={label}>
            <div className={`text-[11px] font-semibold uppercase tracking-wide ${c.labelCls}`}>{label}</div>
            <div className={`text-lg font-bold ${c.valueCls}`}>{value}</div>
          </div>
        ))}
        {nextFood && (
          <div>
            <div className={`text-[11px] font-semibold uppercase tracking-wide ${c.labelCls}`}>Next food</div>
            <div className={`text-sm font-bold ${c.valueCls} truncate max-w-[120px]`}>{nextFood.name}</div>
          </div>
        )}
        {finishDate && phaseInfo.phase === "reintro" && (
          <div>
            <div className={`text-[11px] font-semibold uppercase tracking-wide ${c.labelCls}`}>Finishes</div>
            <div className={`text-sm font-bold ${c.valueCls}`}>{displayDate(finishDate)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

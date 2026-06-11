const PHASE_CONFIG = {
  pre: {
    label:    "Programme hasn't started yet",
    bg:       "bg-gradient-to-r from-indigo-50 to-indigo-100",
    bar:      "bg-indigo-500",
    text:     "text-indigo-900",
    textSoft: "text-indigo-700/80",
    track:    "bg-indigo-200/60",
  },
  detox: {
    label:    "Detox Phase",
    bg:       "bg-gradient-to-r from-[#fef3c7] to-[#fde68a]",
    bar:      "bg-amber-600",
    text:     "text-amber-900",
    textSoft: "text-amber-800/80",
    track:    "bg-amber-200/70",
  },
  reintro: {
    label:    "Reintroduction Phase",
    bg:       "bg-gradient-to-r from-emerald-50 to-emerald-100",
    bar:      "bg-emerald-600",
    text:     "text-emerald-900",
    textSoft: "text-emerald-700/80",
    track:    "bg-emerald-200/60",
  },
};

export function PhaseBanner({ phaseInfo, dailyCalories }) {
  const cfg = PHASE_CONFIG[phaseInfo.phase];
  const totalDays = phaseInfo.totalDays ?? 14;

  let subtitle = "";
  let progress = 0;
  if (phaseInfo.phase === "pre") {
    subtitle = `Programme starts in ${phaseInfo.daysUntilStart} day${phaseInfo.daysUntilStart === 1 ? "" : "s"} · Detox phase begins on Day 1`;
  } else if (phaseInfo.phase === "detox") {
    subtitle = `Day ${phaseInfo.day} of ${totalDays} · Strict detox foods only · ${dailyCalories} kcal / day`;
    progress = (phaseInfo.day / totalDays) * 100;
  } else {
    subtitle = `Reintroduction Day ${phaseInfo.day} · ${phaseInfo.safeCount} safe food${phaseInfo.safeCount !== 1 ? "s" : ""} unlocked`;
    progress = Math.min(100, phaseInfo.day);
  }

  return (
    <div className={`${cfg.bg} rounded-2xl p-5`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={`text-xs font-bold uppercase tracking-widest ${cfg.textSoft} mb-1`}>Current phase</div>
          <div className={`text-xl font-extrabold ${cfg.text}`}>{cfg.label}</div>
          <div className={`text-sm font-medium ${cfg.textSoft} mt-0.5`}>{subtitle}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-3xl font-extrabold ${cfg.text} tabular-nums`}>{dailyCalories}</div>
          <div className={`text-xs ${cfg.textSoft}`}>kcal / day</div>
        </div>
      </div>
      {phaseInfo.phase !== "pre" && (
        <div className="mt-4">
          <div className={`w-full ${cfg.track} rounded-full h-1.5 overflow-hidden`}>
            <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${progress}%` }} />
          </div>
          {phaseInfo.phase === "detox" && (
            <div className={`text-xs ${cfg.textSoft} mt-1`}>
              {totalDays - phaseInfo.day} day{totalDays - phaseInfo.day !== 1 ? "s" : ""} remaining in detox phase
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { displayDate } from "../utils/dates";
import { StatusBadge } from "./StatusBadge.jsx";
import { Button } from "./ui.jsx";
import { Clock, Flame, CheckCircle2, ChevronRight } from "lucide-react";

export function TodayCard({ todayItem, status, onSelect, programmeStart, reintroStart, phaseInfo, nextFoodName }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reintroStartDate = new Date(reintroStart);
  reintroStartDate.setHours(0, 0, 0, 0);
  const daysUntilReintro = Math.ceil((reintroStartDate - today) / (1000 * 60 * 60 * 24));
  const detoxStart = new Date(programmeStart);
  detoxStart.setHours(0, 0, 0, 0);
  const isDetox = today >= detoxStart && today < reintroStartDate;

  if (!todayItem) {
    if (daysUntilReintro > 0 && today < detoxStart) {
      const daysUntilDetox = Math.ceil((detoxStart - today) / (1000 * 60 * 60 * 24));
      return (
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Clock className="text-indigo-500" size={28} />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-1">Programme starts in</div>
            <div className="text-3xl font-bold text-indigo-700">{daysUntilDetox} {daysUntilDetox === 1 ? "day" : "days"}</div>
            <div className="text-sm text-indigo-500 mt-0.5">
              Detox: {detoxStart.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ·
              Reintroduction: {reintroStartDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          </div>
        </div>
      );
    }
    if (isDetox) {
      const totalDays = phaseInfo?.totalDays ?? 14;
      const day = phaseInfo?.day ?? 1;
      const halfway = day > totalDays / 2;
      const headline = halfway
        ? `Day ${day} — you're past halfway. Stay clean today.`
        : `Day ${day} of ${totalDays} — stay clean today.`;
      const reintroLong = reintroStartDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
      const subtext = nextFoodName
        ? `${nextFoodName} reintroduction begins ${reintroLong} — ${daysUntilReintro} ${daysUntilReintro === 1 ? "day" : "days"} away.`
        : `Reintroduction begins ${reintroLong} — ${daysUntilReintro} ${daysUntilReintro === 1 ? "day" : "days"} away.`;
      return (
        <div className="relative rounded-2xl border border-amber-200 bg-amber-50 p-6 pl-7 overflow-hidden">
          <span className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-amber-500" />
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-200 px-2 py-1 text-[11px] font-bold text-amber-700">
            <Flame size={11} className="text-amber-500" />
            {day}-day streak
          </span>
          <div className="flex items-center gap-4 pr-24">
            <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
              <Flame className="text-amber-500" size={28} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-1">Detox phase active</div>
              <div className="text-lg font-extrabold text-amber-900 leading-snug">{headline}</div>
              <div className="text-sm font-medium text-amber-700 mt-1">{subtext}</div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
          <CheckCircle2 className="text-emerald-500" size={28} />
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-1">Programme complete!</div>
          <div className="text-2xl font-bold text-emerald-800">All foods tested 🎉</div>
          <div className="text-sm text-emerald-600 mt-0.5">Check the Database tab to review your results.</div>
        </div>
      </div>
    );
  }

  const foodStatus = status[todayItem.food.id] || "Pending";
  const isIntroduce = todayItem.type === "Introduce";
  const gradientCls = isIntroduce ? "from-indigo-600 to-indigo-500" : "from-sky-600 to-sky-500";
  const bgCls = isIntroduce ? "bg-indigo-50 border-indigo-200" : "bg-sky-50 border-sky-200";

  return (
    <div className={`rounded-2xl border-2 ${bgCls} overflow-hidden`}>
      <div className={`bg-gradient-to-r ${gradientCls} px-6 py-4 flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">
              Today · {displayDate(todayItem.date)}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">{todayItem.type}: {todayItem.food.name}</h2>
          <p className="text-sm text-white/75 mt-0.5">{todayItem.food.portion}</p>
        </div>
        <div className="shrink-0">
          <StatusBadge status={foodStatus} />
        </div>
      </div>
      <div className="px-6 py-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">
          {isIntroduce
            ? "Eat the planned portion and note how you feel."
            : "How did your body respond? Log your symptoms and observations."}
        </div>
        <Button onClick={() => onSelect(todayItem)} className="ml-4 shrink-0 gap-1.5">
          {isIntroduce ? "Log intake" : "Log observation"}
          <ChevronRight size={14} />
        </Button>
      </div>
    </div>
  );
}

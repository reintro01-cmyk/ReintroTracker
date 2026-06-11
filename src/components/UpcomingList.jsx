import { iso } from "../utils/dates";
import { GROUP_DOT_COLORS } from "../utils/groupColors.js";
import { StatusBadge } from "./StatusBadge.jsx";
import { ArrowRight, ChevronRight } from "lucide-react";

export function UpcomingList({ schedule, status, onSelect, onNavigate }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = iso(today);

  const upcoming = schedule
    .filter(item => item.iso >= todayIso && item.type === "Introduce")
    .slice(0, 3);

  if (!upcoming.length) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Up next</h3>
        <button onClick={() => onNavigate("schedule")} className="text-xs font-semibold text-indigo-500 hover:text-indigo-700 flex items-center gap-1">
          Full schedule <ArrowRight size={11} />
        </button>
      </div>
      <div className="space-y-2">
        {upcoming.map(item => {
          const foodStatus = status[item.food.id] || "Pending";
          const isToday = item.iso === todayIso;
          const dotCls = GROUP_DOT_COLORS[item.food.group] || "bg-slate-400";
          const showDot = foodStatus === "Pending";
          return (
            <button
              key={`${item.iso}-${item.type}`}
              onClick={() => onSelect(item)}
              className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-all hover:shadow-sm hover:border-slate-300 ${
                isToday ? "border-indigo-200 bg-indigo-50" : "border-slate-100 bg-white"
              }`}
            >
              <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center text-xs font-bold shrink-0 ${
                isToday ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-500"
              }`}>
                <span>{item.date.getDate()}</span>
                <span className="text-[9px] leading-none">{item.date.toLocaleDateString("en-IN", { month: "short" })}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-slate-800 truncate flex items-center gap-2">
                  {showDot && <span className={`w-2 h-2 rounded-full shrink-0 ${dotCls}`} />}
                  <span className="truncate">{item.food.name}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {item.type} · {item.food.group} · {item.date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
              </div>
              {!showDot && <StatusBadge status={foodStatus} />}
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

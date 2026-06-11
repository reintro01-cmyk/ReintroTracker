import { useState } from "react";
import { Legend } from "../Legend.jsx";
import { MonthView } from "../MonthView.jsx";
import { FoodManager } from "../FoodManager.jsx";
import { GROUP_COLORS } from "../../utils/groupColors.js";
import { CalendarDays, ListChecks } from "lucide-react";

const SUBTABS = [
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "foods", label: "Foods", icon: ListChecks },
];

export function ScheduleTab({
  months, foods, removed, status, allergies, favouriteFoods,
  introOrder, preferredGroups, recentlyClearedFoodId, reintroStart, schedule,
  onSelect, onReorderGroups, onResetOrder, onUpdateAllergies,
  onAddFood, onRemoveFood, onRestoreFood, onMoveFood, onToggleFav,
}) {
  const [sub, setSub] = useState("calendar");
  const [scheduleFilter, setScheduleFilter] = useState("All");

  const visibleMonths = scheduleFilter === "All"
    ? months
    : months
        .map(m => ({ ...m, items: m.items.filter(i => i.food.group === scheduleFilter) }))
        .filter(m => m.items.length > 0);

  return (
    <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto space-y-5 animate-fadeUp">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Plan</div>
        <h1 className="text-xl font-bold text-slate-900">Schedule &amp; foods</h1>
      </div>

      {/* sub-tabs */}
      <div className="flex gap-1.5">
        {SUBTABS.map(t => (
          <button
            key={t.id}
            onClick={() => setSub(t.id)}
            aria-current={sub === t.id ? "page" : undefined}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
              sub === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {sub === "calendar" ? (
        <div className="space-y-6">
          <Legend groupColors={GROUP_COLORS} selected={scheduleFilter} onSelect={setScheduleFilter} />
          {!visibleMonths.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-sm font-semibold text-slate-700">No {scheduleFilter} foods scheduled.</p>
              <p className="text-xs text-slate-500 mt-1">Pick another category or tap All to see everything.</p>
            </div>
          ) : (
            visibleMonths.map(month => (
              <MonthView
                key={month.key}
                month={month}
                status={status}
                onSelect={onSelect}
                groupColors={GROUP_COLORS}
                recentlyClearedFoodId={recentlyClearedFoodId}
              />
            ))
          )}
        </div>
      ) : (
        <FoodManager
          foods={foods}
          removed={removed}
          status={status}
          allergies={allergies}
          favouriteFoods={favouriteFoods}
          reintroStart={reintroStart}
          schedule={schedule}
          introOrder={introOrder}
          preferredGroups={preferredGroups}
          onAddFood={onAddFood}
          onRemoveFood={onRemoveFood}
          onRestoreFood={onRestoreFood}
          onMoveFood={onMoveFood}
          onReorderGroups={onReorderGroups}
          onResetOrder={onResetOrder}
          onUpdateAllergies={onUpdateAllergies}
          onToggleFav={onToggleFav}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}

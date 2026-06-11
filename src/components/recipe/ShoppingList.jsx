import { useState, useMemo } from "react";
import { getEffectiveSlots, getSlotBudget, getRecipesForSlot } from "../../utils/mealPlanner.js";

export function ShoppingList({ phaseInfo, safeFoodIds, dailyCalories, mealMerge, statusMap, favouriteFoodIds }) {
  const [checked, setChecked] = useState(new Set());

  const items = useMemo(() => {
    const map = {};
    const effectiveSlots = getEffectiveSlots(mealMerge);
    effectiveSlots.forEach(slot => {
      const slotKcal = getSlotBudget(dailyCalories, slot);
      const types = slot.type === "proteincarb" ? ["protein", "vegcarb"] : [slot.type];
      types.forEach(t => {
        const kcal = slot.type === "proteincarb" ? Math.round(slotKcal * (t === "protein" ? 0.6 : 0.4)) : slotKcal;
        const recipes = getRecipesForSlot(t, phaseInfo, safeFoodIds, kcal, [], { statusMap, favouriteFoodIds });
        const top = recipes[0];
        if (!top?.ingredients) return;
        top.ingredients.forEach(({ name, qty }) => {
          const key = name.toLowerCase().trim();
          if (!map[key]) map[key] = { name, qtys: [] };
          if (qty) map[key].qtys.push(qty);
        });
      });
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [phaseInfo, safeFoodIds, dailyCalories, mealMerge, statusMap, favouriteFoodIds]);

  function toggle(name) {
    setChecked(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  if (!items.length) {
    return <p className="text-sm text-slate-500 text-center py-3">No recipes available for today's plan.</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map(({ name, qtys }) => {
        const done = checked.has(name);
        return (
          <button
            key={name}
            onClick={() => toggle(name)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all ${
              done ? "border-emerald-100 bg-emerald-50 opacity-60" : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50"
            }`}
          >
            <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center text-[9px] font-black transition-colors ${
              done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
            }`}>
              {done && "✓"}
            </span>
            <span className={`text-sm flex-1 font-medium ${done ? "line-through text-slate-500" : "text-slate-700"}`}>{name}</span>
            {qtys[0] && <span className="text-xs text-slate-500 shrink-0">{qtys[0]}</span>}
          </button>
        );
      })}
      <p className="text-center text-[11px] text-slate-500 pt-1">
        {checked.size}/{items.length} checked · Top recipe per slot
      </p>
    </div>
  );
}

import { useState } from "react";
import { DEFAULT_FOODS } from "../../data/foods";
import { ShieldAlert } from "lucide-react";

// Common allergen quick-picks. ids are resolved against the live food list, so an id that
// doesn't exist is silently dropped (safe). Each preset toggles all of its foods at once.
const PRESETS = [
  { label: "Fish", ids: ["fish", "salmon", "tuna"] },
  { label: "Shellfish", ids: ["prawns", "crab"] },
  { label: "Peanuts", ids: ["peanuts"] },
  { label: "Tree nuts", ids: ["almonds", "cashews", "walnuts", "pistachios"] },
  { label: "Dairy", ids: ["milk", "curd", "cheese", "paneer", "buttermilk", "greek-yogurt", "cream-malai", "cheddar", "parmesan", "feta", "mozzarella", "gouda", "ricotta", "cottage-cheese", "swiss-cheese"] },
  { label: "Eggs", ids: ["eggs"] },
  { label: "Soy", ids: ["soy-sauce", "soya-chunks"] },
  { label: "Sesame", ids: ["sesame-seeds"] },
  { label: "Mushroom", ids: ["mushroom"] },
];

const FOOD_IDS = new Set(DEFAULT_FOODS.map(f => f.id));

export function StepAllergies({ allergies, setAllergies }) {
  const [search, setSearch] = useState("");
  const sel = new Set(allergies);

  const toggle = id => setAllergies(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleMany = ids => setAllergies(prev => {
    const valid = ids.filter(id => FOOD_IDS.has(id));
    const allOn = valid.every(id => prev.includes(id));
    return allOn ? prev.filter(id => !valid.includes(id)) : [...new Set([...prev, ...valid])];
  });
  const presetOn = ids => {
    const valid = ids.filter(id => FOOD_IDS.has(id));
    return valid.length > 0 && valid.every(id => sel.has(id));
  };

  const filtered = search
    ? DEFAULT_FOODS.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="space-y-4 animate-fadeUp">
      <div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Any food allergies?</h2>
        <p className="text-sm text-slate-500">
          We'll never suggest recipes with these and won't add them to your reintroduction schedule.
          Leave blank if none — you can change this anytime.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.filter(p => p.ids.some(id => FOOD_IDS.has(id))).map(p => {
          const on = presetOn(p.ids);
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => toggleMany(p.ids)}
              aria-pressed={on}
              className={`text-sm font-semibold px-3 py-1.5 rounded-full border-2 transition-all ${
                on ? "border-rose-400 bg-rose-50 text-rose-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <input
        type="text" placeholder="Search for another food…" value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
      />

      {filtered.length > 0 && (
        <div className="max-h-44 overflow-y-auto pr-1 space-y-1">
          {filtered.map(food => (
            <label
              key={food.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                sel.has(food.id) ? "border-rose-200 bg-rose-50" : "border-slate-100 bg-white hover:border-slate-200"
              }`}
            >
              <input
                type="checkbox" className="accent-rose-600 w-4 h-4 shrink-0"
                checked={sel.has(food.id)}
                onChange={() => toggle(food.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{food.name}</div>
                <div className="text-xs text-slate-500">{food.group}</div>
              </div>
            </label>
          ))}
        </div>
      )}

      {allergies.length > 0 && (
        <div className="flex items-start gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span>
            {allergies.length} food{allergies.length !== 1 ? "s" : ""} marked as allergies — excluded from recipes and your schedule.
          </span>
        </div>
      )}
    </div>
  );
}

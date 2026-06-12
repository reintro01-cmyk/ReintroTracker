import { useState } from "react";
import { DEFAULT_FOODS } from "../../data/foods";
import { ShieldAlert, Leaf, X } from "lucide-react";

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

export function StepAllergies({ allergies, setAllergies, showSafeFoods = false, safeFoods = [], setSafeFoods }) {
  const [search, setSearch] = useState("");
  const [safeSearch, setSafeSearch] = useState("");
  const sel = new Set(allergies);
  const safeSel = new Set(safeFoods);
  const FOODS_BY_ID = Object.fromEntries(DEFAULT_FOODS.map(f => [f.id, f]));

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

  // Safe-foods: tap to mark as already-known-safe. Mutually exclusive with allergies —
  // can't be both. Adding to safe removes from allergies; same in reverse.
  const toggleSafe = id => {
    if (!setSafeFoods) return;
    setSafeFoods(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    if (sel.has(id)) setAllergies(prev => prev.filter(x => x !== id));
  };

  const filtered = search
    ? DEFAULT_FOODS.filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
    : [];
  const safeFiltered = safeSearch
    ? DEFAULT_FOODS.filter(f => f.name.toLowerCase().includes(safeSearch.toLowerCase()) && !safeSel.has(f.id) && !sel.has(f.id))
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

      {showSafeFoods && (
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <div className="flex items-start gap-2">
            <Leaf size={16} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">Any foods you already know are safe?</h3>
              <p className="text-xs text-slate-500">
                Eaten recently without trouble? Mark them as Safe — they'll be cleared on day 1 so we can plan around them.
              </p>
            </div>
          </div>

          <input
            type="text" placeholder="Search foods you tolerate well…" value={safeSearch}
            onChange={e => setSafeSearch(e.target.value)}
            aria-label="Search foods to mark as safe"
            className="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
          />

          {safeFiltered.length > 0 && (
            <div className="max-h-44 overflow-y-auto pr-1 space-y-1">
              {safeFiltered.map(food => (
                <button
                  key={food.id} type="button" onClick={() => { toggleSafe(food.id); setSafeSearch(""); }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-slate-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 text-left transition-all"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800">{food.name}</div>
                    <div className="text-xs text-slate-500">{food.group}</div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 shrink-0">+ Safe</span>
                </button>
              ))}
            </div>
          )}

          {safeFoods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {safeFoods.map(id => (
                <span key={id} className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
                  {FOODS_BY_ID[id]?.name || id}
                  <button type="button" onClick={() => toggleSafe(id)} aria-label={`Remove ${FOODS_BY_ID[id]?.name || id} from safe`}
                    className="text-emerald-600 hover:text-emerald-800"><X size={12} /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

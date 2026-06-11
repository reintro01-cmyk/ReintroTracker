import { useState, useMemo } from "react";
import { Button } from "./ui.jsx";
import { MEAL_SLOTS, getCurrentPhase, getSlotBudget, getEffectiveSlots } from "../utils/mealPlanner.js";
import { PhaseBanner } from "./recipe/PhaseBanner.jsx";
import { NutritionPanel, DailyTotals, MacroBar } from "./recipe/NutritionPanel.jsx";
import { ShoppingList } from "./recipe/ShoppingList.jsx";
import { SlotCard } from "./recipe/SlotCard.jsx";
import { MyRecipes } from "./recipe/MyRecipes.jsx";
import { AddRecipeModal } from "./recipe/AddRecipeModal.jsx";
import { useFoodLog } from "../hooks/useFoodLog.js";
import { useMyRecipes } from "../hooks/useMyRecipes.js";
import { Settings2, ShoppingCart, Info, Droplets, Leaf, FlameKindling } from "lucide-react";

export function RecipeBook({ session, country = "india", nutrition, onNutritionChange, statusMap, favourites, favouriteFoods = [], onToggleFavourite, programmeStart, detoxDuration = 14, foods = [] }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [openSlotId, setOpenSlotId] = useState(MEAL_SLOTS[0]?.id ?? null);
  const [showAdd, setShowAdd] = useState(false);

  const { search, fetchMeasures, units, addLog } = useFoodLog(session);
  const my = useMyRecipes(session);

  function logRecipe(r) {
    const n = r.nutrition || {};
    return addLog({
      source: "recipe", recipe_id: r.id, custom_name: r.name, meal: "lunch",
      qty: 1, unit: "serving", grams: null,
      kcal: n.energy_kcal, protein_g: n.protein_g, fat_g: n.fat_g, carb_g: n.carb_avail_g, fibre_g: n.fibre_g,
    });
  }

  const phaseInfo = useMemo(
    () => getCurrentPhase(statusMap, programmeStart, detoxDuration),
    [statusMap, programmeStart, detoxDuration]
  );

  const safeFoodIds = useMemo(
    () => Object.entries(statusMap).filter(([, v]) => v === "Safe").map(([k]) => k),
    [statusMap]
  );

  const safeFoodNames = useMemo(() => {
    const nameMap = Object.fromEntries(foods.map(f => [f.id, f.name]));
    return safeFoodIds.map(id => nameMap[id] || id);
  }, [safeFoodIds, foods]);

  const { dailyCalories, macros } = nutrition;

  const reminders = (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">Daily reminders</div>
      <div className="grid sm:grid-cols-1 gap-3 text-sm text-slate-600">
        <div className="flex items-start gap-2"><Droplets size={15} className="text-blue-400 shrink-0 mt-0.5" /><span>3 litres of water throughout the day</span></div>
        <div className="flex items-start gap-2"><Leaf size={15} className="text-green-500 shrink-0 mt-0.5" /><span>3 green teas — morning, midday, evening</span></div>
        <div className="flex items-start gap-2"><FlameKindling size={15} className="text-orange-400 shrink-0 mt-0.5" /><span>No snacking between meal slots</span></div>
      </div>
    </div>
  );

  const shoppingPanel = (
    <ShoppingList
      phaseInfo={phaseInfo} safeFoodIds={safeFoodIds} dailyCalories={dailyCalories}
      mealMerge={nutrition.mealMerge} statusMap={statusMap} favouriteFoodIds={favouriteFoods}
    />
  );

  return (
    <div className="animate-fadeUp">
      <PhaseBanner phaseInfo={phaseInfo} dailyCalories={dailyCalories} />

      <div className="mt-5 lg:grid lg:grid-cols-[1fr_280px] lg:gap-6 space-y-5 lg:space-y-0">

        {/* ── Left: macro summary + meal slots ── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <DailyTotals dailyCalories={dailyCalories} macros={macros} />
            <div className="flex gap-2 lg:hidden">
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(v => !v)} className="gap-2 shrink-0">
                <Settings2 size={14} />{settingsOpen ? "Hide" : "Targets"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShoppingOpen(v => !v)} className="gap-2 shrink-0">
                <ShoppingCart size={14} />{shoppingOpen ? "Hide" : "Shopping"}
              </Button>
            </div>
          </div>

          {settingsOpen && (
            <div className="lg:hidden rounded-2xl border border-slate-200 bg-white p-5">
              <NutritionPanel nutrition={nutrition} onChange={onNutritionChange} />
            </div>
          )}

          {shoppingOpen && (
            <div className="lg:hidden rounded-2xl border border-slate-200 overflow-hidden bg-white">
              <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-3">
                <div className="text-xs font-bold uppercase tracking-widest text-indigo-600">Shopping list</div>
              </div>
              <div className="p-4">{shoppingPanel}</div>
            </div>
          )}

          {(phaseInfo.phase === "detox" || phaseInfo.phase === "pre") && (
            <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <Info size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <b>Detox phase foods only.</b> Protein = egg whites or whey. Fat = ghee or coconut oil.
                Vegetables from the approved list. Once reintroduction starts (Day {(phaseInfo.totalDays ?? 14) + 1}),
                cleared safe foods unlock additional recipe options.
              </div>
            </div>
          )}

          {session && (
            <MyRecipes recipes={my.recipes} loading={my.loading} onAdd={() => setShowAdd(true)} onDelete={my.remove} onLog={logRecipe} />
          )}

          <div>
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Today's Meal Plan</h2>
            <div className="space-y-2">
              {getEffectiveSlots(nutrition.mealMerge).map(slot => (
                <SlotCard
                  key={slot.id}
                  slot={slot}
                  phaseInfo={phaseInfo}
                  safeFoodIds={safeFoodIds}
                  safeFoodNames={safeFoodNames}
                  slotKcal={getSlotBudget(dailyCalories, slot)}
                  macros={macros}
                  favourites={favourites}
                  onToggleFavourite={onToggleFavourite}
                  isOpen={openSlotId === slot.id}
                  onToggle={() => setOpenSlotId(id => id === slot.id ? null : slot.id)}
                  statusMap={statusMap}
                  favouriteFoodIds={favouriteFoods}
                />
              ))}
            </div>
          </div>

          <div className="lg:hidden">{reminders}</div>
        </div>

        {/* ── Right sidebar (desktop only) ── */}
        <div className="hidden lg:flex flex-col gap-5">
          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden sticky top-20">
            <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex items-center justify-between">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-500">Nutrition targets</div>
              <Button variant="outline" size="sm" onClick={() => setSettingsOpen(v => !v)} className="gap-1.5 h-7 text-xs px-2">
                <Settings2 size={12} />{settingsOpen ? "Done" : "Edit"}
              </Button>
            </div>
            <div className="p-4">
              {settingsOpen
                ? <NutritionPanel nutrition={nutrition} onChange={onNutritionChange} />
                : <><DailyTotals dailyCalories={dailyCalories} macros={macros} /><MacroBar macros={macros} /></>
              }
            </div>
          </div>

          {phaseInfo.phase === "reintro" && (
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="bg-teal-50 border-b border-teal-100 px-4 py-3">
                <div className="text-xs font-bold uppercase tracking-widest text-teal-500">Meal plan</div>
                <div className="text-xs text-teal-700 mt-0.5">Combine a protein + carb into one fuller meal</div>
              </div>
              <div className="p-4 space-y-2">
                {[
                  { value: null,  label: "Standard",     desc: "6 separate meals" },
                  { value: "2pm", label: "Merge at 2 PM", desc: "Protein + carb together at 2 PM" },
                  { value: "6pm", label: "Merge at 6 PM", desc: "Protein + carb together at 6 PM" },
                ].map(opt => {
                  const active = nutrition.mealMerge === opt.value;
                  return (
                    <button
                      key={String(opt.value)}
                      onClick={() => onNutritionChange({ ...nutrition, mealMerge: opt.value })}
                      className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all ${active ? "border-teal-400 bg-teal-50" : "border-slate-200 hover:border-slate-300"}`}
                    >
                      <div className={`text-sm font-semibold ${active ? "text-teal-800" : "text-slate-700"}`}>{opt.label}</div>
                      <div className={`text-xs ${active ? "text-teal-600" : "text-slate-500"}`}>{opt.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {reminders}

          <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
            <div className="bg-indigo-50 border-b border-indigo-100 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart size={13} className="text-indigo-500" />
                <div className="text-xs font-bold uppercase tracking-widest text-indigo-600">Shopping list</div>
              </div>
              <button onClick={() => setShoppingOpen(v => !v)} className="text-[11px] font-semibold text-indigo-500 hover:text-indigo-700">
                {shoppingOpen ? "Hide" : "Show"}
              </button>
            </div>
            {shoppingOpen
              ? <div className="p-4">{shoppingPanel}</div>
              : <div className="px-4 py-3 text-xs text-slate-500">Ingredients for today's top recipes.</div>
            }
          </div>
        </div>

      </div>

      {showAdd && (
        <AddRecipeModal
          session={session}
          country={country}
          search={search}
          fetchMeasures={fetchMeasures}
          units={units}
          onLog={addLog}
          onSaved={my.reload}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

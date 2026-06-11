import { useState, useMemo } from "react";
import { SLOT_COLORS } from "./constants.js";
import { RecipeCard } from "./RecipeCard.jsx";
import { getRecipesForSlot } from "../../utils/mealPlanner.js";
import { generateRecipesForSlot } from "../../utils/recipeAI.js";
import { Sparkles, Loader2, ChevronDown, ChevronRight } from "lucide-react";

function GenerateButton({ generating, onClick }) {
  return (
    <div className="flex justify-end">
      <button
        onClick={onClick}
        disabled={generating}
        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        title="Generate AI recipe ideas for this slot"
      >
        {generating
          ? <><Loader2 size={11} className="animate-spin" /> Generating…</>
          : <><Sparkles size={11} /> Generate ideas</>}
      </button>
    </div>
  );
}

function MergedSubSection({ label, type, phaseInfo, safeFoodIds, slotKcal, favourites, onToggleFavourite, slotColor, statusMap, favouriteFoodIds }) {
  const [showAll, setShowAll] = useState(false);
  const recipes = useMemo(
    () => getRecipesForSlot(type, phaseInfo, safeFoodIds, slotKcal, favourites, { statusMap, favouriteFoodIds }),
    [type, phaseInfo, safeFoodIds, slotKcal, favourites, statusMap, favouriteFoodIds]
  );
  const shown = showAll ? recipes : recipes.slice(0, 2);
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">{label}</div>
      {recipes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-3 text-center text-xs text-slate-500">
          No recipes available yet — clear more foods to unlock options.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {shown.map(recipe => (
            <RecipeCard key={recipe.id} recipe={recipe} isFavourite={favourites.includes(recipe.id)}
              onToggleFavourite={onToggleFavourite} slotColor={slotColor} favouriteFoodIds={favouriteFoodIds} />
          ))}
        </div>
      )}
      {recipes.length > 2 && (
        <button onClick={() => setShowAll(v => !v)} className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          {showAll ? "Show fewer" : `+${recipes.length - 2} more`}
          <ChevronRight size={12} className={`transition-transform ${showAll ? "rotate-90" : ""}`} />
        </button>
      )}
    </div>
  );
}

export function SlotCard({ slot, phaseInfo, safeFoodIds, safeFoodNames, slotKcal, macros, favourites, onToggleFavourite, isOpen, onToggle, statusMap, favouriteFoodIds }) {
  const [showAll, setShowAll]       = useState(false);
  const [aiRecipes, setAiRecipes]   = useState([]);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError]       = useState(null);

  const isMerged = slot.type === "proteincarb";
  const staticRecipes = useMemo(
    () => getRecipesForSlot(isMerged ? "proteincarb" : slot.type, phaseInfo, safeFoodIds, slotKcal, favourites, { statusMap, favouriteFoodIds }),
    [slot.type, phaseInfo, safeFoodIds, slotKcal, favourites, isMerged, statusMap, favouriteFoodIds]
  );
  const recipes = [...staticRecipes, ...aiRecipes];
  const c = SLOT_COLORS[slot.color] || SLOT_COLORS.amber;
  const shown = showAll ? recipes : recipes.slice(0, 2);

  async function handleGenerate(e) {
    e.stopPropagation();
    setGenerating(true);
    setAiError(null);
    try {
      const generated = await generateRecipesForSlot({
        slotLabel: slot.label, slotTime: slot.time, slotType: slot.type,
        phase: phaseInfo.phase, safeFoods: safeFoodNames, slotKcal, macros,
      });
      setAiRecipes(prev => [...prev, ...generated]);
      setShowAll(true);
    } catch (err) {
      setAiError(err.message || "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const emptyMsg = phaseInfo.phase === "pre" || phaseInfo.phase === "detox"
    ? "No matching recipes for this slot within calorie budget."
    : "No recipes yet for this slot — clear more foods to unlock options.";

  const recipeGrid = recipes.length === 0 ? (
    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
      {emptyMsg}
      <div className="mt-2 text-xs text-violet-500">Try ✨ Generate ideas above to get AI suggestions.</div>
    </div>
  ) : (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {shown.map(recipe => (
        <RecipeCard key={recipe.id} recipe={recipe} isFavourite={favourites.includes(recipe.id)}
          onToggleFavourite={onToggleFavourite} slotColor={slot.color} favouriteFoodIds={favouriteFoodIds} />
      ))}
    </div>
  );

  return (
    <div className={`rounded-2xl border transition-all ${isOpen ? "border-slate-200 bg-white shadow-sm" : "border-slate-100 bg-white hover:border-slate-200"}`}>
      <button
        type="button" onClick={onToggle} aria-expanded={isOpen}
        aria-controls={`slot-content-${slot.id}`}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded-2xl"
      >
        <div className={`w-14 text-center py-1.5 rounded-xl ${c.badge} text-white text-xs font-bold shrink-0`}>
          {slot.time.split(" ")[0]}
          <div className="text-[9px] font-medium opacity-75">{slot.time.split(" ")[1]}</div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-slate-800">{slot.label}</div>
          <div className="text-xs text-slate-500">{slotKcal} kcal budget · {slot.tip}</div>
        </div>
        {!isOpen && !isMerged && recipes.length > 0 && (
          <span className="text-xs text-slate-500 shrink-0">{recipes.length} option{recipes.length !== 1 ? "s" : ""}</span>
        )}
        {!isOpen && isMerged && <span className="text-xs font-semibold text-teal-600 shrink-0">Combined</span>}
        <ChevronDown size={16} className={`text-slate-500 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div id={`slot-content-${slot.id}`} className="px-4 pb-4 space-y-4 animate-fadeUp">
          <GenerateButton generating={generating} onClick={handleGenerate} />
          {aiError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">{aiError}</div>
          )}
          {recipeGrid}
          {recipes.length > 2 && (
            <button onClick={() => setShowAll(v => !v)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              {showAll ? "Show fewer" : `+${recipes.length - 2} more options`}
              <ChevronRight size={12} className={`transition-transform ${showAll ? "rotate-90" : ""}`} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

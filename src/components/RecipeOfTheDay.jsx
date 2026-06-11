import { useMemo } from "react";
import { RECIPE_LIBRARY } from "../data/recipeLibrary.js";
import { Sparkles, ChevronRight } from "lucide-react";

const MEAL_GRADIENT = {
  breakfast: "from-amber-500 to-amber-400",
  mains: "from-indigo-500 to-indigo-400",
  snack: "from-emerald-500 to-emerald-400",
};

// Recipe of the Day must respect the plan: no desserts, no refined sugar, and only foods the
// user can currently eat (every tracked reintro ingredient already Safe/Limit). During detox
// that naturally leaves the restrictive set (salads, egg-white, plain veg).
export function RecipeOfTheDay({ statusMap = {}, onNavigate }) {
  const recipe = useMemo(() => {
    const seed = new Date().toDateString().split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const cleared = id => statusMap[id] === "Safe" || statusMap[id] === "Limit";
    const pool = RECIPE_LIBRARY.filter(r =>
      r.category !== "dessert" && r.sugarFree && (r.requiredFoods || []).every(cleared)
    );
    const ranked = pool.filter(r => r.source === "CURATED" || r.method); // prefer real recipes
    const final = ranked.length ? ranked : pool;
    return final.length ? final[seed % final.length] : null;
  }, [statusMap]);

  if (!recipe) return null;
  const gradient = MEAL_GRADIENT[recipe.mealTypes?.[0]] || "from-indigo-500 to-indigo-400";
  const m = recipe.macros || {};

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
      <div className={`bg-gradient-to-r ${gradient} px-5 py-4 flex items-center justify-between`}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={13} className="text-white/80" />
            <span className="text-xs font-bold uppercase tracking-widest text-white/70">Recipe of the Day</span>
          </div>
          <h3 className="text-lg font-bold text-white">{recipe.name}</h3>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-white">{recipe.kcal}</div>
          <div className="text-xs text-white/60">kcal</div>
        </div>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center gap-4 text-xs text-slate-500 mb-3">
          <span>P <b className="text-slate-700">{m.protein}g</b></span>
          <span>F <b className="text-slate-700">{m.fat}g</b></span>
          <span>C <b className="text-slate-700">{m.carbs}g</b></span>
          <span>Fi <b className="text-slate-700">{m.fibre}g</b></span>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
          {recipe.method || (recipe.ingredients || []).map(i => i.name).slice(0, 6).join(", ")}
        </p>
        <button
          onClick={() => onNavigate("recipes")}
          className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
        >
          See all recipes <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

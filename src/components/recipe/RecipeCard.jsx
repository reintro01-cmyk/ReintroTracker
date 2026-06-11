import { useState } from "react";
import { SLOT_COLORS } from "./constants.js";
import { Heart, Clock, Zap, Leaf, ChevronDown, ChevronUp, Star, Bot, BadgeCheck, BookOpen, Sparkles, Target } from "lucide-react";

const METHOD_PENDING = m => !m || m.startsWith("Auto-generated");

// Shown when a recipe matches the user's calorie + macro targets well (see utils/recipeFit).
export function FitBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
      <Target size={9} /> Good fit
    </span>
  );
}

// Provenance badge — distinguishes AI-generated, curated, and community-sourced recipes.
function ProvenanceBadge({ recipe }) {
  const base = "inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border";
  if (recipe.generated || recipe.source === "GENERATED")
    return <span className={`${base} bg-violet-100 text-violet-700 border-violet-200`}><Bot size={9} /> AI generated</span>;
  if (recipe.source === "CURATED")
    return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}><BadgeCheck size={9} /> Curated</span>;
  if (recipe.source === "CORPUS")
    return <span className={`${base} bg-violet-50 text-violet-600 border-violet-200`}><Sparkles size={9} /> Idea</span>;
  if (recipe.source === "COMMUNITY")
    return <span className={`${base} bg-slate-100 text-slate-500 border-slate-200`}><BookOpen size={9} /> Community</span>;
  return null;
}

export function RecipeCard({ recipe, isFavourite, onToggleFavourite, slotColor, favouriteFoodIds = [], fit }) {
  const [expanded, setExpanded] = useState(false);
  const c = SLOT_COLORS[slotColor] || SLOT_COLORS.amber;
  const favSet = new Set(favouriteFoodIds);
  const usesFavourite = (recipe.requiredSafeFoods || []).some(id => favSet.has(id));

  return (
    <div className={`border-2 rounded-2xl overflow-hidden transition-all duration-200 ${expanded ? "shadow-md" : "hover:shadow-sm hover:border-slate-300 border-slate-200"} bg-white`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {recipe.veg !== undefined && (
                <span title={recipe.veg ? "Veg" : "Non-veg"} aria-label={recipe.veg ? "Vegetarian" : "Non-vegetarian"}
                  className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-sm border shrink-0 ${recipe.veg ? "border-emerald-600" : "border-rose-600"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${recipe.veg ? "bg-emerald-600" : "bg-rose-600"}`} />
                </span>
              )}
              <div className="font-bold text-sm text-slate-800 leading-snug">{recipe.name}</div>
              <ProvenanceBadge recipe={recipe} />
              {usesFavourite && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">
                  <Star size={9} fill="currentColor" /> Favourite
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(recipe.tags || []).slice(0, 3).map(tag => (
                <span key={tag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 uppercase tracking-wide">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <button
            onClick={() => onToggleFavourite(recipe.id)}
            className={`shrink-0 p-1.5 rounded-full transition-colors ${isFavourite ? "text-rose-500 bg-rose-50" : "text-slate-300 hover:text-slate-500"}`}
            aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
          >
            <Heart size={15} fill={isFavourite ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${c.light} ${c.text}`}>
            <Zap size={11} />{recipe.kcal} kcal
          </span>
          {fit?.good && <FitBadge />}
          {recipe.prepMins ? (
            <span className="text-xs text-slate-500 flex items-center gap-1">
              <Clock size={11} />{recipe.prepMins} min
            </span>
          ) : null}
          <div className="flex gap-2 text-xs text-slate-500 flex-wrap">
            <span>P <b>{recipe.macros.protein}g</b></span>
            <span>F <b>{recipe.macros.fat}g</b></span>
            <span>C <b>{recipe.macros.carbs}g</b></span>
            <span>Fi <b>{recipe.macros.fibre}g</b></span>
          </div>
        </div>

        {(recipe.requiredSafeFoods || []).length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
            <Leaf size={11} />
            Uses your safe food: <b className="capitalize">{recipe.requiredSafeFoods.join(", ").replace(/-/g, " ")}</b>
          </div>
        )}
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center justify-between px-4 py-2.5 border-t border-slate-100 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 focus-visible:outline-none"
      >
        {expanded ? "Hide details" : "View ingredients & method"}
        {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3 animate-fadeUp">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Ingredients</div>
            <ul className="space-y-1">
              {recipe.ingredients.map((ing, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-slate-700">{ing.name}</span>
                  <span className="text-slate-500 text-xs font-medium ml-4 shrink-0">{ing.qty}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1">Method</div>
            {METHOD_PENDING(recipe.method)
              ? <p className="text-sm text-slate-500 italic leading-relaxed">Cooking method will be generated for this recipe.</p>
              : <p className="text-sm text-slate-600 leading-relaxed">{recipe.method}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

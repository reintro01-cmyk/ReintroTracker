import { Zap, Users } from "lucide-react";
import { SLOT_COLORS } from "./constants.js";
import { FitBadge } from "./RecipeCard.jsx";

// Compact card for a cross-user consensus dish (name + median macros + how many members log it).
// No ingredients/method, so it deliberately doesn't use the expandable RecipeCard.
export function CommunityCard({ recipe, fit }) {
  const c = SLOT_COLORS.amber;
  return (
    <div className="border-2 border-slate-200 rounded-2xl bg-white p-4 hover:shadow-sm hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="font-bold text-sm text-slate-800 leading-snug">{recipe.name}</div>
        <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
          <Users size={9} /> {recipe.users}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-3 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${c.light} ${c.text}`}>
          <Zap size={11} />{recipe.kcal} kcal
        </span>
        {fit?.good && <FitBadge />}
        <div className="flex gap-2 text-xs text-slate-500 flex-wrap">
          <span>P <b>{recipe.macros.protein}g</b></span>
          <span>F <b>{recipe.macros.fat}g</b></span>
          <span>C <b>{recipe.macros.carbs}g</b></span>
          <span>Fi <b>{recipe.macros.fibre}g</b></span>
        </div>
      </div>
      <div className="text-[11px] text-slate-500 mt-2">
        Community-sourced · median across {recipe.users} member{recipe.users === 1 ? "" : "s"}
      </div>
    </div>
  );
}

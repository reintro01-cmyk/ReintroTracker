import { Button } from "../ui.jsx";
import { ChefHat, Plus, Trash2, ClipboardPaste, Utensils, Sparkles } from "lucide-react";

const r0 = n => Math.round(Number(n) || 0);
const r1 = n => Math.round((Number(n) || 0) * 10) / 10;

// "My recipes" — the user's own created/imported recipes (DB-computed nutrition). Lives on the
// recipes page above the curated planner. onAdd opens the paste/Instagram import modal.
export function MyRecipes({ recipes = [], loading, onAdd, onDelete, onLog }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="bg-indigo-50 border-b border-indigo-100 px-5 py-4 flex items-center justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-indigo-600 mb-0.5">Yours</div>
          <h2 className="font-bold text-base text-indigo-900 flex items-center gap-2"><ChefHat size={16} /> My recipes</h2>
        </div>
        <Button size="sm" onClick={onAdd}><Plus size={14} /> Add recipe</Button>
      </div>

      <div className="p-5">
        {loading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : recipes.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-slate-200 p-6 text-center">
            <ClipboardPaste size={22} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-500">No recipes yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Paste a recipe or an Instagram caption — we compute the nutrition from our food database and save it here.
            </p>
            <Button size="sm" className="mt-3" onClick={onAdd}><Sparkles size={14} /> Add your first recipe</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recipes.map(r => {
              const n = r.nutrition;
              const servings = r0(r.servings) || 1;
              return (
                <div key={r.id} className="rounded-xl border border-slate-200 p-3 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{r.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {r.ingredientCount} ingredient{r.ingredientCount !== 1 ? "s" : ""} · {servings} serving{servings !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <button onClick={() => onDelete(r.id)} aria-label={`Delete ${r.name}`}
                      className="p-1.5 -m-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {n ? (
                    <div className="text-[11px] text-slate-500">
                      <b className="text-indigo-700">{r0(n.energy_kcal)} kcal</b>/serving
                      <span className="text-slate-400"> · P{r1(n.protein_g)} C{r1(n.carb_avail_g)} F{r1(n.fat_g)}</span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400">Nutrition not computed</div>
                  )}
                  {onLog && (
                    <Button variant="outline" size="sm" className="mt-auto" onClick={() => onLog(r)}>
                      <Utensils size={12} /> Log a serving
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

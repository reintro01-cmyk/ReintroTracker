import { useState, useMemo, useEffect } from "react";
import { RECIPE_LIBRARY } from "../data/recipeLibrary.js";
import { DEFAULT_FOODS } from "../data/foods.js";
import { RecipeCard } from "./recipe/RecipeCard.jsx";
import { CommunityCard } from "./recipe/CommunityCard.jsx";
import { MyRecipes } from "./recipe/MyRecipes.jsx";
import { AddRecipeModal } from "./recipe/AddRecipeModal.jsx";
import { NutritionPanel, DailyTotals } from "./recipe/NutritionPanel.jsx";
import { useFoodLog } from "../hooks/useFoodLog.js";
import { useMyRecipes } from "../hooks/useMyRecipes.js";
import { useCommunityRecipes } from "../hooks/useCommunityRecipes.js";
import { recipeFit } from "../utils/recipeFit.js";
import { Search, Heart, ChefHat, Cookie, SlidersHorizontal, Lock, Sparkles, Loader2, Users, ArrowDownWideNarrow } from "lucide-react";

const FOOD_NAME = Object.fromEntries(DEFAULT_FOODS.map(f => [f.id, f.name]));
const GATED_TABS = new Set(["breakfast", "mains", "snack", "desserts"]);

const TABS = [
  { id: "breakfast", label: "Breakfast" },
  { id: "mains", label: "Mains" },
  { id: "snack", label: "Snacks" },
  { id: "desserts", label: "Desserts" },
  { id: "favourites", label: "Favourites" },
  { id: "myrecipes", label: "My recipes" },
  { id: "community", label: "Community" },
];

const DIETS = [
  { id: "all", label: "All" },
  { id: "veg", label: "Veg", dot: "bg-emerald-500" },
  { id: "nonveg", label: "Non-veg", dot: "bg-rose-500" },
];

const PAGE = 24;

export function RecipesPage({ session, country = "india", favourites = [], onToggleFavourite, favouriteFoods = [], statusMap = {}, nutrition, onNutritionChange }) {
  const [tab, setTab] = useState("breakfast");
  const [q, setQ] = useState("");
  const [diet, setDiet] = useState("all");
  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [editTargets, setEditTargets] = useState(false);
  const [sortByFit, setSortByFit] = useState(!!nutrition);
  const [limit, setLimit] = useState(PAGE);
  const [ideaLimit, setIdeaLimit] = useState(PAGE);
  const [showAdd, setShowAdd] = useState(false);

  // "Generate new ideas" lazy-loads the wider CORPUS collection (separate chunk) — only our
  // scraped + curated recipes are shown until the user explicitly asks for more.
  const [ideas, setIdeas] = useState(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [showIdeas, setShowIdeas] = useState(false);

  const { search, fetchMeasures, units, addLog } = useFoodLog(session);
  const my = useMyRecipes(session);
  const community = useCommunityRecipes(3);
  const favSet = useMemo(() => new Set(favourites), [favourites]);

  // A recipe is available if every TRACKED reintro food it needs is Safe or Limit (cleared).
  const lockedFoods = r => (r.requiredFoods || []).filter(id => statusMap[id] !== "Safe" && statusMap[id] !== "Limit");
  const gateActive = onlyAvailable && GATED_TABS.has(tab);
  const query = q.trim().toLowerCase();

  useEffect(() => { setLimit(PAGE); setIdeaLimit(PAGE); }, [tab, q, diet, onlyAvailable]);

  // Shared tab/diet/gate/search filter, applied to both the library and the loaded ideas.
  function applyFilters(items) {
    let out = items;
    if (gateActive) out = out.filter(r => lockedFoods(r).length === 0);
    if (diet !== "all") out = out.filter(r => (diet === "veg" ? r.veg : !r.veg));
    if (query) out = out.filter(r => r.name.toLowerCase().includes(query) || r.ingredients.some(i => i.name.toLowerCase().includes(query)));
    return out;
  }

  const list = useMemo(() => {
    let items;
    if (tab === "desserts") items = RECIPE_LIBRARY.filter(r => r.category === "dessert");
    else if (tab === "favourites") items = [...RECIPE_LIBRARY, ...(ideas || [])].filter(r => favSet.has(r.id));
    else if (tab === "myrecipes") items = [];
    else items = RECIPE_LIBRARY.filter(r => r.mealTypes.includes(tab));
    items = applyFilters(items);
    const byName = (a, b) => (b.source === "CURATED") - (a.source === "CURATED") || a.name.localeCompare(b.name);
    if (sortByFit && nutrition) {
      return items
        .map(r => ({ r, score: recipeFit(r, nutrition).score }))
        .sort((a, b) => b.score - a.score || byName(a.r, b.r))
        .map(x => x.r);
    }
    return items.sort(byName);
  }, [tab, q, diet, favSet, gateActive, statusMap, ideas, sortByFit, nutrition]);

  // Wider-collection ideas for the current content tab, deduped against what's already shown.
  const ideaList = useMemo(() => {
    if (!ideas || !showIdeas || !GATED_TABS.has(tab)) return [];
    const pool = tab === "desserts" ? ideas.filter(r => r.category === "dessert") : ideas.filter(r => r.mealTypes.includes(tab));
    const shown = new Set(list.map(r => r.name.toLowerCase()));
    return applyFilters(pool).filter(r => !shown.has(r.name.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  }, [ideas, showIdeas, tab, q, diet, gateActive, statusMap, list]);

  async function loadIdeas() {
    if (ideas) { setShowIdeas(true); return; }
    setLoadingIdeas(true);
    try {
      const mod = await import("../data/recipeIdeas.js");
      setIdeas(mod.RECIPE_IDEAS);
      setShowIdeas(true);
    } finally {
      setLoadingIdeas(false);
    }
  }

  function logRecipe(r) {
    const n = r.nutrition || {};
    return addLog({
      source: "recipe", recipe_id: r.id, custom_name: r.name, meal: "lunch",
      qty: 1, unit: "serving", grams: null,
      kcal: n.energy_kcal, protein_g: n.protein_g, fat_g: n.fat_g, carb_g: n.carb_avail_g, fibre_g: n.fibre_g,
    });
  }

  return (
    <div className="max-w-7xl 2xl:max-w-[1400px] mx-auto animate-fadeUp space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">Cook</div>
          <h1 className="text-xl font-bold text-slate-900">Recipes</h1>
        </div>
      </div>

      {nutrition && onNutritionChange && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Your daily targets</div>
            <button onClick={() => setEditTargets(v => !v)} aria-expanded={editTargets}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              <SlidersHorizontal size={12} /> {editTargets ? "Done" : "Edit"}
            </button>
          </div>
          <DailyTotals dailyCalories={nutrition.dailyCalories} macros={nutrition.macros} />
          {editTargets && (
            <div className="pt-3 border-t border-slate-100">
              <NutritionPanel nutrition={nutrition} onChange={onNutritionChange} />
            </div>
          )}
        </div>
      )}

      {/* sub-tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? "page" : undefined}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
              tab === t.id ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {t.id === "favourites" && <Heart size={13} className={tab === t.id ? "fill-white" : ""} />}
            {t.id === "desserts" && <Cookie size={13} />}
            {t.id === "myrecipes" && <ChefHat size={13} />}
            {t.id === "community" && <Users size={13} />}
            {t.label}
          </button>
        ))}
      </div>

      {tab === "myrecipes" ? (
        <MyRecipes recipes={my.recipes} loading={my.loading} onAdd={() => setShowAdd(true)} onDelete={my.remove} onLog={logRecipe} />
      ) : tab === "community" ? (
        community.loading ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center text-sm text-slate-500">Loading community recipes…</div>
        ) : community.recipes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
            <p className="text-sm font-semibold text-slate-500">No community recipes yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Dishes show up here once at least 3 members have logged them. Log your meals on the Log tab — the more everyone logs, the richer this gets.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 flex items-start gap-1.5 max-w-2xl">
              <Users size={13} className="text-indigo-400 shrink-0 mt-0.5" />
              Popular dishes across the community — nutrition is the median of what members logged.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {community.recipes.map(r => (
                <CommunityCard key={r.id} recipe={r} fit={nutrition ? recipeFit(r, nutrition) : undefined} />
              ))}
            </div>
          </div>
        )
      ) : (
        <>
          {/* search + veg/non-veg filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={q} onChange={e => setQ(e.target.value)} aria-label="Search recipes"
                placeholder={`Search ${tab === "favourites" ? "favourites" : tab === "desserts" ? "desserts" : tab + " recipes"}…`}
                className="w-full rounded-xl border-2 border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-400"
              />
            </div>
            <div className="flex gap-0.5 bg-slate-100 rounded-lg p-0.5" role="group" aria-label="Diet filter">
              {DIETS.map(d => (
                <button key={d.id} onClick={() => setDiet(d.id)} aria-pressed={diet === d.id}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    diet === d.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {d.dot && <span className={`w-2 h-2 rounded-full ${d.dot}`} />}
                  {d.label}
                </button>
              ))}
            </div>
            {GATED_TABS.has(tab) && (
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={onlyAvailable} onChange={e => setOnlyAvailable(e.target.checked)}
                  className="w-3.5 h-3.5 accent-indigo-600" />
                <Lock size={11} className="text-slate-500" /> Only what I can eat now
              </label>
            )}
            {nutrition && (
              <button onClick={() => setSortByFit(v => !v)} aria-pressed={sortByFit}
                title="Rank recipes by how well they match your calorie + macro targets"
                className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                  sortByFit ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}>
                <ArrowDownWideNarrow size={13} /> Best fit first
              </button>
            )}
          </div>

          {tab === "desserts" && (
            <p className="text-xs text-slate-500 flex items-start gap-1.5 max-w-2xl">
              <Cookie size={13} className="text-rose-400 shrink-0 mt-0.5" />
              Sugar-free only — these use no refined sugar. Importing your own? Sweeten with monk fruit, stevia or erythritol and it stays on plan.
            </p>
          )}

          {list.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
              <p className="text-sm font-semibold text-slate-500">
                {tab === "favourites" ? "No favourites yet" : gateActive && !q ? "Nothing unlocked yet" : "No recipes here yet"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {tab === "favourites"
                  ? "Tap the heart on any recipe to save it here."
                  : q ? "Try a different search."
                  : gateActive ? "These recipes need foods you haven't cleared yet. Reintroduce foods, or untick “Only what I can eat now” to browse everything."
                  : "Check back soon."}
              </p>
            </div>
          ) : (
            <>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {list.slice(0, limit).map(r => (
                  <RecipeCard
                    key={r.id}
                    recipe={r}
                    isFavourite={favSet.has(r.id)}
                    onToggleFavourite={onToggleFavourite}
                    slotColor="amber"
                    favouriteFoodIds={favouriteFoods}
                    fit={nutrition ? recipeFit(r, nutrition) : undefined}
                  />
                ))}
              </div>
              {list.length > limit && (
                <div className="text-center">
                  <button onClick={() => setLimit(n => n + PAGE)}
                    className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 px-4 py-2">
                    Show {Math.min(PAGE, list.length - limit)} more ({list.length - limit} left)
                  </button>
                </div>
              )}
            </>
          )}

          {/* Generate new ideas — the wider CORPUS collection, loaded on demand */}
          {GATED_TABS.has(tab) && (
            <div className="pt-4 mt-2 border-t border-slate-100">
              {!showIdeas ? (
                <div className="text-center">
                  <button onClick={loadIdeas} disabled={loadingIdeas}
                    className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border-2 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none">
                    {loadingIdeas ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {loadingIdeas ? "Loading ideas…" : "Generate new ideas"}
                  </button>
                  <p className="text-[11px] text-slate-500 mt-1.5">Browse our wider recipe collection. Nutrition is estimated.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-slate-700">
                      <Sparkles size={14} className="text-violet-500" />
                      More ideas <span className="text-xs font-semibold text-slate-500">({ideaList.length})</span>
                    </div>
                    <button onClick={() => setShowIdeas(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700">Hide</button>
                  </div>
                  <p className="text-[11px] text-slate-500 -mt-1.5">From our wider collection — nutrition is estimated; methods generated on demand.</p>
                  {ideaList.length === 0 ? (
                    <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
                      <p className="text-sm font-semibold text-slate-500">No extra ideas match here.</p>
                      <p className="text-xs text-slate-500 mt-1">{gateActive ? "Try unticking “Only what I can eat now”." : "Try another tab or search."}</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {ideaList.slice(0, ideaLimit).map(r => (
                          <RecipeCard key={r.id} recipe={r} isFavourite={favSet.has(r.id)} onToggleFavourite={onToggleFavourite} slotColor="amber" favouriteFoodIds={favouriteFoods} fit={nutrition ? recipeFit(r, nutrition) : undefined} />
                        ))}
                      </div>
                      {ideaList.length > ideaLimit && (
                        <div className="text-center">
                          <button onClick={() => setIdeaLimit(n => n + PAGE)}
                            className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 px-4 py-2">
                            Show {Math.min(PAGE, ideaList.length - ideaLimit)} more ({ideaList.length - ideaLimit} left)
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showAdd && (
        <AddRecipeModal
          session={session} country={country}
          search={search} fetchMeasures={fetchMeasures} units={units}
          onLog={addLog} onSaved={my.reload} onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

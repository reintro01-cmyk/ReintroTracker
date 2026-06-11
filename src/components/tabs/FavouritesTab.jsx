import { useState, useMemo } from "react";
import { getRecipes } from "../../data/recipes.js";
import { getDesserts } from "../../utils/mealPlanner.js";
import { RecipeCard } from "../recipe/RecipeCard.jsx";
import { SLOT_TYPE_COLOR } from "../recipe/constants.js";
import { Heart, Cookie, Lock, Sparkles, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

function SectionHeader({ icon: Icon, title, count, accent }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-xl ${accent}`}>
        <Icon size={16} />
      </span>
      <h2 className="text-sm font-bold text-slate-800">{title}</h2>
      {count != null && (
        <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{count}</span>
      )}
    </div>
  );
}

// A dessert card carries an unlock status banner (ready vs pending) above the recipe card.
function DessertCard({ dessert, isFavourite, onToggleFavourite, favouriteFoods, nameOf }) {
  const pendingNames = dessert.pending.map(nameOf);
  return (
    <div className={dessert.ready ? "" : "opacity-90"}>
      {dessert.ready ? (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 mb-1.5 ml-1">
          <CheckCircle2 size={12} /> Ready to make — your ingredients are all cleared
        </div>
      ) : (
        <div className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-500 mb-1.5 ml-1">
          <Lock size={12} className="shrink-0 mt-0.5" />
          <span>
            {dessert.mappedCount === 0
              ? "Ingredients not yet tracked"
              : <>Unlocks once you clear: <span className="capitalize text-slate-500">{pendingNames.join(", ").replace(/-/g, " ")}</span></>}
          </span>
        </div>
      )}
      <RecipeCard
        recipe={dessert}
        isFavourite={isFavourite}
        onToggleFavourite={onToggleFavourite}
        slotColor="rose"
        favouriteFoodIds={favouriteFoods}
      />
    </div>
  );
}

export function FavouritesTab({ favourites = [], favouriteFoods = [], statusMap = {}, foods = [], onToggleFavourite }) {
  const [showLocked, setShowLocked] = useState(false);

  const nameOf = useMemo(() => {
    const m = Object.fromEntries(foods.map(f => [f.id, f.name]));
    return id => m[id] || id;
  }, [foods]);

  // Favourited meal recipes (desserts have their own home below, so exclude them here)
  const favRecipes = useMemo(() => {
    const favSet = new Set(favourites);
    return getRecipes().filter(r => favSet.has(r.id) && r.category !== "dessert");
  }, [favourites]);

  const desserts = useMemo(() => getDesserts(statusMap), [statusMap]);
  const readyDesserts = desserts.filter(d => d.ready);
  const lockedDesserts = desserts.filter(d => !d.ready);
  const favSet = new Set(favourites);

  return (
    <div className="max-w-5xl mx-auto animate-fadeUp space-y-10">
      {/* ── My Favourites ── */}
      <section>
        <SectionHeader icon={Heart} title="My Favourites" count={favRecipes.length} accent="bg-rose-100 text-rose-600" />
        {favRecipes.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
            <Heart size={22} className="mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-500">No favourites yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Tap the heart on any recipe in the Recipes tab. Favourites are prioritised in your plan — at most once a day.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {favRecipes.map(r => (
              <RecipeCard
                key={r.id}
                recipe={r}
                isFavourite={favSet.has(r.id)}
                onToggleFavourite={onToggleFavourite}
                slotColor={SLOT_TYPE_COLOR[r.slot] || "amber"}
                favouriteFoodIds={favouriteFoods}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Desserts ── */}
      <section>
        <SectionHeader icon={Cookie} title="Desserts" count={desserts.length} accent="bg-rose-100 text-rose-600" />
        <p className="text-xs text-slate-500 -mt-1 mb-4 flex items-center gap-1.5">
          <Sparkles size={12} className="text-rose-400" />
          Desserts unlock as you clear their ingredients. {readyDesserts.length} ready to make now.
        </p>

        {readyDesserts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-rose-200 bg-rose-50/40 p-8 text-center">
            <Cookie size={22} className="mx-auto text-rose-300 mb-2" />
            <p className="text-sm font-semibold text-slate-500">No desserts ready yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Clear more foods in the Foods tab and desserts using them will appear here.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {readyDesserts.map(d => (
              <DessertCard
                key={d.id}
                dessert={d}
                isFavourite={favSet.has(d.id)}
                onToggleFavourite={onToggleFavourite}
                favouriteFoods={favouriteFoods}
                nameOf={nameOf}
              />
            ))}
          </div>
        )}

        {lockedDesserts.length > 0 && (
          <div className="mt-5">
            <button
              onClick={() => setShowLocked(v => !v)}
              aria-expanded={showLocked}
              className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
            >
              <Lock size={13} />
              {showLocked ? "Hide" : "Show"} {lockedDesserts.length} locked dessert{lockedDesserts.length === 1 ? "" : "s"}
              {showLocked ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
            {showLocked && (
              <div className="grid sm:grid-cols-2 gap-4 mt-4">
                {lockedDesserts.map(d => (
                  <DessertCard
                    key={d.id}
                    dessert={d}
                    isFavourite={favSet.has(d.id)}
                    onToggleFavourite={onToggleFavourite}
                    favouriteFoods={favouriteFoods}
                    nameOf={nameOf}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

import { START_DATE } from "./dates.js";
import { getRecipes } from "../data/recipes.js";

// ── Meal slot definitions ────────────────────────────────────────────────────
// kcalWeight: fraction of daily calories allocated to this slot (must sum to 1.0)
export const MEAL_SLOTS = [
  {
    id: "fat",
    time: "8:00 AM",
    label: "Fat Meal",
    type: "fat",
    kcalWeight: 0.14,
    color: "amber",
    tip: "1 tbsp of ghee or coconut oil — kick-starts fat metabolism."
  },
  {
    id: "p1",
    time: "10:00 AM",
    label: "Protein Meal",
    type: "protein",
    kcalWeight: 0.18,
    color: "orange",
    tip: "~25 g protein. No carbs at this slot."
  },
  {
    id: "vc1",
    time: "12:00 PM",
    label: "Veg / Carb",
    type: "vegcarb",
    kcalWeight: 0.12,
    color: "emerald",
    tip: "Stay under 150 kcal. Focus on raw or lightly cooked vegetables."
  },
  {
    id: "p2",
    time: "2:00 PM",
    label: "Protein Meal",
    type: "protein",
    kcalWeight: 0.18,
    color: "orange",
    tip: "~25 g protein. No carbs at this slot."
  },
  {
    id: "vc2",
    time: "4:00 PM",
    label: "Veg / Carb",
    type: "vegcarb",
    kcalWeight: 0.12,
    color: "emerald",
    tip: "Fibre-rich vegetables preferred. Keep it light."
  },
  {
    id: "p3",
    time: "6:00 PM",
    label: "Protein Meal",
    type: "protein",
    kcalWeight: 0.18,
    color: "orange",
    tip: "Final protein of the day."
  },
  {
    id: "fibre",
    time: "8:00 PM",
    label: "Fibre Drink",
    type: "fibre",
    kcalWeight: 0.08,
    color: "teal",
    tip: "High-fibre drink to support overnight gut health."
  },
];
// Verify weights sum to 1.0: 0.14 + 0.18×3 + 0.12×2 + 0.08 = 1.00 ✓

// ── Merged slot definitions (reintro phase optional) ─────────────────────────
const MERGED_2PM = {
  id: "merged_2pm",
  time: "2:00 PM",
  label: "Protein + Carb Meal",
  type: "proteincarb",
  kcalWeight: 0.30,   // vc1 (12%) + p2 (18%)
  color: "teal",
  tip: "Combined meal — one protein dish + one carb/veg dish.",
};

const MERGED_6PM = {
  id: "merged_6pm",
  time: "6:00 PM",
  label: "Protein + Carb Meal",
  type: "proteincarb",
  kcalWeight: 0.30,   // vc2 (12%) + p3 (18%)
  color: "teal",
  tip: "Combined evening meal — protein and carbs together.",
};

// Returns the effective slot list for the day based on user's merge preference.
// mealMerge: null | "2pm" | "6pm"
export function getEffectiveSlots(mealMerge) {
  if (mealMerge === "2pm") {
    // Remove 12 PM veg/carb (vc1) + 2 PM protein (p2); insert merged at 2 PM
    return [MEAL_SLOTS[0], MEAL_SLOTS[1], MERGED_2PM, MEAL_SLOTS[4], MEAL_SLOTS[5], MEAL_SLOTS[6]];
  }
  if (mealMerge === "6pm") {
    // Remove 4 PM veg/carb (vc2) + 6 PM protein (p3); insert merged at 6 PM
    return [MEAL_SLOTS[0], MEAL_SLOTS[1], MEAL_SLOTS[2], MEAL_SLOTS[3], MERGED_6PM, MEAL_SLOTS[6]];
  }
  return MEAL_SLOTS;
}

// ── Phase detection ──────────────────────────────────────────────────────────
// programmeStartStr: ISO date string (e.g. "2026-05-18"). Falls back to legacy START_DATE.
export function getCurrentPhase(statusMap, programmeStartStr, detoxDuration = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startRaw = programmeStartStr
    ? new Date(programmeStartStr)
    : new Date(START_DATE);
  startRaw.setHours(0, 0, 0, 0);
  const daysSinceStart = Math.floor((today - startRaw) / (1000 * 60 * 60 * 24));

  if (daysSinceStart < 0) {
    return { phase: "pre", daysUntilStart: -daysSinceStart };
  }
  if (daysSinceStart < detoxDuration) {
    return { phase: "detox", day: daysSinceStart + 1, totalDays: detoxDuration };
  }
  const safeCount = Object.values(statusMap).filter(s => s === "Safe").length;
  return { phase: "reintro", day: daysSinceStart - (detoxDuration - 1), safeCount };
}

// ── Per-slot calorie budget ──────────────────────────────────────────────────
export function getSlotBudget(dailyKcal, slot) {
  return Math.round(dailyKcal * slot.kcalWeight);
}

// ── Allergen safety net ──────────────────────────────────────────────────────
// The requiredSafeFoods/Avoid mechanism only catches ingredients the pipeline mapped
// back to a tracked food. Allergens (esp. seafood) often appear in recipes that never
// got mapped, so for those foods we also text-match the recipe name + ingredient list.
// Conservative by design: any textual hint of an avoided allergen excludes the recipe.
// Terms are deliberately unambiguous substrings (no "egg"-style stems that over-match).
const ALLERGEN_TERMS = {
  fish: ["fish", "tuna", "salmon", "pomfret", "rohu", "mackerel", "sardine", "anchovy", "tilapia", "surmai", "bangda", "hilsa", "basa"],
  prawns: ["prawn", "shrimp"],
  crab: ["crab"],
  mutton: ["mutton", " goat"],
  lamb: ["lamb"],
  beef: ["beef"],
  besan: ["besan", "gram flour", "chickpea flour"],
  pistachios: ["pistachio", "pista "],
  mushroom: ["mushroom"],
};

function recipeText(r) {
  return (r.name + " " + (r.ingredients || []).map(i => i.name).join(" ")).toLowerCase();
}

// True if the recipe textually contains any allergen the user has marked Avoid.
export function recipeAllergenConflict(recipe, statusMap = {}) {
  const avoided = Object.keys(ALLERGEN_TERMS).filter(id => statusMap[id] === "Avoid");
  if (!avoided.length) return false;
  const hay = recipeText(recipe);
  return avoided.some(id => ALLERGEN_TERMS[id].some(term => hay.includes(term)));
}

// ── Recipe suggestions for a slot ───────────────────────────────────────────
// tolerance: 17.5% over the slot budget (soft cap)
const TOLERANCE = 0.175;

// Score weights — lower score sorts first, so favourable conditions are NEGATIVE
const FAV_RECIPE_BOOST     = -10000; // recipe explicitly hearted by the user
const FAV_SAFE_FOOD_BOOST  =  -2500; // each favourited safe food the recipe uses
const LIMIT_FOOD_PENALTY   =    400; // each Limit food the recipe uses — SOFT, so Limit
                                     // recipes surface sparingly (sorted lower) not excluded

// Recipes that need an AVOID food are filtered out entirely; recipes that use a LIMIT
// food are kept but penalised so they appear sparingly. Favourited Safe foods get a boost.
export function getRecipesForSlot(
  slotType,
  phaseInfo,
  safeFoodIds,
  slotKcal,
  favouriteIds = [],
  { statusMap = {}, favouriteFoodIds = [] } = {}
) {
  const phase = phaseInfo.phase;

  const matches = getRecipes().filter(r => {
    if (r.slot !== slotType) return false;

    // Desserts are excluded from the meal-slot planner — they live in their own
    // Favourites > Desserts section (unlocked as their ingredients are cleared).
    if (r.category === "dessert") return false;

    // Never suggest a recipe that needs a food the user must AVOID
    if ((r.requiredSafeFoods || []).some(id => statusMap[id] === "Avoid")) return false;

    // Allergen safety net — exclude recipes whose text mentions an avoided allergen
    if (recipeAllergenConflict(r, statusMap)) return false;

    // Reintro-only recipes are hidden in detox / pre-programme
    if (r.phase === "reintro") {
      if (phase === "detox" || phase === "pre") return false;
      // All required safe foods must have been cleared
      if (r.requiredSafeFoods.some(id => !safeFoodIds.includes(id))) return false;
    }

    // Calorie soft cap
    if (r.kcal > slotKcal * (1 + TOLERANCE)) return false;

    return true;
  });

  const favouriteFoodSet = new Set(favouriteFoodIds);

  function score(recipe) {
    let s = Math.abs(recipe.kcal - slotKcal);
    if (favouriteIds.includes(recipe.id)) s += FAV_RECIPE_BOOST;
    for (const fid of recipe.requiredSafeFoods || []) {
      const verdict = statusMap[fid];
      if (verdict === "Limit") s += LIMIT_FOOD_PENALTY;                 // soft, every recipe
      if (verdict === "Safe" && favouriteFoodSet.has(fid)) s += FAV_SAFE_FOOD_BOOST;
    }
    return s;
  }

  return matches.sort((a, b) => score(a) - score(b));
}

// ── Deduped day assembly ─────────────────────────────────────────────────────
// Picks one recipe per slot avoiding repeats across slots, so the day has variety.
// ── Desserts ──────────────────────────────────────────────────────────────────
// Desserts live outside the meal-slot planner. Each is "ready to make" once every
// tracked ingredient it maps to has been cleared (Safe). requiredSafeFoods only lists
// the tracked foods a dessert maps to — not untracked staples (sugar, flour) — so
// "ready" means *your tracked* ingredients are all introduced, not a literal pantry check.
// Returns desserts annotated with { ready, pending } and ready ones sorted first.
export function getDesserts(statusMap = {}) {
  return getRecipes()
    .filter(r => r.category === "dessert")
    .filter(r => !recipeAllergenConflict(r, statusMap))   // hide desserts with an avoided allergen
    .map(r => {
      const req = r.requiredSafeFoods || [];
      const avoided = req.filter(id => statusMap[id] === "Avoid");
      const pending = req.filter(id => statusMap[id] !== "Safe");
      // ready = uses at least one tracked food, all of them cleared, none to avoid
      const ready = req.length > 0 && pending.length === 0 && avoided.length === 0;
      return { ...r, ready, pending, avoided, mappedCount: req.length };
    })
    .sort((a, b) =>
      (a.ready === b.ready ? a.pending.length - b.pending.length : a.ready ? -1 : 1)
      || a.name.localeCompare(b.name)
    );
}

// ── Macro grams from kcal + percentages ──────────────────────────────────────
// Each macro is treated as 4 kcal/g for simplicity (including fibre)
export function macroGrams(dailyKcal, macros) {
  return {
    fat:     Math.round((dailyKcal * (macros.fat     / 100)) / 9), // fat = 9 kcal/g
    carbs:   Math.round((dailyKcal * (macros.carbs   / 100)) / 4),
    protein: Math.round((dailyKcal * (macros.protein / 100)) / 4),
    fibre:   Math.round((dailyKcal * (macros.fibre   / 100)) / 2), // fibre ~2 kcal/g
  };
}

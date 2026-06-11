// Rank a recipe against the user's daily nutrition targets. Pure + testable.
// Recipes carry per-serving kcal + macro GRAMS; targets carry a daily kcal + a macro % split.
// Fit = how close the dish is to one meal's calorie budget AND to the desired macro balance.

export const MEALS_PER_DAY = 3;      // per-meal budget = dailyCalories / 3 (mains/breakfast sized)
export const GOOD_THRESHOLD = 70;    // score at/above which a recipe is flagged "Good fit"

// Energy per gram — matches mealPlanner.macroGrams (fibre counted at ~2 kcal/g).
const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9, fibre: 2 };

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Macro distribution (grams) -> % of energy across the 4 macros (sums to 100), or null when
// there's no macro data to compare.
function energyShares(macros = {}) {
  const e = {
    protein: num(macros.protein) * KCAL_PER_G.protein,
    carbs:   num(macros.carbs)   * KCAL_PER_G.carbs,
    fat:     num(macros.fat)     * KCAL_PER_G.fat,
    fibre:   num(macros.fibre)   * KCAL_PER_G.fibre,
  };
  const total = e.protein + e.carbs + e.fat + e.fibre;
  if (total <= 0) return null;
  return {
    protein: (e.protein / total) * 100,
    carbs:   (e.carbs   / total) * 100,
    fat:     (e.fat     / total) * 100,
    fibre:   (e.fibre   / total) * 100,
  };
}

// Target % split renormalized to sum 100 — the user's sliders don't always total exactly 100.
function normalizePct(macros = {}) {
  const m = {
    protein: num(macros.protein), carbs: num(macros.carbs),
    fat: num(macros.fat), fibre: num(macros.fibre),
  };
  const total = m.protein + m.carbs + m.fat + m.fibre;
  if (total <= 0) return null;
  return {
    protein: (m.protein / total) * 100, carbs: (m.carbs / total) * 100,
    fat: (m.fat / total) * 100, fibre: (m.fibre / total) * 100,
  };
}

// -> { score: 0..100, good: boolean }. Calorie closeness and macro-balance closeness are
// weighted 50/50; score 0 (not good) when targets or the recipe are missing/empty.
export function recipeFit(recipe, nutrition) {
  const daily = num(nutrition?.dailyCalories);
  if (!recipe || daily <= 0) return { score: 0, good: false };

  const budget = daily / MEALS_PER_DAY;
  const kcal = num(recipe.kcal);
  const calScore = kcal > 0 ? Math.max(0, 1 - Math.min(1, Math.abs(kcal - budget) / budget)) : 0;

  const want = normalizePct(nutrition?.macros);
  const have = energyShares(recipe.macros);
  let macroScore = 0;
  if (want && have) {
    const l1 = Math.abs(have.protein - want.protein) + Math.abs(have.carbs - want.carbs)
             + Math.abs(have.fat - want.fat) + Math.abs(have.fibre - want.fibre);
    macroScore = Math.max(0, 1 - l1 / 200);   // L1 over 4 shares maxes at 200
  }

  const score = Math.round(100 * (0.5 * calScore + 0.5 * macroScore));
  return { score, good: score >= GOOD_THRESHOLD };
}

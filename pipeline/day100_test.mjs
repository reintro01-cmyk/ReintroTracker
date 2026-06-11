// Day-100 meal-generation test against the live planner logic.
// Scenario: reintro day 100, 1500 kcal/day, Fat + Fibre slots LOCKED to 150 kcal each,
// remaining 1200 distributed to the other slots. Safe-food filtering + Limit sparsity checked.
import { getEffectiveSlots, assembleDayPlan } from "../src/utils/mealPlanner.js";
import { RECIPES } from "../src/data/recipes.js";
import { DEFAULT_FOODS } from "../src/data/foods.js";

const DAILY = 1500;
const phaseInfo = { phase: "reintro", day: 100, safeCount: 0 };

// Day 100: treat ALL foods as cleared, then mark the two MOST-USED foods as "Limit"
// (and favourite them, since the penalty only applies to favourited Limit foods) to test sparsity.
const freq = {};
for (const r of RECIPES) for (const id of r.requiredSafeFoods || []) freq[id] = (freq[id] || 0) + 1;
const limitFoods = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([id]) => id);

const statusMap = {};
const safeFoodIds = [];
for (const f of DEFAULT_FOODS) {
  if (limitFoods.includes(f.id)) statusMap[f.id] = "Limit";
  else statusMap[f.id] = "Safe";
  safeFoodIds.push(f.id);            // all allowed at day 100 (Limit included, so they CAN appear)
}
const favouriteFoodIds = [...limitFoods];   // required for the Limit penalty to engage
const nameOf = id => (DEFAULT_FOODS.find(f => f.id === id) || {}).name || id;

const slots = getEffectiveSlots(null);
const OVERRIDE = { fat: 150, fibre: 150 };   // lock fat + fibre; others get the larger budgets

console.log(`\n=== DAY 100 (reintro) · ${DAILY} kcal/day · Fat+Fibre locked @150 ===`);
console.log(`Limit foods (most-used): ${limitFoods.map(nameOf).join(", ")}\n`);

const plan = assembleDayPlan(slots, phaseInfo, safeFoodIds, DAILY,
  { favourites: [], statusMap, favouriteFoodIds }, OVERRIDE);

let dayKcal = 0, limitTop = 0, listed = 0;
const distinct = new Set();
for (const { slot, budget, recipe, options } of plan) {
  if (recipe) { dayKcal += recipe.kcal; distinct.add(recipe.id); }
  console.log(`${slot.time.padEnd(9)} ${slot.label.padEnd(18)} budget ${String(budget).padStart(4)} | ${options.length} candidates`);
  console.log(`   → ${recipe ? recipe.name.padEnd(34) + " " + String(recipe.kcal).padStart(4) + " kcal" : "(none)"}`);
  for (const r of options.slice(0, 3)) {
    const usesLimit = (r.requiredSafeFoods || []).filter(id => statusMap[id] === "Limit").map(nameOf);
    listed++; if (usesLimit.length) limitTop++;
    if (usesLimit.length) console.log(`      · ${r.name.padEnd(32)} ${String(r.kcal).padStart(4)}  ⚠ Limit: ${usesLimit.join(",")}`);
  }
}

// favourite-repeat demo: favourite the first protein pick and re-assemble
const proteinPick = plan.find(p => p.slot.type === "protein" && p.recipe)?.recipe;
let favRepeat = 0;
if (proteinPick) {
  const plan2 = assembleDayPlan(slots, phaseInfo, safeFoodIds, DAILY,
    { favourites: [proteinPick.id], statusMap, favouriteFoodIds }, OVERRIDE);
  favRepeat = plan2.filter(p => p.recipe && p.recipe.id === proteinPick.id).length;
}

console.log("\n=== SUMMARY ===");
console.log(`Planned day total            : ${dayKcal} kcal  (target ${DAILY})`);
console.log(`Distinct recipes (dedup #1)  : ${distinct.size} / ${slots.length} slots`);
console.log(`Limit-food recipes surfacing : ${limitTop} (sparingly, sorted lower) of ${listed} top-3 shown`);
console.log(`Favourite-repeat demo        : "${proteinPick?.name}" appears ${favRepeat}× when favourited (max 1/day)`);

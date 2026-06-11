// Phase 4 — resolve parsed recipe lines into grams + nutrition. PURE functions (no I/O) so
// they're unit-testable. The invariant from the parser carries through here: numbers come ONLY
// from our ingredient tables. A line's macros = computeLogMacros(matchedFood, grams); the LLM
// never contributes a number.

import { num, computeLogMacros } from "./foodLog.js";

// Generic household-unit grams, used when a per-ingredient measure isn't available. Mirrors
// the DB `unit_defaults` table; passed in from the hook, but this is the safety net for tests.
export const FALLBACK_UNIT_GRAMS = {
  g: 1, ml: 1, tsp: 5, tbsp: 15, cup: 240, katori: 150, bowl: 200,
  glass: 200, plate: 300, handful: 30, slice: 30, piece: 50,
};

// USDA per-ingredient measures use freeform/imperial unit labels ("1 cup", "1 tablespoon").
// Only trust a measure whose label is a *single* portion of the asked unit, so its grams is
// exactly grams-per-unit. Conservative on purpose — a wrong measure means silently wrong macros.
const UNIT_WORDS = {
  cup: ["cup"], tbsp: ["tbsp", "tablespoon"], tsp: ["tsp", "teaspoon"],
  slice: ["slice"], piece: ["piece"], bowl: ["bowl"], glass: ["glass"], plate: ["plate"],
};

export function pickMeasureForUnit(unit, measures = []) {
  if (!unit) return null;
  const words = UNIT_WORDS[unit] || [unit];
  for (const m of measures) {
    const label = String(m.label || "").toLowerCase();
    if (/^1\b/.test(label) && words.some(w => label.includes(w)) && num(m.grams) > 0) return m;
  }
  return null;
}

// qty + unit -> grams. Priority: explicit grams/ml -> per-ingredient measure -> generic unit
// default -> null (caller flags the line for the user to enter grams).
export function unitToGrams(qty, unit, measures = [], unitDefaults = null) {
  const q = num(qty);
  if (!(q > 0)) return { grams: null, basis: "no-qty" };
  if (!unit || unit === "g") return { grams: q, basis: "g" };
  if (unit === "ml") return { grams: q, basis: "ml≈g" };

  const meas = pickMeasureForUnit(unit, measures);
  if (meas) return { grams: q * num(meas.grams), basis: `measure:${meas.label}` };

  const generic = unitDefaults ? num(unitDefaults[unit]) : num(FALLBACK_UNIT_GRAMS[unit]);
  if (generic > 0) return { grams: q * generic, basis: `unit:${unit}` };

  return { grams: null, basis: "unknown-unit" };
}

export function lineConfidence(line) {
  if (!line.food) return "unmatched";
  return line.food.confidence || "medium";
}

// Atwater sanity: kcal should roughly equal 4P + 4C + 9F. Big deviation => suspect data.
export function atwaterDeviation(m) {
  const est = 4 * num(m.protein_g) + 4 * num(m.carb_g) + 9 * num(m.fat_g);
  if (num(m.kcal) <= 0) return est > 0 ? 1 : 0;
  return Math.abs(num(m.kcal) - est) / num(m.kcal);
}

// Sum resolved lines into recipe totals + per-serving, with QA flags. Each line: { food, grams }.
export function computeRecipeTotals(lines = [], servings = 1) {
  const s = num(servings) > 0 ? num(servings) : 1;
  const flags = [];
  let matched = 0, unmatched = 0, needsGrams = 0;

  const total = { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, fibre_g: 0 };
  for (const l of lines) {
    if (!l.food) { unmatched++; continue; }
    if (!(num(l.grams) > 0)) { needsGrams++; continue; }
    matched++;
    const m = computeLogMacros(l.food, l.grams);
    total.kcal += m.kcal; total.protein_g += m.protein_g; total.fat_g += m.fat_g;
    total.carb_g += m.carb_g; total.fibre_g += m.fibre_g;
  }

  if (unmatched > 0) flags.push("unmatched_ingredients");
  if (needsGrams > 0) flags.push("missing_grams");
  if (matched > 0 && atwaterDeviation(total) > 0.2) flags.push("atwater_fail");

  const perServing = {
    kcal: total.kcal / s, protein_g: total.protein_g / s, fat_g: total.fat_g / s,
    carb_g: total.carb_g / s, fibre_g: total.fibre_g / s,
  };
  return { total, perServing, flags, counts: { matched, unmatched, needsGrams, lines: lines.length } };
}

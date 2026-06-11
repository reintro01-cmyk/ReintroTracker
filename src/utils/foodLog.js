// Food-logging math. Grams is the source of truth — macros scale linearly from the
// per-100g values returned by search_foods. Kept pure for testing.

export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Scale a per-100g food to the logged gram amount.
export function computeLogMacros(food, grams) {
  const f = num(grams) / 100;
  return {
    kcal: num(food.kcal) * f,
    protein_g: num(food.protein_g) * f,
    fat_g: num(food.fat_g) * f,
    carb_g: num(food.carb_g) * f,
    fibre_g: num(food.fibre_g) * f,
  };
}

export function sumTotals(logs) {
  return (logs || []).reduce(
    (a, l) => ({
      kcal: a.kcal + num(l.kcal),
      protein_g: a.protein_g + num(l.protein_g),
      fat_g: a.fat_g + num(l.fat_g),
      carb_g: a.carb_g + num(l.carb_g),
      fibre_g: a.fibre_g + num(l.fibre_g),
    }),
    { kcal: 0, protein_g: 0, fat_g: 0, carb_g: 0, fibre_g: 0 }
  );
}

// Build the portion picker options for a food: grams base + the food's own USDA
// measures (absolute portions) + generic household units. Each option carries a
// gram weight; logged grams = qty * option.grams.
export function portionOptions(measures = [], unitDefaults = []) {
  const opts = [{ key: "g", label: "grams", grams: 1 }];
  for (const m of measures) {
    if (num(m.grams) > 0) opts.push({ key: `m:${m.label}`, label: m.label, grams: num(m.grams), isFood: true });
  }
  for (const u of unitDefaults) {
    if (u.unit !== "g") opts.push({ key: `u:${u.unit}`, label: u.unit, grams: num(u.grams) });
  }
  return opts;
}

// Build the on-demand "new ideas" set consumed by the Recipes page when the user taps
// "Generate new ideas". Source = CORPUS (real recipes already in our DB, methods stripped).
// Nutrition is computed from OUR food DB via the already-resolved ingredient_state_id +
// grams_resolved on each recipe_ingredient (ingredient_resolved = best-source per-100g).
// Output: src/data/recipeIdeas.js, lazy-imported by the page so it never ships by default.
// Deduped against the default library so ideas never repeat a scraped/curated recipe.
import pg from "pg";
import { readFileSync, writeFileSync } from "fs";
import { classify, isVeg, isSugarFree, requiredFoodsFor } from "./recipe_classify.mjs";
import { RECIPE_LIBRARY } from "../src/data/recipeLibrary.js";

const url = readFileSync(new URL("./.db_url", import.meta.url), "utf8").trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

// Per-recipe nutrition (recipe total) from resolved ingredients. ingredient_resolved is
// one row per ingredient_state_id (best source), so the join doesn't double-count.
const { rows } = await c.query(`
  with nut as (
    select ri.recipe_id,
      sum(ir.energy_kcal  * ri.grams_resolved / 100.0) kcal,
      sum(ir.protein_g    * ri.grams_resolved / 100.0) protein,
      sum(ir.fat_g        * ri.grams_resolved / 100.0) fat,
      sum(ir.carb_avail_g * ri.grams_resolved / 100.0) carb,
      sum(ir.fibre_g      * ri.grams_resolved / 100.0) fibre,
      sum(ri.grams_resolved) grams,
      count(*) filter (where ri.ingredient_state_id is null) unmatched
    from recipe_ingredients ri
    left join ingredient_resolved ir on ir.ingredient_state_id = ri.ingredient_state_id
    group by ri.recipe_id
  )
  select r.id, r.slug, r.name, r.tagline,
         nut.kcal, nut.protein, nut.fat, nut.carb, nut.fibre, nut.grams, nut.unmatched,
         coalesce(array_agg(ri.raw_text order by ri.position) filter (where ri.raw_text is not null), '{}') as ingredients
  from recipes r
  left join nut on nut.recipe_id = r.id
  left join recipe_ingredients ri on ri.recipe_id = r.id
  where r.source_id = 'CORPUS' and r.status = 'draft'
  group by r.id, r.slug, r.name, r.tagline,
           nut.kcal, nut.protein, nut.fat, nut.carb, nut.fibre, nut.grams, nut.unmatched
  order by r.name
`);

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const libNames = new Set(RECIPE_LIBRARY.map(r => norm(r.name)));

// CORPUS has many near-duplicate rows per dish (625 rows / 242 names). Keep one per name —
// the version with the most ingredients (richest data) — and drop any already in the library.
let dropped = { dupe: 0, nokcal: 0, within: 0 };
const best = new Map();
for (const r of rows) {
  const key = norm(r.name);
  if (libNames.has(key)) { dropped.dupe++; continue; }
  const prev = best.get(key);
  if (!prev) best.set(key, r);
  else { dropped.within++; if ((r.ingredients || []).length > (prev.ingredients || []).length) best.set(key, r); }
}

const ideas = [];
for (const r of best.values()) {
  // CORPUS servings are a placeholder (all 1), so estimate portions: ~300 g OR ~500 kcal
  // per serving, whichever implies more (so calorie-dense bakes don't show a 1,500-kcal
  // "serving"). Approximate — idea nutrition is flagged as estimated in the UI.
  const grams = num(r.grams);
  const totalKcal = num(r.kcal);
  const servings = Math.min(12, Math.max(1, Math.round(Math.max(grams / 300, totalKcal / 500)) || 1));
  const kcal = totalKcal / servings;
  if (!(kcal > 0)) { dropped.nokcal++; continue; }                 // no usable nutrition → don't surface
  const ingredients = r.ingredients || [];
  const { mealTypes, dessert } = classify(r.name, ingredients, kcal);
  ideas.push({
    id: r.slug,
    name: r.name,
    source: "CORPUS",
    tagline: r.tagline || "",
    tags: r.tagline ? r.tagline.split(/,\s*/).filter(Boolean).slice(0, 3) : [],
    requiredSafeFoods: [],
    servings,
    kcal: Math.round(kcal),
    macros: {
      protein: Math.round(num(r.protein) / servings),
      fat: Math.round(num(r.fat) / servings),
      carbs: Math.round(num(r.carb) / servings),
      fibre: Math.round(num(r.fibre) / servings),
    },
    ingredients: ingredients.map(name => ({ name })),
    method: "",                                                    // methods stripped (copyright) — generated on demand
    category: dessert ? "dessert" : "meal",
    mealTypes,
    requiredFoods: requiredFoodsFor(ingredients),
    veg: isVeg(r.name, ingredients),
    sugarFree: isSugarFree(r.name, ingredients),
    flags: num(r.unmatched) > 0 ? ["unmatched_ingredients"] : [],
  });
}

const counts = { breakfast: 0, mains: 0, snack: 0, dessert: 0, veg: 0, nonveg: 0 };
for (const r of ideas) r.veg ? counts.veg++ : counts.nonveg++;
for (const r of ideas) for (const m of r.mealTypes) counts[m] = (counts[m] || 0) + 1;

const out = `// AUTO-GENERATED by pipeline/build_recipe_ideas.mjs — do not edit by hand.
// CORPUS recipes (real, methods stripped) with nutrition computed from our food DB.
// Lazy-loaded only when the user taps "Generate new ideas". ${ideas.length} recipes.
export const RECIPE_IDEAS = ${JSON.stringify(ideas, null, 1)};
`;
writeFileSync(new URL("../src/data/recipeIdeas.js", import.meta.url), out);
console.log(`Wrote ${ideas.length} ideas -> src/data/recipeIdeas.js  (dropped ${dropped.dupe} dupes, ${dropped.nokcal} without nutrition)`);
console.log("tab counts:", counts);
await c.end();

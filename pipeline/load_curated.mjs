// Absorb the 47 hand-authored recipes (src/data/recipes.js) into the DB as the
// trusted, planner-ready set: status='published', source='CURATED', with their
// slot/phase/required_safe_foods + per-serving nutrition intact.
import { RECIPES } from "../src/data/recipes.js";
import { writeFileSync } from "fs";

const lit = s => (s === null || s === undefined || s === "") ? "null" : "'" + String(s).replace(/'/g, "''") + "'";
const num = v => (v === null || v === undefined) ? "null" : String(v);

const out = ["begin;",
  "insert into sources (id,name,description,license) values " +
  "('CURATED','Curated programme recipes','Hand-authored, vetted; slot/phase/safe-foods + macros','Owned') " +
  "on conflict (id) do nothing;"];

for (const r of RECIPES) {
  const slug = "cur-" + r.id;                       // 'cur-' prefix avoids corpus slug collisions
  const rsf = (r.requiredSafeFoods || []).length
    ? "ARRAY[" + r.requiredSafeFoods.map(lit).join(",") + "]::text[]" : "'{}'::text[]";
  const tags = (r.tags || []).join(", ");
  out.push(
    `with x as (insert into recipes (slug,name,tagline,method,prep_mins,phase,slot,required_safe_foods,source_id,source_ref,status) ` +
    `values (${lit(slug)},${lit(r.name)},${lit(tags)},${lit(r.method)},${num(r.prepMins)},${lit(r.phase)},${lit(r.slot)},${rsf},'CURATED',${lit(r.id)},'published') returning id)`);
  const m = r.macros || {};
  out.push(
    `insert into recipe_nutrition (recipe_id,per,energy_kcal,protein_g,fat_g,carb_avail_g,fibre_g,flags,method_version) ` +
    `select id,'serving',${num(r.kcal)},${num(m.protein)},${num(m.fat)},${num(m.carbs)},${num(m.fibre)},'{}'::text[],'curated' from x;`);
  (r.ingredients || []).forEach((ing, i) => {
    out.push(
      `insert into recipe_ingredients (recipe_id,ingredient_state_id,raw_text,match_confidence,position,notes) ` +
      `select id,(select ist.id from ingredients ii join ingredient_states ist on ist.ingredient_id=ii.id ` +
      `where lower(ii.canonical_name)=${lit((ing.name || "").toLowerCase())} limit 1),` +
      `${lit(((ing.qty ? ing.qty + " " : "") + ing.name))},'low',${i},${lit(ing.name)} ` +
      `from (select id from recipes where slug=${lit(slug)}) r;`);
  });
}
out.push("commit;");
writeFileSync(new URL("./out/curated_load.sql", import.meta.url), out.join("\n"));
console.log("curated recipes:", RECIPES.length, "-> pipeline/out/curated_load.sql");

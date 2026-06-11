// Resolve extracted recipe facts against our food DB, recompute nutrition, and load as
// published recipes. Nutrition is OUR computed value (never the card's). Method is left null
// (generated on demand later). Source = 'COMMUNITY' (no third-party branding stored).
// Idempotent: clears prior COMMUNITY recipes first. Usage: node pipeline/load_extracted_recipes.mjs
import pg from "pg";
import { readFileSync } from "fs";

const url = readFileSync(new URL("./.db_url", import.meta.url), "utf8").trim();
const recipes = JSON.parse(readFileSync(new URL("./out/recipes_extracted.json", import.meta.url), "utf8"))
  .filter(r => !r.error && r.name && r.ingredients?.length);

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);

// Ingredient-aware unit->gram resolution. Generic cup/count defaults badly overcount small
// or leafy items (3 garlic "pods" != 150g; ½ cup spinach != 120g), so use per-item typical
// weights + category-aware cup weights. Approximate but far closer than flat defaults.
const ITEM_WEIGHTS = [
  [/\b(garlic|clove|pod)\b/, 5], [/\b(green )?chill?[iy]\b|\bchili\b|\bbird'?s eye\b/, 5],
  [/\bcurry leaf|curry leaves\b/, 0.3], [/\bshallot\b/, 25], [/\bspring onion\b/, 15],
  [/\bonion\b/, 100], [/\btomato\b/, 100], [/\bpotato\b/, 150], [/\begg\b/, 50],
  [/\basparagus|spear\b/, 18], [/\bbanana\b/, 120], [/\b(apple|orange|pear|guava)\b/, 150],
  [/\b(lemon|lime)\b/, 55], [/\bcarrot\b/, 70], [/\bcucumber\b/, 200], [/\bbeet(root)?\b/, 120],
  [/\b(capsicum|bell pepper|shimla)\b/, 120], [/\bzucchini\b/, 200], [/\bidli\b/, 40],
  [/\b(dosa|chapati|roti|paratha|pathiri)\b/, 50], [/\b(bread|toast)\b/, 30],
  [/\b(date|khajoor|fig|anjeer)\b/, 8], [/\b(almond|cashew|walnut|pistachio|nut)\b/, 1.3],
  [/\bmushroom\b/, 20], [/\bokra|bhindi\b/, 10], [/\bbroccoli|cauliflower\b/, 90],
];
const pieceWeight = name => { for (const [re, g] of ITEM_WEIGHTS) if (re.test(name)) return g; return 60; };
const LEAFY = /\b(spinach|palak|lettuce|mint|coriander|cilantro|methi|fenugreek|kale|amaranth|greens|leaves|basil|celery)\b/;
const LIQUID = /\b(water|milk|stock|broth|juice|buttermilk|curd|yogurt|oil|cream|coconut milk|dal|soup|paste)\b/;
const cupWeight = name => LIQUID.test(name) ? 240 : LEAFY.test(name) ? 30 : 120;

function gramsFor(qty, unit, rawName) {
  const q = num(qty);
  if (!(q > 0)) return null;                     // "to taste"
  const name = String(rawName || "").toLowerCase();
  if (unit === "g" || unit === "ml") return q;
  if (unit === "cup") return q * cupWeight(name);
  if (unit === "bowl") return q * (LIQUID.test(name) ? 300 : 180);
  if (unit === "glass") return q * 240;
  if (unit === "katori") return q * (LIQUID.test(name) ? 150 : 100);
  if (unit === "plate") return q * 250;
  if (unit === "tbsp") return q * 15;
  if (unit === "tsp") return q * 5;
  if (unit === "pinch") return q * 0.5;
  if (unit === "handful") return q * 20;
  if (unit === "slice" || unit === "piece" || !unit) return q * pieceWeight(name);
  return q * pieceWeight(name);
}

// resolve a unique ingredient name once -> best food (cached)
const cache = new Map();
async function resolve(name) {
  const key = name.toLowerCase().trim();
  if (cache.has(key)) return cache.get(key);
  const { rows } = await c.query("select ingredient_id, kcal, protein_g, fat_g, carb_g, fibre_g from search_foods($1,'india',1)", [name]);
  const hit = rows[0] || null;
  cache.set(key, hit);
  return hit;
}
async function stateIdFor(ingredientId) {
  const { rows } = await c.query("select id from ingredient_states where ingredient_id=$1 order by (state='raw') desc limit 1", [ingredientId]);
  return rows[0]?.id || null;
}

// clean slate for re-runs
await c.query("delete from recipes where source_id='COMMUNITY'");
await c.query("insert into sources (id,name,description,license) values ('COMMUNITY','Community recipes','Ingredient facts extracted from shared recipe cards; nutrition recomputed from our DB; methods rewritten','Facts-only / derived') on conflict (id) do nothing");

let loaded = 0, skipped = 0;
const seen = new Set();
for (let idx = 0; idx < recipes.length; idx++) {
  const r = recipes[idx];
  const nameKey = r.name.toLowerCase().trim();
  if (seen.has(nameKey)) { skipped++; continue; }       // dedup duplicate cards
  seen.add(nameKey);

  const servings = num(r.servings) > 0 ? num(r.servings) : 1;
  const lines = [];
  let unmatched = 0;
  const total = { kcal: 0, protein_g: 0, fat_g: 0, carb_avail_g: 0, fibre_g: 0 };
  for (const ing of r.ingredients) {
    const grams = gramsFor(ing.qty, ing.unit, ing.name);
    const food = await resolve(ing.name);
    if (!food) unmatched++;
    if (food && grams > 0) {
      const f = grams / 100;
      total.kcal += num(food.kcal) * f; total.protein_g += num(food.protein_g) * f;
      total.fat_g += num(food.fat_g) * f; total.carb_avail_g += num(food.carb_g) * f;
      total.fibre_g += num(food.fibre_g) * f;
    }
    lines.push({ raw: ing.name, qty: ing.qty, unit: ing.unit, grams, food });
  }

  const slug = `comm-${idx}-${slugify(r.name)}`;
  const { rows: rec } = await c.query(
    "insert into recipes (slug,name,servings,source_id,status,tagline) values ($1,$2,$3,'COMMUNITY','published',$4) returning id",
    [slug, r.name.slice(0, 120), servings, (r.health_tags || []).join(", ").slice(0, 200) || null]
  );
  const rid = rec[0].id;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const stateId = l.food ? await stateIdFor(l.food.ingredient_id) : null;
    await c.query(
      "insert into recipe_ingredients (recipe_id,ingredient_state_id,raw_text,qty,unit,grams_resolved,match_confidence,position,notes) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [rid, stateId, l.raw, l.qty, l.unit, l.grams, l.food ? "medium" : "unmatched", i, l.food ? null : "unmatched"]
    );
  }
  const flags = unmatched > 0 ? "{unmatched_ingredients}" : "{}";
  for (const [per, src] of [["serving", 1 / servings], ["recipe", 1]]) {
    await c.query(
      "insert into recipe_nutrition (recipe_id,per,energy_kcal,protein_g,fat_g,carb_avail_g,fibre_g,flags,method_version) values ($1,$2,$3,$4,$5,$6,$7,$8,'img-extract-v1')",
      [rid, per, total.kcal * src, total.protein_g * src, total.fat_g * src, total.carb_avail_g * src, total.fibre_g * src, flags]
    );
  }
  loaded++;
  if (loaded % 25 === 0) console.log(`  loaded ${loaded}…`);
}

console.log(`Done. loaded=${loaded} deduped=${skipped} (from ${recipes.length} extracted)`);
const { rows: chk } = await c.query("select count(*) n, round(avg(rn.energy_kcal)) avg_kcal from recipes r join recipe_nutrition rn on rn.recipe_id=r.id and rn.per='serving' where r.source_id='COMMUNITY'");
console.log("COMMUNITY recipes:", chk[0]);
await c.end();

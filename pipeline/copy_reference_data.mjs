// Copy REFERENCE/food data dev -> prod via CSV COPY. Never copies user data
// (tracker_states, food_logs, community_entries, auth.*). Recipes are limited to curated
// rows (created_by is null); their children follow. unit_defaults is seeded by the migration.
//   node pipeline/copy_reference_data.mjs
import pg from "pg";
import { to as copyTo, from as copyFrom } from "pg-copy-streams";
import { readFileSync } from "fs";
import { pipeline } from "stream/promises";

const devUrl = readFileSync(new URL("./.db_url", import.meta.url), "utf8").trim();
const prodUrl = readFileSync(new URL("./.prod_db_url", import.meta.url), "utf8").trim();

// FK-safe order. `select *` preserves table column order on both sides (identical schema).
const TABLES = [
  ["sources",            "COPY sources TO STDOUT (FORMAT csv)"],
  ["ingredients",        "COPY ingredients TO STDOUT (FORMAT csv)"],
  ["ingredient_states",  "COPY ingredient_states TO STDOUT (FORMAT csv)"],
  ["nutrient_values",    "COPY nutrient_values TO STDOUT (FORMAT csv)"],
  ["measures",           "COPY measures TO STDOUT (FORMAT csv)"],
  ["food_synonyms",      "COPY food_synonyms TO STDOUT (FORMAT csv)"],
  ["recipes",            "COPY (select * from recipes where created_by is null) TO STDOUT (FORMAT csv)"],
  ["recipe_ingredients", "COPY (select ri.* from recipe_ingredients ri join recipes r on r.id = ri.recipe_id where r.created_by is null) TO STDOUT (FORMAT csv)"],
  ["recipe_nutrition",   "COPY (select rn.* from recipe_nutrition rn join recipes r on r.id = rn.recipe_id where r.created_by is null) TO STDOUT (FORMAT csv)"],
];

const dev = new pg.Client({ connectionString: devUrl, ssl: { rejectUnauthorized: false } });
const prod = new pg.Client({ connectionString: prodUrl, ssl: { rejectUnauthorized: false } });
await dev.connect();
await prod.connect();

try {
  // Clear migration-seeded reference rows (e.g. sources) so COPY lands clean. CASCADE clears
  // any FK references — safe here because prod has no user data yet (food_logs etc. are empty).
  await prod.query(`TRUNCATE recipe_nutrition, recipe_ingredients, recipes, food_synonyms, measures, nutrient_values, ingredient_states, ingredients, sources CASCADE`);

  for (const [name, copyOut] of TABLES) {
    const src = dev.query(copyTo(copyOut));
    const dst = prod.query(copyFrom(`COPY ${name} FROM STDIN (FORMAT csv)`));
    await pipeline(src, dst);
    const { rows } = await prod.query(`select count(*)::int c from ${name}`);
    console.log(`${name.padEnd(20)} -> ${rows[0].c}`);
  }
  console.log("done");
} finally {
  await dev.end();
  await prod.end();
}

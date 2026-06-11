// Batch-extract recipe FACTS from card images via the extract-recipe-image edge function.
// Facts only (name + ingredients + servings); method prose is never copied, nutrition recomputed
// later from our food DB. Usage: node pipeline/extract_recipe_images.mjs <imagesDir> [limit]
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const URL = "https://fmaqipsfrfpfpoqzotnk.supabase.co";
const ANON = "sb_publishable_dKjRhjUESeG1kSYY23-GLA_rn-iqdke";
const EMAIL = process.env.RT_EMAIL, PASSWORD = process.env.RT_PASSWORD;
if (!EMAIL || !PASSWORD) { console.error("set RT_EMAIL and RT_PASSWORD env vars"); process.exit(1); }
const DIR = process.argv[2];
const LIMIT = process.argv[3] ? Number(process.argv[3]) : Infinity;
const OUT = join(process.cwd(), "pipeline/out/recipes_extracted.json");

if (!DIR) { console.error("usage: node extract_recipe_images.mjs <imagesDir> [limit]"); process.exit(1); }

async function token() {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error("auth failed: " + JSON.stringify(j));
  return j.access_token;
}

async function extractOne(jwt, path) {
  const b64 = readFileSync(path).toString("base64");
  const r = await fetch(`${URL}/functions/v1/extract-recipe-image`, {
    method: "POST",
    headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ image_base64: b64, media_type: "image/jpeg" }),
  });
  return r.json();
}

const jwt = await token();
const files = readdirSync(DIR).filter(f => /\.jpe?g$/i.test(f)).sort().slice(0, LIMIT);
console.log(`Extracting ${files.length} image(s)…`);

const results = [];
const CONC = 4;
for (let i = 0; i < files.length; i += CONC) {
  const chunk = files.slice(i, i + CONC);
  const out = await Promise.all(chunk.map(async f => {
    try {
      const data = await extractOne(jwt, join(DIR, f));
      if (data.error) return { file: f, error: data.error };
      return { file: f, ...data };
    } catch (e) { return { file: f, error: e.message }; }
  }));
  results.push(...out);
  console.log(`  ${Math.min(i + CONC, files.length)}/${files.length}`);
}

writeFileSync(OUT, JSON.stringify(results, null, 2));
const ok = results.filter(r => !r.error);
console.log(`Done. ${ok.length}/${results.length} extracted -> ${OUT}`);
for (const r of ok.slice(0, 8)) console.log(`  • ${r.name} (${r.ingredients.length} ing, ${r.servings} serv, stated ${r.stated_kcal} kcal)`);
const errs = results.filter(r => r.error);
if (errs.length) console.log("errors:", errs.map(e => `${e.file}: ${e.error}`).slice(0, 5));

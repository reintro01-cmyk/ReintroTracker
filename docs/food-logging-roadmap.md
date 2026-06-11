# Food Logging — Roadmap

Goal: let a client **anywhere** log what they ate (by typing a food, picking a portion, or
pasting a recipe) and get accurate nutrition, robustly. This doc is the build plan, the data
strategy, and the risk register.

---

## 0. Where we are today (honest assessment)

| Asset | State | Gap for logging |
|---|---|---|
| **Nutrition schema** (Supabase) | Strong, well-designed: ingredient → state (raw/cooked, yield factor) → versioned per-100g `nutrient_values` (+ ~145 micros) with source/provenance/confidence; `measures` (household→g); `recipes` + `recipe_ingredients` + computed `recipe_nutrition`; `ingredient_resolved` view (source-priority read surface). | None — this is the right backbone. |
| **IFCT-2017** | 542 Indian foods ingested by `pipeline/ingest_ifct.py`. | India-centric only. |
| **USDA SR Legacy + Foundation** | `pipeline/ingest_usda.py` ingests **~8,262 generic foods** (the full SR Legacy + Foundation sets — *not* just the 20 in the coverage report; those 20 are only the app-food mapping). | Generic only — **no branded foods**; US-centric. |
| **Recipe corpus** | 725 recipes, 97 % ingredient-mapped, shipped in-app as `recipes.data.js`. | Reintro suggestions, not user logging. |
| **`measures` (portion→grams)** | Table exists; **population unverified**. | **Blocker** — logging needs grams. |
| **App ↔ nutrition DB wiring** | **None.** App reads only `foods.js` (name/group/portion, no macros) + the recipe corpus. | **Blocker** — must expose `ingredient_resolved`. |

### ⚠️ Two things to verify before building

1. **Is the ingredient data actually in the live Supabase DB?** The generated load files
   (`pipeline/out/*.sql`) are **gitignored and no longer on disk**, and `load_all.sh` needs
   `psql` + a direct DB URL (neither currently working here). The recipe corpus shipping in the
   app does **not** prove the ingredient tables were loaded. **Verify:**
   ```sql
   select source_id, count(*) from nutrient_values group by 1 order by 2 desc;
   -- expect ~ IFCT-2017: 542, USDA-SR: ~7.8k, USDA-FNDF: few hundred
   ```
   If empty/partial: re-download USDA FDC CSVs (SR Legacy + Foundation) + re-run
   `ingest_ifct.py` / `ingest_usda.py` → `load_all.sh`. (USDA source CSVs were read from `/tmp`,
   so they're likely gone — re-download from <https://fdc.nal.usda.gov/download-datasets.html>.)
2. **Is `measures` populated?** `select count(*) from measures;` — if low, portion conversion is
   the first thing to build/seed.

### Answer to "have we uploaded the extensive USDA database?"

**Partially.** The pipeline ingests the **full USDA generic catalog (SR Legacy + Foundation, ~8.3k
foods)** — not just 20. But (a) it excludes the **USDA Branded Foods** DB (~1.4M packaged
products), (b) the generated SQL isn't on disk anymore (regenerate to reload), and (c) it's
**unconfirmed whether it was loaded into the live project** (verify with the query above).

---

## Global-coverage strategy (the "clients anywhere" requirement)

IFCT (India) + USDA (US generic) is **not enough** for clients in arbitrary countries or for
branded/restaurant foods. Options, in order of recommended adoption:

| Source | Coverage | License | Use for |
|---|---|---|---|
| **IFCT-2017** | Indian whole foods | MIT compilation | India accuracy (keep as top priority) |
| **USDA FDC** | US generic + (optionally) branded | Public domain | Generic foods, fallback |
| **Open Food Facts** | **Global, ~3M+ packaged products, multilingual, barcodes** | ODbL (attribution + share-alike) | Branded/packaged foods worldwide, barcode scan |
| **Commercial API** (Nutritionix, Edamam, FatSecret) | Global + restaurant + NLP portion parsing | Paid, per-call | Buy-vs-build shortcut (see below) |

**Recommendation:** keep the self-hosted ingredient DB as the spine (offline, free, controllable,
allergen-safe), add **Open Food Facts** for global/branded coverage, and treat a commercial API as
an optional fallback for long-tail/restaurant items. Decide **build-vs-buy early** — it changes the
whole architecture (see §5).

> **Decision (locked): Hybrid.** Self-hosted IFCT + USDA + OFF spine, paid API as fallback only.

### Built & validated this session (LIVE — connected via session pooler)
- `supabase/migrations/20260531010000_off_branded_support.sql` — `barcode` + `brand` on
  `ingredients`, unique barcode index, brand trigram index, `OFF` source row. **Applied to live DB.**
- `pipeline/ingest_off.py` — **rewritten** for OFF's real schema (nested `nutriments` list-of-structs,
  multilingual `product_name`). DuckDB streams the (remote or local) 7.5GB Parquet, flattens +
  quality-gates rows into a Postgres staging table via `ATTACH`, then runs native Postgres upserts
  (`postgres_execute`, so `ON CONFLICT` works) into ingredients → states → nutrient_values.
  No psql, no CSV. Reads the connection from `pipeline/.db_url`.
- `pipeline/.venv/` — duckdb 1.5.3 (httpfs + postgres extensions), gitignored.
- **Proof load done:** 3,000 branded products live (`nutrient_values` source OFF). Streaming
  ~3k rows took ~30s.

**Live DB state (verified):** USDA-SR 7,793 · USDA-FNDF 469 · IFCT-2017 540 · **OFF 3,000** ·
recipes 771 · `measures` **0 (empty — logging blocker)**.

**Scaling the OFF load — quality/cost tradeoff (open decision):**
- `--limit N` *streams* (fast, free-tier-safe) but grabs the **lowest barcodes first** — an
  arbitrary, mostly-obscure slice. Fine for testing, weak for production.
- A useful load (India-focused or popularity-ranked) needs `--countries`/`--order-by-popularity`,
  which **force a full ~7.5GB scan** → download `food.parquet` locally first.
- ⚠️ Full usable set is ~1–2M rows → exceeds Supabase's **free 500MB tier**. Subset, or go
  **Pro (8GB, ~$25/mo)**.

```
pipeline/.venv/bin/python pipeline/ingest_off.py --limit 100000                         # fast, arbitrary
# or, after downloading food.parquet locally:
pipeline/.venv/bin/python pipeline/ingest_off.py --parquet food.parquet --countries en:india
```

---

## Phase 1 — Expose nutrition to the app

Nothing logs until the app can read the ingredient data.

- **Read API**: an edge function `food-search` (and `food-get`) over the `ingredient_resolved`
  view. Keep the Anthropic-key pattern from `generate-recipes` (server-side, JWT-verified).
- **Search endpoint** returns: `ingredient_id, canonical_name, category, per-100g macros,
  confidence, default measure`. Paginated, ranked (see Phase 2).
- **Why an edge function, not direct table reads:** centralizes ranking/fuzzy logic, keeps the
  publishable key surface minimal, lets us swap in OFF/commercial sources without client changes.
- Confirm RLS: reference tables are `public read` already (good). `tracker_states` and the new
  `food_logs` table must be **owner-only** (`auth.uid() = user_id`).

## Phase 2 — Fuzzy food search + typo tolerance (the "spelling buffer")

Local foods are spelled many ways (chapati/chapathi/chappati; brinjal/eggplant; curd/dahi). The
schema is **already built for this** — `pg_trgm` is enabled, `ingredients.canonical_name` has a
GIN trigram index, plus `aliases text[]` and `local_names jsonb` (hi/ta…).

**Matching pipeline (cheap → expensive):**
1. **Exact / alias** match (`= name` or `name = any(aliases)`).
2. **Trigram similarity** (`similarity(canonical_name, query) > 0.3`, plus alias trigrams) →
   ranked candidates. Handles typos and spelling variants well.
3. **Phonetic** (optional): `dmetaphone` for sound-alike misspellings.
4. **Transliteration / local names**: match against `local_names` values; curate an alias list
   for known regional variants.
5. **"Did you mean" UI**: always return **top-N suggestions with a confidence**, never silently
   pick one. The user confirms — this is the guardrail against logging the wrong food's calories.
6. **LLM normalizer (fallback)**: when 1–5 yield nothing good, an edge function asks the model to
   normalize the entry to a canonical food name from a candidate list (it **selects/normalizes**,
   it does **not** invent macros). Same hybrid pattern as the schedule parser.

**Failure mode to design against:** a confident wrong match (e.g. "butter" → "butter beans") logs
wildly wrong calories. Mitigation: show matched name + category + per-100g kcal + confidence in the
confirm step; let the user pick an alternative.

## Phase 3 — Logging core

- **New table `food_logs`**: `id, user_id, logged_at, source ('ingredient'|'recipe'|'custom'),
  ref_id, qty, unit, grams_resolved, kcal, protein_g, fat_g, carb_g, fibre_g, note`. RLS owner-only.
- **Portion → grams**: use `measures` (e.g. "1 katori", "1 medium", "1 cup"). Where missing, fall
  back to a default measure + let the user edit grams. **Cooked vs raw matters** — log against the
  consumed `ingredient_state` (the schema's `yield_factor` exists exactly for this).
- **Daily view**: totals vs targets (reuse `nutrition` macro targets already in state), per-meal
  grouping, trend over time.
- **Offline-first**: queue logs locally, sync to Supabase (the app already does debounced cloud
  sync for `tracker_states` — extend the pattern).

### Portion & unit measurement — maturity path

**Invariant: grams is the source of truth.** Nutrition is per-100g, so once grams are known macros
are exact. Units are *only* a convenience layer that prefills a gram value; accuracy never depends
on the unit mapping being perfect, and logged macros are snapshotted in grams so improving the
mapping never rewrites history.

A unit's gram weight is **food- and state-specific** (1 cup rice ≠ 1 cup oil; 1 katori dal ≠ 1
katori dry rice; 100g raw rice ≈ 250g cooked). So the mapping matures in tiers:

| Tier | Mapping | Example | Source |
|---|---|---|---|
| **v1** (shipped) | Global `unit_defaults`, editable | "1 cup" → 240g for everything | curated |
| **v2** | Category defaults | grain cup 185g vs oil cup 218g | curated by `category` |
| **v3** (loading now) | **Per-ingredient `measures`** | "1 katori rice" → 150g | **USDA `food_portion`** (mapped via `nutrient_values.source_food_code` = fdc_id) |
| **v4** | **State-aware** (raw/cooked) | resolves cooked vs raw via `ingredient_states.yield_factor` | USDA + curated |
| **v5** | **Personalized** | remembers *your* "1 bowl" from past logs | learned from `food_logs` |

**Other portion sources to fold in:** OFF `serving_size`/`serving_quantity` (branded per-product
accuracy), IFCT standard measures (Indian portions), curated values for common Indian dishes
(idli/dosa/katori). Units are **cultural** — present region-appropriate units (tie to the same
`country` param as search) but always resolve to grams underneath.

**Failure modes:** volume vs weight (ml honey ≠ g honey — `unit_defaults.is_volume` is the first
guard, density the real fix); cooked vs raw (the most common logging error — `yield_factor` fixes
it); branded serving sizes (prefer the product's own `serving_quantity`); regional unit drift (a
"katori" varies — default + let the user calibrate once, feeding v5).

## Phase 4 — LLM recipe reverse-engineering → nutrition

User pastes a recipe ("2 cups rice, 1 tbsp ghee, 200g paneer, …") → we produce nutrition.

- **Edge function `parse-recipe`**: LLM converts free text into **structured line items**
  `{ raw_text, qty, unit, ingredient_guess }` — **parsing only, never macros.**
- **Resolve** each line to an `ingredient_state` via the Phase-2 fuzzy matcher; convert qty→grams
  via `measures`/`yield_factor`.
- **Compute** nutrition **from our tables** (sum of resolved line items), store in
  `recipe_ingredients` + computed `recipe_nutrition`. This is the schema's core principle:
  *"recipes store ingredient refs + quantities, never hardcoded macros — computed values cannot
  drift."*
- **Unmatched lines** (`match_confidence = 'unmatched'`) are surfaced for user confirmation, with
  an `error_pct` and flags (`atwater_fail`, `unmatched_ingredients`) shown as disclaimers.
- The `generate-recipes` function and `recipes`/`recipe_nutrition` tables already model most of
  this — Phase 4 is mostly the **parse + resolve + compute** glue, not net-new schema.

**Hard guardrail:** the LLM must never output calorie/macro numbers. It only (a) parses text to
structure and (b) picks a canonical ingredient from a candidate list. All numbers come from the
nutrition DB. This is what makes the output trustworthy and defensible for paying clients.

---

## 5. Build vs buy (decide before Phase 1)

| | Self-hosted DB (current path) | Commercial API (Nutritionix/Edamam) |
|---|---|---|
| Global + branded + restaurant | Needs OFF + work | ✅ out of the box |
| NL portion parsing ("a bowl of dal") | Build it | ✅ included |
| Cost | Free (storage) | Per-call, scales with users |
| Offline / latency | ✅ | ❌ network dependency |
| Control / allergen safety / India accuracy | ✅ (IFCT priority) | ❌ generic |
| Licensing for commercial app | IFCT MIT-compilation, USDA public domain, OFF ODbL (attribution + share-alike) | Per their ToS |

**Recommendation:** self-hosted spine + OFF for breadth, commercial API as an optional paid
fallback for the long tail. Revisit if support burden on coverage gets high.

---

## 6. Robustness checklist (for paying clients)

- **Never show a number without provenance** — surface `confidence` and "estimated" labels;
  low-confidence rows already flagged in the schema.
- **Confirm-before-log** on any fuzzy match; one-tap correction.
- **Units**: metric/imperial toggle; katori/cup/tbsp/g; per-region defaults.
- **i18n / transliteration** for food names (`local_names`, curated aliases).
- **Allergen safety carries into logging** — warn if a logged food maps to an Avoid food.
- **Data versioning**: `nutrient_values.version` lets you swap to licensed IFCT later as a data
  update, not a rebuild.
- **QA gates**: Atwater/energy checks (already in the pipeline) run on any computed recipe.
- **Accuracy expectations**: set them in-product — composite/restaurant foods are estimates.

## 7. Top risks / failure modes

1. **Ingredient data not actually in the live DB** → verify first (§0).
2. **LLM inventing macros** → architecturally prevented (compute from DB only).
3. **Confident wrong fuzzy match** → confirm-before-log + show matched details + confidence.
4. **Portion ambiguity (raw vs cooked, "1 cup")** → use `ingredient_state` + `yield_factor` +
   curated `measures`; default + editable grams.
5. **Coverage gaps for non-India/non-US foods** → Open Food Facts; graceful "couldn't find,
   add custom" path.
6. **`measures` sparsely populated** → logging UX degrades to manual grams; seed common measures early.
7. **Licensing for a commercial product** → IFCT/USDA fine; OFF needs ODbL attribution +
   share-alike consideration; commercial APIs per ToS.

## Suggested sequencing

```
0. Verify live DB has IFCT+USDA, and measures coverage         (½ day — gating)
1. food-search / food-get edge functions over ingredient_resolved  (1–2 days)
2. Fuzzy search + "did you mean" + confirm UI                  (2–3 days)
3. food_logs table + logging UI + daily totals                (3–4 days)
4. parse-recipe (LLM parse → resolve → compute)               (2–3 days)
+  Open Food Facts integration for global/branded coverage    (2–3 days, parallelisable)
```

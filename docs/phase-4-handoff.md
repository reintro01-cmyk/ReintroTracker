# Handoff — Food Logging build (start Phase 4 here)

Self-contained brief for a **fresh session**. Read this + `docs/food-logging-roadmap.md`
before touching Phase 4. Everything below is **live and committed on `main`** unless noted.

---

## 1. Where we are

The food-logging foundation is built, loaded into the live Supabase DB, and verified
end-to-end in the browser.

**Live DB state (project `fmaqipsfrfpfpoqzotnk`, region ap-southeast-1):**

| Object | State |
|---|---|
| `ingredients` / `nutrient_values` | 8,802 (USDA-SR 7,793 · USDA-FNDF 469 · IFCT-2017 540) |
| `nutrient_values` source OFF | 3,000 branded products (proof load; arbitrary low-barcode slice) |
| `measures` | 14,636 portion rows across 7,649 ingredients (USDA food_portion) |
| `unit_defaults` | 12 household units (g/ml/tsp/tbsp/cup/katori/…) |
| `recipes` / `recipe_nutrition` | 771 each (curated corpus) |
| `food_logs` | empty (owner-RLS, ready) |
| View `ingredient_resolved` | source-priority per-100g read surface |
| RPC `search_foods(q, country, lim)` | typo-tolerant + country-ranked + ranking v2 (dedup, byproduct/processed penalties) |

**App features shipped (React, `src/`):**
- **Schedule reorder** (NL group ordering + LLM fallback) — `utils/scheduleOrder.js`, `utils/scheduleAI.js`, edge fn `parse-schedule-order` (NOT deployed yet)
- **Pin food to date** — `utils/schedule.js`, `EntryModal` date picker
- **Food Log tab** — `components/tabs/LogTab.jsx`, `hooks/useFoodLog.js`, `utils/foodLog.js`. Search → portion (incl. real USDA measures) → log → daily totals → delete. Verified live.
- **Recipe → nutrition (Phase 4, DONE)** — "From recipe" button in LogTab → `components/recipe/AddRecipeModal.jsx`, `hooks/useRecipeBuilder.js`, `utils/recipeParse.js` (LLM edge fn `parse-recipe`, **DEPLOYED**) + `utils/recipeParseLocal.js` (offline regex fallback) + `utils/recipeResolve.js` (qty+unit→grams, sum macros, QA flags). Paste text → AI parses to line items (never macros) → resolve each via search_foods+measures → editable review (swap match, set grams, re-search) → save draft recipe (recipes/recipe_ingredients/recipe_nutrition) + optionally log a serving. Verified end-to-end live (parse, resolve, RLS persistence, food_log).

**Key commits (newest first):** `8d1d6b9` search ranking v2 · `5bbf7bc` LogTab · `74a55f4`
food_logs+portions · `9f9404c` search_foods RPC · `cffb498` OFF loader · `4114dc6` roadmap+OFF.

**Migrations** (applied to live DB *directly via pg*, not all tracked in supabase migration
history — idempotent, so `supabase db push` will reconcile):
`20260528…` schema · `20260529…` resolved view · `20260531010000` OFF support ·
`…030000` food_logs+unit_defaults · `…020000`/`…040000` search_foods v1/v2 ·
`…050000` **user_recipes_rls** (owner RLS so authenticated users own draft recipes — applied live).

---

## 2. Cold-start runbook (how to work with the DB)

**Connection lives in `pipeline/.db_url`** (gitignored) — a session-pooler `postgresql://`
URI. The direct `db.<ref>.supabase.co` host is **IPv6-only and unreachable**; always use the
pooler URI (`aws-1-ap-southeast-1.pooler.supabase.com:5432`, user `postgres.fmaqipsfrfpfpoqzotnk`).

> ⚠️ **Reset the DB password first.** The current one was shared in chat during setup. After
> reset, update `pipeline/.db_url` (Dashboard → Connect → Session pooler) — percent-encode any
> `@`/special chars in the URI form, or connect via discrete libpq fields.

**Tooling (both gitignored, may need reinstalling in a fresh checkout):**
```bash
npm install --no-save pg            # node Postgres client for queries/migrations
python3 -m venv pipeline/.venv && pipeline/.venv/bin/pip install duckdb   # for parquet/CSV ETL
```
Run migrations / queries with a tiny node `pg.Client` (password has special chars → pass
discrete fields `{host,port,user,password,database,ssl:{rejectUnauthorized:false}}`, not a URI).
The **superuser pg connection bypasses RLS** — handy for inspection/seeding.

**Gotchas already hit (don't relearn these):**
- `psql` is NOT installed; `\copy`-based load scripts won't run — use node pg or DuckDB `ATTACH`.
- DuckDB → Postgres bulk load: `ATTACH '<uri>' AS pg (TYPE postgres)` + `CALL postgres_execute('pg', $$…$$)` for native ON CONFLICT.
- `pip install` is PEP-668 blocked → use the venv above.
- Supabase **signup rejects `@test.com`** as invalid. To make a usable test user, insert into
  `auth.users` + `auth.identities` directly (bcrypt via `extensions.crypt(pw, extensions.gen_salt('bf'))`,
  `email_confirmed_at=now()`); that bypasses email validation and the 6-char min.
- Supabase CLI is fixed (`supabase` 2.101.0, project linked).
- Dev server: `preview_start` with `.claude/launch.json` config `vite` (port 5200).

---

## 3. Phase 4 — LLM recipe → nutrition ✅ BUILT & VERIFIED

> **Status (done):** all 5 pipeline steps below are implemented, the `parse-recipe` edge fn is
> deployed (Claude Haiku, ANTHROPIC_API_KEY secret set), the `user_recipes_rls` migration is
> live, and the flow was verified end-to-end in the browser (parse → resolve → review → save
> draft recipe + log a serving, all under owner RLS). Files in §1. Remaining polish is in §4.
> Known gap surfaced during verify: search ranks branded OFF products above plain whole foods
> for generic terms ("basmati rice" → "Jasmine Rice · Kroger") — user fixes inline via the
> per-line match dropdown; permanent fix is roadmap #3 (whole-food signal).

**Goal:** user pastes a recipe ("2 cups rice, 1 tbsp ghee, 200g paneer, …") → we produce
nutrition. **Hard invariant: the LLM only parses text into structured line items — it never
emits macros.** All numbers are computed from our ingredient tables. This is what makes it
trustworthy for paying clients.

**Pipeline:**
1. **`parse-recipe` edge function** — ✅ **SCAFFOLDED** (`supabase/functions/parse-recipe/index.ts`,
   client wrapper `src/utils/recipeParse.js`). Written, NOT deployed/runtime-tested yet. Parses
   free text → `{ servings, lines: [{ raw_text, qty, unit, ingredient_guess }] }`, sanitizes
   output, strips any nutrition the model emits. Needs `ANTHROPIC_API_KEY` secret + deploy.
2. **Resolve** each line client- or server-side: call `search_foods(ingredient_guess, country)`
   → take top candidate (show confidence). Convert qty+unit → grams via `measures`
   (per-ingredient) → `unit_defaults` fallback → raw grams.
3. **Compute** nutrition by summing `computeLogMacros(food, grams)` across resolved lines
   (reuse `src/utils/foodLog.js`). Per-serving = total / servings.
4. **Store**: `recipes` (status 'draft', `created_by` = user) + `recipe_ingredients`
   (`match_confidence` per line; 'unmatched' where search missed) + computed `recipe_nutrition`
   (with `flags`: `unmatched_ingredients`, `atwater_fail`, `variance_high`).
5. **UI**: a "Add recipe" flow — paste → review parsed lines (each editable, unmatched ones
   flagged for the user to pick a match) → confirm → save. Then it's loggable like any food
   (`source='recipe'` in `food_logs`, which already supports `recipe_id`).

**Guardrails / failure modes:** never let the model output kcal/macros; always show matched
ingredient + confidence per line; flag unmatched lines instead of silently dropping;
cooked vs raw (use the food's cooked state when the recipe implies cooking).

**Prereqs for Phase 4 (need user/data access — see §5):**
- `ANTHROPIC_API_KEY` set as a Supabase **secret**, and the edge fn **deployed**
  (`supabase functions deploy parse-recipe`). The existing `parse-schedule-order` +
  `generate-recipes` functions also need deploying — confirm what's actually live.

---

## 4. Post-Phase-4 roadmap (priority order)

1. **Recipe→log integration polish** — log a saved recipe (1 serving) directly from search.
2. **measures v4 (state-aware)** — use `ingredient_states.yield_factor` so "1 katori cooked
   rice" resolves to the cooked weight, not raw. Add OFF `serving_size`/`serving_quantity` and
   curated Indian-dish portions (idli/dosa/katori).
3. ~~**Search whole-food signal**~~ ✅ DONE — `search_foods` ranking **v3** (migration
   `20260531060000`, applied live). Head-noun match (last query token) so "basmati rice"
   reaches plain rice; canonical-head boost ("Head, qualifier" comma form = the food itself,
   beats false-friends like "Chicken mushroom"/"Milk fish"); whole-food (unbranded non-OFF)
   boost; composite "with" penalty. Also fixed a latent perf bug (per-candidate LATERAL over
   ingredient_resolved → ~12s for "chicken"); now resolved set-based, ~250ms for any term.
4. **OFF curated load** — replace the 3k arbitrary slice with India-tagged + popularity-ranked
   products (download the 7.5GB parquet locally; needs Supabase Pro for volume). Tooling ready:
   `pipeline/ingest_off.py`.
5. **Offline-first logging** — queue `food_logs` locally + sync (mirror the tracker_states
   debounced-sync pattern).
6. **Reports/trends** — daily/weekly intake vs targets, macro trends (extend ReportsTab).
7. **Test users** — seed user1–5 (see `docs/test-user-seed-spec.md`; use the SQL/admin path).
8. **measures v5 (personalized)** — learn a user's typical "1 bowl" from their `food_logs`.
9. **Nav density** — bottom nav is 8 items; consider a "more" overflow or a log FAB.

---

## 5. What I'll need from you (data/access) to run Phase 4

1. **Working `pipeline/.db_url`** (session-pooler URI). Reset the password first; the file is
   gitignored. Without it I can inspect/seed nothing.
2. **`ANTHROPIC_API_KEY`** — set it as a Supabase secret (`supabase secrets set ANTHROPIC_API_KEY=…`)
   so the edge functions can call Claude. Tell me if it's already set.
3. **Decision: deploy edge functions?** `parse-schedule-order` and the new `parse-recipe` need
   `supabase functions deploy …`. Confirm the CLI is still logged in (`supabase projects list`),
   or provide the **service_role key** if you'd rather I drive via API. Until deployed, Phase 4's
   LLM step can be dev-tested with a local node script + an API key, but production needs the
   function live.
4. **Supabase plan** — free tier (500MB) is fine for Phase 4 itself; only the *full* OFF curated
   load (roadmap #4) needs **Pro (~$25/mo)**. No action now.
5. **Country/locale source** — search currently hardcodes `country="india"` in `LogTab`. If you
   want per-user locale, point me at where user profile/country should live (state vs a new field).

**Housekeeping from this session:** test user `verify@reintro.app` was deleted; preview dev
server may still be on :5200; `pg` + `pipeline/.venv` are gitignored local installs.

**Phase 4 session update (built):** prereqs were all already in place — `pipeline/.db_url`
works, `ANTHROPIC_API_KEY` is a live Supabase secret, the CLI is logged in/linked. To verify
end-to-end I **recreated** test user `verify@reintro.app` (same uid, password stored in the
team password manager / `RT_PASSWORD` env var — not committed,
email-confirmed via direct `auth.users`/`auth.identities` insert; remember GoTrue needs the
`*_token`/`email_change`/`phone_change` columns set to `''` not NULL or `getUser` 500s). That
user is **left active** so you can keep testing in the preview — delete it when done. Added
`pipeline/q.mjs` (tiny `node pg` query helper that reads `.db_url`). Country still hardcoded
`india` in LogTab (roadmap: per-user locale). Pre-existing lint debt: LogTab's search-debounce
`useEffect` trips `react-hooks/set-state-in-effect` (not Phase 4 code).

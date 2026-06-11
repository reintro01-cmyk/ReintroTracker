-- Phase 0 — Ingredient-first nutrition database.
--
-- Model: canonical ingredients → states (raw/cooked) → nutrient values (per source,
-- versioned) ; household measures ; recipes whose line items map to ingredient states ;
-- computed recipe nutrition with a cross-check against any source-stated values.
--
-- Design rules baked in:
--   * Values live per 100g EDIBLE portion, attached to a STATE not a bare ingredient,
--     because cooking changes both weight (yield_factor) and composition.
--   * Every datum carries source + provenance + confidence + version, so "swap to
--     officially-licensed IFCT later" is a data update, not a rebuild.
--   * Recipes store ingredient refs + quantities, never hardcoded macros — computed
--     values cannot drift from their inputs.

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ─── sources: provenance for every datum (ingredient values AND recipes) ─────────
create table if not exists sources (
  id           text primary key,   -- 'IFCT-2017', 'USDA-SR', 'USDA-FNDF', 'AMURA', 'GENERATED', 'USER'
  name         text not null,
  description  text,
  license      text,
  url          text,
  retrieved_at date,
  notes        text
);

-- ─── ingredients: canonical food entities (one row per real-world ingredient) ────
create table if not exists ingredients (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,        -- 'ragi', 'moong-dal', 'coconut-oil-virgin'
  canonical_name  text not null,
  category        text,                         -- food group; open vocabulary
  scientific_name text,
  aliases         text[] not null default '{}',-- search / fuzzy-match synonyms
  local_names     jsonb,                        -- {"hi":"...","ta":"..."} from IFCT
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ingredients_name_trgm  on ingredients using gin (canonical_name gin_trgm_ops);
create index if not exists ingredients_aliases_gin on ingredients using gin (aliases);
create index if not exists ingredients_category    on ingredients (category);

-- ─── ingredient_states: the form an ingredient is consumed in ────────────────────
create table if not exists ingredient_states (
  id              uuid primary key default gen_random_uuid(),
  ingredient_id   uuid not null references ingredients(id) on delete cascade,
  state           text not null default 'raw', -- raw|boiled|steamed|fried|roasted|brewed|soaked|dried
  yield_factor    numeric,                      -- cooked_weight / raw_weight; null|1 = as-is
  parent_state_id uuid references ingredient_states(id),
  notes           text,
  unique (ingredient_id, state)
);
create index if not exists ingredient_states_ingredient on ingredient_states (ingredient_id);
comment on column ingredient_states.yield_factor is
  'Weight multiplier from raw to this state (rice ~2.5 after boiling, spinach ~0.3). Used by the recipe calculator.';

-- ─── nutrient_values: macro (+ extended) composition, the heart of the DB ────────
create table if not exists nutrient_values (
  id                  uuid primary key default gen_random_uuid(),
  ingredient_state_id uuid not null references ingredient_states(id) on delete cascade,
  source_id           text not null references sources(id),
  source_food_code    text,                     -- IFCT 'A010', USDA fdc_id
  basis               text not null default 'per_100g' check (basis in ('per_100g','per_100ml')),
  energy_kcal         numeric,
  energy_kj           numeric,
  protein_g           numeric,
  fat_g               numeric,
  carb_avail_g        numeric,                  -- available carbohydrate by difference (excludes fibre)
  fibre_g             numeric,
  water_g             numeric,
  extended            jsonb,                    -- full micronutrient set (IFCT ~145 cols) as {code: value}
  uncertainty         jsonb,                    -- {nutrient_code: ± value} from IFCT _e columns
  provenance          text not null default 'measured' check (provenance in ('measured','computed','user')),
  confidence          text not null default 'medium' check (confidence in ('high','medium','low')),
  version             int  not null default 1,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (ingredient_state_id, source_id, version)
);
create index if not exists nutrient_values_state  on nutrient_values (ingredient_state_id);
create index if not exists nutrient_values_source on nutrient_values (source_id);
comment on column nutrient_values.carb_avail_g is
  'Available carbohydrate by difference (IFCT choavldf). Excludes dietary fibre, stored separately in fibre_g.';
comment on column nutrient_values.confidence is
  'Drives UI disclaimers and the IFCT-upgrade queue. low = e.g. computed millet/composite pending licensed data.';

-- ─── measures: household unit → grams, per ingredient ────────────────────────────
create table if not exists measures (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  label         text not null,                -- '1 tbsp', '1 cup', '1 medium', '1 katori'
  unit          text,                          -- tbsp|tsp|cup|piece|ml|g|katori|ladle
  grams         numeric not null,
  is_default    boolean not null default false,
  source_id     text references sources(id),
  notes         text
);
create index if not exists measures_ingredient on measures (ingredient_id);

-- ─── recipes: curated dishes (Amura facts-derived, generated, or user) ───────────
create table if not exists recipes (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  tagline             text,
  method              text,                    -- our own wording, NOT copied source prose
  servings            numeric not null default 1,
  prep_mins           int,
  phase               text check (phase in ('pre','detox','reintro','both','any')),
  slot                text,                     -- 'fat'|'protein'|'vegcarb'|'fibre' (matches app)
  required_safe_foods text[] not null default '{}',
  image_url           text,
  source_id           text references sources(id),
  source_ref          text,                     -- internal audit only (e.g. original card id); never shown
  status              text not null default 'draft' check (status in ('draft','verified','published','rejected')),
  created_by          uuid,                     -- auth.users id for user recipes; null for curated
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists recipes_status on recipes (status);
create index if not exists recipes_phase  on recipes (phase);

-- ─── recipe_ingredients: line items, mapped (or pending) to an ingredient state ──
create table if not exists recipe_ingredients (
  id                  uuid primary key default gen_random_uuid(),
  recipe_id           uuid not null references recipes(id) on delete cascade,
  ingredient_state_id uuid references ingredient_states(id),  -- null until matched
  raw_text            text not null,           -- original parsed text, e.g. 'Ragi powder'
  qty                 numeric,
  unit                text,                     -- 'g','ml','cup','tbsp','tsp','no'
  grams_resolved      numeric,                  -- after measure conversion
  match_confidence    text check (match_confidence in ('high','medium','low','unmatched')),
  optional            boolean not null default false,
  position            int,
  notes               text
);
create index if not exists recipe_ingredients_recipe on recipe_ingredients (recipe_id);
create index if not exists recipe_ingredients_state  on recipe_ingredients (ingredient_state_id);

-- ─── recipe_nutrition: computed totals + cross-check vs source-stated values ─────
create table if not exists recipe_nutrition (
  recipe_id        uuid not null references recipes(id) on delete cascade,
  per              text not null default 'serving' check (per in ('serving','recipe','per_100g')),
  energy_kcal      numeric,
  protein_g        numeric,
  fat_g            numeric,
  carb_avail_g     numeric,
  fibre_g          numeric,
  error_pct        numeric,                    -- propagated ± from ingredient uncertainty
  stated_kcal      numeric,                    -- source's own value (e.g. Amura card), for QA only
  stated_protein_g numeric,
  stated_fat_g     numeric,
  stated_carb_g    numeric,
  variance_pct     numeric,                    -- |computed - stated| / stated, on kcal
  flags            text[] not null default '{}',-- 'atwater_fail','unmatched_ingredients','variance_high'
  method_version   text,                        -- FAO/INFOODS calc version
  computed_at      timestamptz not null default now(),
  primary key (recipe_id, per)
);

-- ─── updated_at maintenance ──────────────────────────────────────────────────────
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists trg_ingredients_updated on ingredients;
create trigger trg_ingredients_updated before update on ingredients     for each row execute function set_updated_at();
drop trigger if exists trg_nutrient_updated on nutrient_values;
create trigger trg_nutrient_updated     before update on nutrient_values for each row execute function set_updated_at();
drop trigger if exists trg_recipes_updated on recipes;
create trigger trg_recipes_updated      before update on recipes         for each row execute function set_updated_at();

-- ─── RLS: reference data is public-read; writes via service role (bypasses RLS) ──
-- User-recipe write policies arrive in a later migration when that feature lands.
alter table sources            enable row level security;
alter table ingredients        enable row level security;
alter table ingredient_states  enable row level security;
alter table nutrient_values    enable row level security;
alter table measures           enable row level security;
alter table recipes            enable row level security;
alter table recipe_ingredients enable row level security;
alter table recipe_nutrition   enable row level security;

create policy "public read" on sources            for select using (true);
create policy "public read" on ingredients        for select using (true);
create policy "public read" on ingredient_states  for select using (true);
create policy "public read" on nutrient_values    for select using (true);
create policy "public read" on measures           for select using (true);
create policy "public read published" on recipes  for select using (status = 'published');
create policy "public read published" on recipe_ingredients for select
  using (exists (select 1 from recipes r where r.id = recipe_id and r.status = 'published'));
create policy "public read published" on recipe_nutrition for select
  using (exists (select 1 from recipes r where r.id = recipe_id and r.status = 'published'));

-- ─── seed the known sources so foreign keys are usable immediately ───────────────
insert into sources (id, name, description, license, url, retrieved_at) values
  ('IFCT-2017','Indian Food Composition Tables 2017','528 key Indian foods (ICMR-NIN); ingested via @ifct2017/compositions','MIT compilation; underlying facts ICMR-NIN','https://ifct2017.github.io','2026-05-28'),
  ('USDA-SR','USDA SR Legacy','Standard Reference Legacy generic foods','Public Domain','https://fdc.nal.usda.gov','2026-05-28'),
  ('USDA-FNDF','USDA Foundation Foods','Foundation Foods — detailed generic ingredients','Public Domain','https://fdc.nal.usda.gov','2026-05-28'),
  ('AMURA','Amura recipe cards (facts-derived)','Ingredient facts only; nutrition recomputed; method rewritten; no source prose/branding reused','Facts only','https://amura.ai/diet','2026-05-28'),
  ('GENERATED','In-app recipe generator','LLM-composed recipes; macros computed from ingredient tables, never invented',null,null,'2026-05-28'),
  ('USER','User-added','User-entered recipes/foods; values may vary',null,null,'2026-05-28')
on conflict (id) do nothing;

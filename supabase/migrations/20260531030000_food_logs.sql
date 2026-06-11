-- Food logging: per-user log entries + a small household-unit lookup.
--
-- Logging is stored in GRAMS as the source of truth (nutrition is per-100g, so
-- grams -> macros is exact). Household units (tsp/katori/cup/...) are gram-entry
-- shortcuts via unit_defaults; the UI prefills grams = qty * default and the user
-- can override. Macros are SNAPSHOTTED at log time so later DB edits never rewrite
-- a user's history.

-- ── unit_defaults: approximate grams per 1 household unit (UI shortcuts) ──────────
create table if not exists unit_defaults (
  unit       text primary key,
  grams      numeric not null,
  is_volume  boolean not null default false,
  note       text
);

insert into unit_defaults (unit, grams, is_volume, note) values
  ('g',        1,   false, 'grams — exact'),
  ('ml',       1,   true,  'millilitres — ~1g for water-like'),
  ('tsp',      5,   true,  'teaspoon'),
  ('tbsp',     15,  true,  'tablespoon'),
  ('cup',      240, true,  'approx; solids vary'),
  ('katori',   150, false, 'small Indian bowl, cooked'),
  ('bowl',     200, false, 'approx'),
  ('glass',    200, true,  'approx'),
  ('piece',    50,  false, 'very approx — edit grams'),
  ('slice',    30,  false, 'approx'),
  ('handful',  30,  false, 'approx'),
  ('plate',    300, false, 'approx full plate')
on conflict (unit) do nothing;

alter table unit_defaults enable row level security;
create policy "public read" on unit_defaults for select using (true);

-- ── food_logs: one row per logged item ───────────────────────────────────────────
create table if not exists food_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  logged_at     timestamptz not null default now(),
  log_date      date not null default current_date,   -- the user's day for grouping
  source        text not null default 'ingredient' check (source in ('ingredient','recipe','custom')),
  ingredient_id uuid references ingredients(id),
  recipe_id     uuid references recipes(id),
  custom_name   text,                                  -- label fallback (custom / display)
  meal          text,                                  -- breakfast|lunch|dinner|snack (free text)
  qty           numeric not null,
  unit          text not null default 'g',
  grams         numeric,                               -- resolved grams (qty * unit grams)
  -- macro snapshot at log time (computed from grams * per-100g / 100)
  kcal          numeric,
  protein_g     numeric,
  fat_g         numeric,
  carb_g        numeric,
  fibre_g       numeric,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists food_logs_user_date on food_logs (user_id, log_date);

alter table food_logs enable row level security;
create policy "own logs select" on food_logs for select using (auth.uid() = user_id);
create policy "own logs insert" on food_logs for insert with check (auth.uid() = user_id);
create policy "own logs update" on food_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own logs delete" on food_logs for delete using (auth.uid() = user_id);

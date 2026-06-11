-- Community recipe base — a cross-user "dynamic recipe list" grown from what people log.
--
-- When a user logs a named dish via the free-text Log flow (matched to the food DB or
-- entered manually), the client upserts a {signature, name, macros} row here. Once enough
-- DISTINCT users have logged the same dish, it surfaces as a consensus recipe to everyone.
--
-- Privacy boundary: every policy is scoped to auth.uid() = created_by, so a client can only
-- ever read/write its OWN rows — never another user's entries. Cross-user consensus is exposed
-- ONLY through the SECURITY DEFINER aggregation function below, which returns medians for dishes
-- that clear a distinct-user threshold — never an individual's row. Only a dish name + macros
-- are stored. (The own-row select policy is also what lets the upsert return its representation.)

create table if not exists community_entries (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references auth.users(id) on delete cascade,
  signature   text not null,                 -- normalized dish name (client-computed), the merge key
  name        text not null,                 -- display name, as the user typed it
  kcal        numeric,
  protein_g   numeric,
  fat_g       numeric,
  carb_g      numeric,
  fibre_g     numeric,
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

-- One row per (user, dish): re-logging the same dish refreshes that user's latest macros and
-- keeps count(distinct created_by) an honest "how many people make this" signal.
create unique index if not exists community_entries_user_sig on community_entries (created_by, signature);
-- Aggregation groups + thresholds by signature.
create index if not exists community_entries_sig on community_entries (signature);

drop trigger if exists trg_community_entries_updated on community_entries;
create trigger trg_community_entries_updated before update on community_entries
  for each row execute function set_updated_at();

alter table community_entries enable row level security;

-- Own-row read only. Other users' rows stay invisible; cross-user data is reachable solely via
-- get_community_recipes() below. This policy also satisfies the upsert's return=representation.
drop policy if exists "own community select" on community_entries;
create policy "own community select" on community_entries
  for select using (auth.uid() = created_by);

drop policy if exists "own community insert" on community_entries;
create policy "own community insert" on community_entries
  for insert with check (auth.uid() = created_by);

drop policy if exists "own community update" on community_entries;
create policy "own community update" on community_entries
  for update using (auth.uid() = created_by) with check (auth.uid() = created_by);

drop policy if exists "own community delete" on community_entries;
create policy "own community delete" on community_entries
  for delete using (auth.uid() = created_by);

grant select, insert, update, delete on community_entries to authenticated;

-- ── Consensus aggregation ─────────────────────────────────────────────────────────
-- SECURITY DEFINER so it can read across users despite the table having no select policy.
-- Median (percentile_cont 0.5) is used over the mean so a single outlier entry can't skew a
-- dish's macros. A dish only appears once >= min_users distinct users have logged it.
create or replace function get_community_recipes(min_users int default 3)
returns table (
  signature  text,
  name       text,
  users      bigint,
  kcal       numeric,
  protein_g  numeric,
  fat_g      numeric,
  carb_g     numeric,
  fibre_g    numeric
)
language sql
security definer
set search_path = public
as $$
  select
    e.signature,
    mode() within group (order by e.name)                                            as name,
    count(distinct e.created_by)                                                     as users,
    round(percentile_cont(0.5) within group (order by e.kcal::double precision)::numeric, 0)      as kcal,
    round(percentile_cont(0.5) within group (order by e.protein_g::double precision)::numeric, 1) as protein_g,
    round(percentile_cont(0.5) within group (order by e.fat_g::double precision)::numeric, 1)     as fat_g,
    round(percentile_cont(0.5) within group (order by e.carb_g::double precision)::numeric, 1)    as carb_g,
    round(percentile_cont(0.5) within group (order by e.fibre_g::double precision)::numeric, 1)   as fibre_g
  from community_entries e
  where e.kcal is not null
  group by e.signature
  having count(distinct e.created_by) >= greatest(min_users, 1)
  order by count(distinct e.created_by) desc, name asc;
$$;

grant execute on function get_community_recipes(int) to authenticated, anon;

-- Rollback:
--   drop function if exists get_community_recipes(int);
--   drop table if exists community_entries;

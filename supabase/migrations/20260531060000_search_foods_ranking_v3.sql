-- search_foods ranking v3: a real "whole-food signal" so plain ingredients beat branded
-- dupes, composite dishes, and false-friend compounds.
--
-- Failure modes v2 still had (verified on live data):
--   "chicken"      -> "Chicken mushroom, fresh" ranked above real chicken cuts
--   "milk"         -> "Milk fish" ranked above "Milk, whole, Cow"
--   "rice"         -> "Rice flakes/puffed" edged out "Rice, raw, milled"
--   "basmati rice" -> only branded OFF rows; plain rice wasn't even a candidate
--
-- v3 adds on top of v2:
--   + head-noun match    — match/boost on the LAST query token so multi-word queries reach
--                          the staple ("basmati rice" -> "Rice, ..."). Plain rice now a candidate.
--   + canonical-head boost — IFCT/USDA name the food itself as "Head, qualifier" (comma after the
--                          head word). "Chicken, poultry, breast" gets it; "Chicken mushroom" and
--                          "Milk fish" do NOT. This is the core whole-food signal.
--   + whole-food boost   — unbranded, non-OFF rows (the curated whole-food DBs) over branded.
--   − composite penalty  — names containing "with" are dishes, not ingredients.
--
-- Also fixes a latent PERF bug carried from v1/v2: nutrition was resolved with a per-candidate
-- LATERAL over the ingredient_resolved view, which re-scanned all nutrient_values for every
-- candidate (fine for rare words, ~12s for "chicken" with 500+ candidates). v3 resolves the
-- whole candidate set once, set-based, via a single DISTINCT ON.

create or replace function search_foods(q text, country text default null, lim int default 20)
returns table (
  ingredient_id uuid, name text, brand text, barcode text, category text,
  source_id text, confidence text,
  kcal numeric, protein_g numeric, fat_g numeric, carb_g numeric, fibre_g numeric,
  score real
)
language sql stable
as $$
  with qn as (
    select lower(trim(q)) as q,
           (regexp_match(lower(trim(q)), '^[a-z0-9]+'))[1]        as q1,
           (regexp_match(lower(trim(q)), '([a-z0-9]+)\s*$'))[1]   as q_last
  ),
  cand as (
    select
      i.id, i.canonical_name as name, i.brand, i.barcode, i.category,
      greatest(
        case
          when lower(i.canonical_name) = (select q from qn) then 1.0
          when (select q from qn) = any (select lower(a) from unnest(i.aliases) a) then 0.95
          when lower(i.canonical_name) like (select q from qn) || '%' then 0.9
          else 0
        end,
        similarity(i.canonical_name, (select q from qn)),
        coalesce(similarity(i.brand, (select q from qn)), 0) * 0.6
      )::real as base
    from ingredients i, qn
    where i.canonical_name % qn.q
       or lower(i.canonical_name) like '%' || qn.q || '%'
       or i.canonical_name % qn.q_last                                  -- head-noun reach (multi-word)
       or qn.q = any (select lower(a) from unnest(i.aliases) a)
       or (i.brand is not null and i.brand % qn.q)
  ),
  -- Resolve best nutrition per candidate ingredient ONCE (source-priority), set-based.
  resolved as (
    select distinct on (ist.ingredient_id)
      ist.ingredient_id,
      nv.source_id, nv.confidence,
      nv.energy_kcal, nv.protein_g, nv.fat_g, nv.carb_avail_g, nv.fibre_g
    from nutrient_values nv
    join ingredient_states ist on ist.id = nv.ingredient_state_id
    where ist.ingredient_id in (select id from cand)
    order by ist.ingredient_id,
      case nv.source_id
        when 'IFCT-2017' then 1 when 'USDA-FNDF' then 2 when 'USDA-SR' then 3
        when 'AMURA' then 4 when 'GENERATED' then 5 when 'OFF' then 5 else 6 end,
      nv.version desc,
      case nv.confidence when 'high' then 1 when 'medium' then 2 else 3 end
  ),
  scored as (
    select
      c.id, c.name, c.brand, c.barcode, c.category,
      ir.source_id, ir.confidence,
      ir.energy_kcal, ir.protein_g, ir.fat_g, ir.carb_avail_g, ir.fibre_g,
      (c.base
        -- query's first word matches the name's leading word
        + case when (regexp_match(lower(c.name), '[a-z0-9]+'))[1] = (select q1 from qn) then 0.30 else 0 end
        -- multi-word: name's leading word matches the query's HEAD noun (last token)
        + case when (select q_last from qn) is distinct from (select q1 from qn)
                and (regexp_match(lower(c.name), '[a-z0-9]+'))[1] = (select q_last from qn) then 0.30 else 0 end
        -- canonical-head form "Head, qualifier ..." = the food itself (the whole-food signal)
        + case when c.name ~* ('^' || (select q1 from qn) || '\s*,')
                or c.name ~* ('^' || (select q_last from qn) || '\s*,') then 0.20 else 0 end
        -- whole, unbranded food from the curated DBs (not a branded OFF product)
        + case when c.brand is null and ir.source_id is distinct from 'OFF' then 0.12 else 0 end
        -- composite dish, not a single ingredient
        + case when c.name ~* '\mwith\M' then -0.15 else 0 end
        -- byproduct/derivative the user didn't ask for
        + case when c.name ~* '\m(oil|fat|fats|bran|rind|tallow|lard|byproduct)\M'
                and (select q from qn) !~ '\m(oil|fat|bran|lard)\M' then -0.20 else 0 end
        -- heavily processed forms nudged below plain ones
        + case when c.name ~* '\m(breaded|battered|fried|nugget|nuggets|tenders)\M' then -0.10 else 0 end
        -- simpler (shorter) names win ties
        - length(c.name) * 0.0015
        -- locale boost
        + case
            when country is null then 0
            when lower(country) in ('in','india') and ir.source_id = 'IFCT-2017' then 0.15
            when lower(country) in ('us','usa','united states') and ir.source_id like 'USDA%' then 0.10
            else 0
          end
        -- generic over branded on bare terms
        + case when ir.source_id is distinct from 'OFF' then 0.05 else 0 end
      )::real as score
    from cand c
    left join resolved ir on ir.ingredient_id = c.id
  ),
  deduped as (
    select distinct on (lower(name), lower(coalesce(brand, ''))) *
    from scored
    order by lower(name), lower(coalesce(brand, '')), score desc
  )
  select ingredient_id, name, brand, barcode, category, source_id, confidence,
         energy_kcal, protein_g, fat_g, carb_avail_g, fibre_g, score
  from (
    select id as ingredient_id, name, brand, barcode, category, source_id, confidence,
           energy_kcal, protein_g, fat_g, carb_avail_g, fibre_g, score
    from deduped
  ) d
  order by score desc, name
  limit greatest(1, least(lim, 50));
$$;

grant execute on function search_foods(text, text, int) to anon, authenticated;

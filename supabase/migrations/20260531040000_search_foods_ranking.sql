-- search_foods ranking v2: surface the "basic" food, not a byproduct or branded dupe.
--
-- Adds on top of v1's exact/alias/prefix/trigram base + country boost:
--   + first-token boost   — query matches the name's leading word ("chicken" → "Chicken, …"
--                           ranks above "Fat, chicken")
--   − byproduct penalty   — name has oil/fat/bran/etc. but the query didn't ask ("rice" →
--                           "Rice, raw, milled" beats "Rice bran oil")
--   − processed penalty   — breaded/fried/nuggets/… nudged down so plain cuts win
--   − brevity nudge       — shorter (simpler) names edge out long qualified ones on ties
--   + dedup               — collapse identical (name, brand) rows (OFF near-duplicates)

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
    select lower(trim(q)) as q, (regexp_match(lower(trim(q)), '[a-z0-9]+'))[1] as q1
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
       or qn.q = any (select lower(a) from unnest(i.aliases) a)
       or (i.brand is not null and i.brand % qn.q)
  ),
  scored as (
    select
      c.id, c.name, c.brand, c.barcode, c.category,
      ir.source_id, ir.confidence,
      ir.energy_kcal, ir.protein_g, ir.fat_g, ir.carb_avail_g, ir.fibre_g,
      (c.base
        -- query matches the name's leading word
        + case when (regexp_match(lower(c.name), '[a-z0-9]+'))[1] = (select q1 from qn) then 0.30 else 0 end
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
    left join lateral (
      select r.* from ingredient_resolved r where r.ingredient_id = c.id
      order by case r.source_id
                 when 'IFCT-2017' then 1 when 'USDA-FNDF' then 2 when 'USDA-SR' then 3
                 when 'OFF' then 5 else 6 end
      limit 1
    ) ir on true
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

-- Typo-tolerant, country-aware food search.
--
-- Runs in-DB (pg_trgm) so the client just calls supabase.rpc('search_foods', {...}).
-- Ranking, high → low:
--   exact name (1.0) > exact alias (0.95) > prefix (0.9) > trigram similarity(name)
--   then a small country boost (IFCT for India, USDA for US/Western) and a small
--   generic-over-branded nudge so whole foods beat random branded items on bare terms.
-- Reads only public-read reference tables, so it's safe to expose to anon.

create or replace function search_foods(q text, country text default null, lim int default 20)
returns table (
  ingredient_id uuid, name text, brand text, barcode text, category text,
  source_id text, confidence text,
  kcal numeric, protein_g numeric, fat_g numeric, carb_g numeric, fibre_g numeric,
  score real
)
language sql stable
as $$
  with qn as (select lower(trim(q)) as q),
  cand as (
    select
      i.id, i.canonical_name as name, i.brand, i.barcode, i.category, i.aliases,
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
        + case
            when country is null then 0
            when lower(country) in ('in','india') and ir.source_id = 'IFCT-2017' then 0.15
            when lower(country) in ('us','usa','united states') and ir.source_id like 'USDA%' then 0.10
            else 0
          end
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
  )
  select id, name, brand, barcode, category, source_id, confidence,
         energy_kcal, protein_g, fat_g, carb_avail_g, fibre_g, score
  from scored
  order by score desc, name
  limit greatest(1, least(lim, 50));
$$;

grant execute on function search_foods(text, text, int) to anon, authenticated;

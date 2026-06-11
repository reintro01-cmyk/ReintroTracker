-- search_foods v4: Indian-name synonyms + drop nutrition-less rows.
--
-- On top of v3 (whole-food signal, set-based resolve):
--   + synonym expansion (ADDITIVE) — if the query is a known Indian/colloquial alias
--     (food_synonyms), match BOTH the original term and its English canonical. Additive so a
--     direct name match ("Bajra") is never lost, while "curd"/"palak"/"dahi" now surface the
--     right whole food (yogurt/spinach). Ranking still prefers the canonical whole food.
--   − exclude nutrition-less rows — after the energy backfill, the few rows with no energy AND
--     no macros are useless to log; drop them so they stop polluting results.

create or replace function search_foods(q text, country text default null, lim int default 20)
returns table (
  ingredient_id uuid, name text, brand text, barcode text, category text,
  source_id text, confidence text,
  kcal numeric, protein_g numeric, fat_g numeric, carb_g numeric, fibre_g numeric,
  score real
)
language sql stable
as $$
  with raw as (
    select lower(trim(q)) as q_orig
  ),
  qn as (
    select
      r.q_orig,
      coalesce(fs.canonical, r.q_orig) as q,                      -- effective query (canonical if alias)
      (regexp_match(coalesce(fs.canonical, r.q_orig), '^[a-z0-9]+'))[1]      as q1,
      (regexp_match(coalesce(fs.canonical, r.q_orig), '([a-z0-9]+)\s*$'))[1] as q_last
    from raw r
    left join food_synonyms fs on fs.alias = r.q_orig
  ),
  cand as (
    select
      i.id, i.canonical_name as name, i.brand, i.barcode, i.category,
      greatest(
        case
          when lower(i.canonical_name) = (select q from qn) then 1.0
          when lower(i.canonical_name) = (select q_orig from qn) then 1.0
          when (select q from qn) = any (select lower(a) from unnest(i.aliases) a) then 0.95
          when lower(i.canonical_name) like (select q from qn) || '%' then 0.9
          when lower(i.canonical_name) like (select q_orig from qn) || '%' then 0.9
          else 0
        end,
        similarity(i.canonical_name, (select q from qn)),
        similarity(i.canonical_name, (select q_orig from qn)),
        coalesce(similarity(i.brand, (select q_orig from qn)), 0) * 0.6
      )::real as base
    from ingredients i, qn
    where i.canonical_name % qn.q
       or i.canonical_name % qn.q_orig
       or lower(i.canonical_name) like '%' || qn.q || '%'
       or lower(i.canonical_name) like '%' || qn.q_orig || '%'
       or i.canonical_name % qn.q_last
       or qn.q = any (select lower(a) from unnest(i.aliases) a)
       or (i.brand is not null and i.brand % qn.q_orig)
  ),
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
        + case when (regexp_match(lower(c.name), '[a-z0-9]+'))[1] = (select q1 from qn) then 0.30 else 0 end
        + case when (select q_last from qn) is distinct from (select q1 from qn)
                and (regexp_match(lower(c.name), '[a-z0-9]+'))[1] = (select q_last from qn) then 0.30 else 0 end
        + case when c.name ~* ('^' || (select q1 from qn) || '\s*,')
                or c.name ~* ('^' || (select q_last from qn) || '\s*,') then 0.20 else 0 end
        + case when c.brand is null and ir.source_id is distinct from 'OFF' then 0.12 else 0 end
        + case when c.name ~* '\mwith\M' then -0.15 else 0 end
        + case when c.name ~* '\m(oil|fat|fats|bran|rind|tallow|lard|byproduct)\M'
                and (select q from qn) !~ '\m(oil|fat|bran|lard)\M' then -0.20 else 0 end
        + case when c.name ~* '\m(breaded|battered|fried|nugget|nuggets|tenders)\M' then -0.10 else 0 end
        - length(c.name) * 0.0015
        + case
            when country is null then 0
            when lower(country) in ('in','india') and ir.source_id = 'IFCT-2017' then 0.15
            when lower(country) in ('us','usa','united states') and ir.source_id like 'USDA%' then 0.10
            else 0
          end
        + case when ir.source_id is distinct from 'OFF' then 0.05 else 0 end
      )::real as score
    from cand c
    left join resolved ir on ir.ingredient_id = c.id
  ),
  deduped as (
    select distinct on (lower(name), lower(coalesce(brand, ''))) *
    from scored
    -- drop rows with no usable nutrition at all (energy + every macro empty)
    where coalesce(energy_kcal,0) + coalesce(protein_g,0) + coalesce(fat_g,0) + coalesce(carb_avail_g,0) > 0
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

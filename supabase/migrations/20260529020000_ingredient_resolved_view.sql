-- Source-priority resolution view.
--
-- IFCT and USDA are loaded as parallel catalogs (each food is its own ingredient row).
-- This view flattens ingredient -> state -> nutrient_values into one per-100g row per
-- ingredient_state, and — where a state ever carries values from multiple sources or
-- versions — picks the canonical one by priority: IFCT (Indian-accurate) > USDA Foundation
-- > USDA SR Legacy > AMURA > GENERATED > USER, then newest version, then best confidence.
--
-- The app and the recipe generator read THIS, never the raw 3-table join.

create or replace view ingredient_resolved as
select distinct on (nv.ingredient_state_id)
  i.id            as ingredient_id,
  i.slug,
  i.canonical_name,
  i.category,
  ist.id          as ingredient_state_id,
  ist.state,
  nv.source_id,
  nv.energy_kcal,
  nv.protein_g,
  nv.fat_g,
  nv.carb_avail_g,
  nv.fibre_g,
  nv.confidence,
  nv.uncertainty
from nutrient_values nv
join ingredient_states ist on ist.id = nv.ingredient_state_id
join ingredients i        on i.id  = ist.ingredient_id
order by
  nv.ingredient_state_id,
  case nv.source_id
    when 'IFCT-2017' then 1
    when 'USDA-FNDF' then 2
    when 'USDA-SR'   then 3
    when 'AMURA'     then 4
    when 'GENERATED' then 5
    else 6 end,
  nv.version desc,
  case nv.confidence when 'high' then 1 when 'medium' then 2 else 3 end;

comment on view ingredient_resolved is
  'One canonical per-100g nutrient row per ingredient_state, chosen by source priority '
  '(IFCT>USDA>...), version, then confidence. The read surface for app + generator.';

-- Post-load verification. Run via: psql "$SUPABASE_DB_URL" -f pipeline/verify.sql

\echo '== 1. Row counts (expect ~8.8k ingredients, 725 recipes) =='
select 'sources'            as table, count(*) from sources
union all select 'ingredients',        count(*) from ingredients
union all select 'ingredient_states',  count(*) from ingredient_states
union all select 'nutrient_values',    count(*) from nutrient_values
union all select 'measures',           count(*) from measures
union all select 'recipes',             count(*) from recipes
union all select 'recipe_ingredients', count(*) from recipe_ingredients
union all select 'recipe_nutrition',   count(*) from recipe_nutrition
order by 1;

\echo ''
\echo '== 2. nutrient_values by source (IFCT 542, USDA-SR ~7.8k, USDA-FNDF ~469) =='
select source_id, count(*) from nutrient_values group by 1 order by 2 desc;

\echo ''
\echo '== 3. ingredient_resolved sanity — Indian staples should resolve to IFCT =='
select canonical_name, source_id, energy_kcal, protein_g, fat_g, carb_avail_g, fibre_g, confidence
from ingredient_resolved
where lower(canonical_name) in
  ('ragi','green gram, dal','ghee','rice, raw, milled','bengal gram, dal','butter, salted')
order by canonical_name;

\echo ''
\echo '== 4. Oils — energy should be ~900 kcal and confidence medium (derived) =='
select canonical_name, energy_kcal, fat_g, confidence
from ingredient_resolved
where lower(canonical_name) like '%oil%' and fat_g > 90
order by canonical_name limit 8;

\echo ''
\echo '== 5. Recipe status split (expect ~625 draft / ~100 rejected) =='
select status, count(*) from recipes group by 1 order by 2 desc;

\echo ''
\echo '== 6. Atwater gate — flagged vs clean recipe_nutrition =='
select count(*) filter (where flags <> '{}') as flagged,
       count(*) filter (where flags =  '{}') as clean,
       count(*) as total
from recipe_nutrition;

\echo ''
\echo '== 7. Sample DRAFT recipes with recomputed per-100g nutrition =='
select r.name, n.energy_kcal as kcal, n.protein_g as p, n.fat_g as f,
       n.carb_avail_g as c, n.fibre_g as fibre
from recipes r join recipe_nutrition n on n.recipe_id = r.id
where r.status = 'draft' and n.flags = '{}'
order by r.name limit 6;

\echo ''
\echo '== 8. recipe_ingredients FK link rate (how many lines resolved to an ingredient) =='
select round(100.0 * count(ingredient_state_id) / nullif(count(*),0), 1) as pct_linked,
       count(*) as total_lines
from recipe_ingredients;

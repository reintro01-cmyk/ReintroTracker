-- Backfill missing food energy. USDA Foundation Foods (334 of 469) and a handful of SR/OFF
-- rows were ingested with NULL/0 energy_kcal despite having macros, so they logged as 0 kcal
-- (e.g. "Cauliflower, raw", "Cheese, provolone, sliced", "Yogurt, plain, whole milk" all read 0).
-- Derive energy from kJ where present (exact), else Atwater general factors
-- (4·protein + 4·available-carb + 9·fat). Rows get provenance='computed' so the derived
-- energy is auditable / overridable later.

update nutrient_values
set energy_kcal = round((energy_kj / 4.184)::numeric, 1),
    provenance = 'computed'
where (energy_kcal is null or energy_kcal = 0) and energy_kj > 0;

update nutrient_values
set energy_kcal = round((4 * coalesce(protein_g, 0) + 4 * coalesce(carb_avail_g, 0) + 9 * coalesce(fat_g, 0))::numeric, 0),
    provenance = 'computed'
where (energy_kcal is null or energy_kcal = 0)
  and (energy_kj is null or energy_kj = 0)
  and coalesce(protein_g, 0) + coalesce(fat_g, 0) + coalesce(carb_avail_g, 0) > 0;

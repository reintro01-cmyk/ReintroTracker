-- Phase 4 — user-created (draft) recipes.
-- Lets an authenticated user build and own recipes parsed from free text. The existing
-- "public read published" policies are untouched, so the curated/published corpus stays
-- world-readable; these add owner-scoped full control over a user's OWN rows (drafts).
-- Policies are OR'd, so reading a published recipe still works via the public policy.

grant select, insert, update, delete on recipes, recipe_ingredients, recipe_nutrition to authenticated;

drop policy if exists "own recipes" on recipes;
create policy "own recipes" on recipes
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "own recipe ingredients" on recipe_ingredients;
create policy "own recipe ingredients" on recipe_ingredients
  for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.created_by = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_ingredients.recipe_id and r.created_by = auth.uid()));

drop policy if exists "own recipe nutrition" on recipe_nutrition;
create policy "own recipe nutrition" on recipe_nutrition
  for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_nutrition.recipe_id and r.created_by = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_nutrition.recipe_id and r.created_by = auth.uid()));

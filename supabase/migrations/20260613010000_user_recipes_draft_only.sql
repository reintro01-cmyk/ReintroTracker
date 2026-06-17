-- Harden user recipe ownership: authenticated users may only ever write DRAFT rows.
--
-- The previous "own recipes" policy (20260531050000_user_recipes_rls.sql) allowed an owner to
-- write a row with ANY status, including 'published'. Because the "public read published" policy
-- makes published recipes world-readable, that let any authenticated account inject arbitrary
-- content into every user's recipe corpus. Curated/published recipes are written via the service
-- role (which bypasses RLS), so constraining authenticated writes to status='draft' loses nothing
-- legitimate while closing the injection vector.
--
-- `using` is unchanged so owners can still read / update / delete their own rows; only the
-- `with check` (applied to INSERT and the post-image of UPDATE) is tightened — so a user can edit
-- a draft but can never flip it to, or insert it as, 'published'/'verified'.

drop policy if exists "own recipes" on recipes;
create policy "own recipes" on recipes
  for all to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid() and status = 'draft');

-- Rollback (restores the prior, permissive policy):
--   drop policy if exists "own recipes" on recipes;
--   create policy "own recipes" on recipes
--     for all to authenticated
--     using (created_by = auth.uid())
--     with check (created_by = auth.uid());

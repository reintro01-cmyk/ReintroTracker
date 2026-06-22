-- Blood work uploads + AI summary (personal app).
-- The user uploads a lab report (PDF/image); we store the raw file in a private bucket and keep an
-- AI-generated plain-language summary alongside it. Files live under a per-user folder so storage
-- RLS can scope access by the auth.uid() prefix; the metadata row is owner-only via table RLS.

-- Private bucket — owner-scoped, capped at 10 MB, lab-report file types only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bloodwork', 'bloodwork', false, 10485760,
        array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Storage RLS: a user may only touch objects under their own "<uid>/…" folder.
drop policy if exists "own bloodwork read" on storage.objects;
create policy "own bloodwork read" on storage.objects for select to authenticated
  using (bucket_id = 'bloodwork' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "own bloodwork insert" on storage.objects;
create policy "own bloodwork insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'bloodwork' and (storage.foldername(name))[1] = (select auth.uid()::text));

drop policy if exists "own bloodwork delete" on storage.objects;
create policy "own bloodwork delete" on storage.objects for delete to authenticated
  using (bucket_id = 'bloodwork' and (storage.foldername(name))[1] = (select auth.uid()::text));

-- Metadata + summary, one row per uploaded report.
create table if not exists blood_work (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  file_path   text not null,                 -- storage object path: "<uid>/<uuid>.<ext>"
  file_name   text,                          -- original filename, for display
  report_date date,                          -- date of the bloodwork (user-entered)
  status      text not null default 'processing' check (status in ('processing','done','error')),
  summary     text,                          -- AI plain-language summary
  flags       jsonb not null default '[]',   -- optional key findings: [{ label, value, note }]
  created_at  timestamptz not null default now()
);
create index if not exists blood_work_user on blood_work (user_id, created_at desc);

alter table blood_work enable row level security;

drop policy if exists "own bloodwork rows" on blood_work;
create policy "own bloodwork rows" on blood_work
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on blood_work to authenticated;

-- Per-user app-state blob for cloud sync (one row per user, upsert on user_id). This table was
-- created out-of-band in an early session and never tracked in migrations, so fresh environments
-- (e.g. production) were missing it and cloud save/load would 404. Tracking it here. Idempotent:
-- a no-op where it already exists.

create table if not exists tracker_states (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table tracker_states enable row level security;

drop policy if exists "Users can read own tracker" on tracker_states;
create policy "Users can read own tracker" on tracker_states
  for select using (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Users can insert own tracker" on tracker_states;
create policy "Users can insert own tracker" on tracker_states
  for insert with check (auth.uid() is not null and auth.uid() = user_id);

drop policy if exists "Users can update own tracker" on tracker_states;
create policy "Users can update own tracker" on tracker_states
  for update using (auth.uid() is not null and auth.uid() = user_id)
  with check (auth.uid() is not null and auth.uid() = user_id);

grant select, insert, update on tracker_states to authenticated;

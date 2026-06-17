-- Per-user hourly rate limiting for the Claude-calling edge functions
-- (generate-recipes, parse-recipe, parse-schedule-order, extract-recipe-image).
--
-- Sign-up is open, so without this any account could loop the AI endpoints and run up the
-- Anthropic bill. Each function calls record_ai_call(action, limit) right after it authenticates
-- the user; the function atomically counts calls in the current clock-hour window and returns
-- whether this call is allowed. Counting lives in Postgres (not in-memory) so it holds across the
-- many short-lived edge runtime instances.

create table if not exists ai_usage (
  user_id      uuid        not null references auth.users(id) on delete cascade,
  action       text        not null,                          -- which function (the rate-limit bucket)
  window_start timestamptz not null,                          -- date_trunc('hour', now())
  count        int         not null default 0,
  primary key (user_id, action, window_start)
);

-- Lets a periodic job prune old windows cheaply if ever needed.
create index if not exists ai_usage_window on ai_usage (window_start);

alter table ai_usage enable row level security;

-- Clients never write this table directly — all writes go through the SECURITY DEFINER function
-- below. A read-own policy is provided for transparency (e.g. showing remaining quota); there is
-- deliberately no client insert/update/delete policy.
drop policy if exists "own usage select" on ai_usage;
create policy "own usage select" on ai_usage
  for select using (auth.uid() = user_id);

grant select on ai_usage to authenticated;

-- ── Atomic count-and-check ─────────────────────────────────────────────────────────
-- Increments this hour's counter for (auth.uid(), action) ONLY while it is below the limit, and
-- reports whether the current call is allowed. The conditional ON CONFLICT ... WHERE means a
-- blocked call does not increment further (the counter never climbs past the limit, and reflects
-- allowed calls only). SECURITY DEFINER so it can write despite the table having no client-write
-- policy; search_path is pinned to public to keep the definer context safe.
create or replace function record_ai_call(p_action text, p_limit int)
returns table (allowed boolean, used int, lim int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  win timestamptz := date_trunc('hour', now());
  new_count int;
begin
  if uid is null then
    return query select false, 0, p_limit;
    return;
  end if;

  insert into ai_usage as u (user_id, action, window_start, count)
  values (uid, p_action, win, 1)
  on conflict (user_id, action, window_start)
  do update set count = u.count + 1
    where u.count < p_limit
  returning u.count into new_count;

  if new_count is null then
    -- A row existed and was already at/over the limit: blocked, not incremented.
    return query select false, p_limit, p_limit;
  else
    return query select true, new_count, p_limit;
  end if;
end;
$$;

grant execute on function record_ai_call(text, int) to authenticated;

-- Rollback:
--   drop function if exists record_ai_call(text, int);
--   drop table if exists ai_usage;

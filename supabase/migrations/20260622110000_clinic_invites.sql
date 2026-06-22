-- ════════════════════════════════════════════════════════════════════════════════════════
-- CLINIC EDITION — Stage 1: invites, auto-link on login, identity resolution
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Accounts model: email invite + auto-link. A clinician/admin records a person by email
-- (staff → clinic_invites; patient → a patients row with invite_email). When that person logs
-- in, claim_invites() matches their auth email and links them to the right role/record. The app
-- then calls my_identity() to decide which shell to render (admin / clinician / patient).

-- ── Staff invites (patients use patients.invite_email instead) ─────────────────────────────
create table if not exists clinic_invites (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  email      text not null,
  role       text not null check (role in ('admin','clinician','follower','observer')),
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index if not exists clinic_invites_email on clinic_invites (clinic_id, lower(email));

alter table clinic_invites enable row level security;
drop policy if exists "admin manages invites" on clinic_invites;
create policy "admin manages invites" on clinic_invites
  for all using (clinic_role(clinic_id) = 'admin') with check (clinic_role(clinic_id) = 'admin');
grant select, insert, update, delete on clinic_invites to authenticated;

-- ── Auto-link on login ─────────────────────────────────────────────────────────────────────
-- Definer so it can read auth.users (for the email) and write memberships/patients regardless of
-- the caller's current (possibly empty) role. Idempotent — safe to call on every login.
create or replace function claim_invites()
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); em text;
begin
  if uid is null then return; end if;
  select email into em from auth.users where id = uid;
  if em is null then return; end if;

  -- link any pending patient record invited to this email
  update patients
     set user_id = uid,
         status  = case when status = 'invited' then 'active' else status end
   where user_id is null and lower(invite_email) = lower(em);

  -- convert any staff invites into memberships, then clear them
  insert into clinic_members (clinic_id, user_id, role)
  select i.clinic_id, uid, i.role from clinic_invites i where lower(i.email) = lower(em)
  on conflict (clinic_id, user_id) do nothing;

  delete from clinic_invites where lower(email) = lower(em);
end; $$;
grant execute on function claim_invites() to authenticated;

-- ── Identity resolution (one call → which shell to show) ───────────────────────────────────
create or replace function my_identity()
returns jsonb language sql security definer stable set search_path = public as $$
  select jsonb_build_object(
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object('clinic_id', m.clinic_id, 'clinic_name', c.name, 'role', m.role) order by m.created_at)
      from clinic_members m join clinics c on c.id = m.clinic_id
      where m.user_id = auth.uid()
    ), '[]'::jsonb),
    'patients', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'clinic_id', p.clinic_id, 'clinic_name', c.name, 'display_name', p.display_name, 'status', p.status))
      from patients p join clinics c on c.id = p.clinic_id where p.user_id = auth.uid()
    ), '[]'::jsonb)
  );
$$;
grant execute on function my_identity() to authenticated;

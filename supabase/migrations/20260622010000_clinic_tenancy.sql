-- ════════════════════════════════════════════════════════════════════════════════════════
-- CLINIC EDITION — multi-tenancy foundation
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Turns the single-user app into a B2B clinic product. Three roles exist:
--   • clinic staff  — clinicians/team who manage patients (sub-roles below)
--   • patient       — an end-user enrolled at a clinic, logs their own data
--
-- Staff sub-roles mirror the clinic's real WhatsApp team:
--   admin     — manages the clinic + its members (the practice owner)
--   clinician — the doctor: full clinical read/write, assigns protocols, sets verdicts
--   follower  — tracks progress, can add notes / nudge, cannot change clinical protocol
--   observer  — the "silent senior": read-only, sees escalations only
--
-- Access is enforced entirely in Postgres via RLS. Policies delegate membership checks to the
-- SECURITY DEFINER helpers below — those read clinic_members with RLS bypassed, which both keeps
-- the policies readable and avoids the infinite recursion you'd get if a policy on clinic_members
-- queried clinic_members directly.

-- ── Tenant + membership ─────────────────────────────────────────────────────────────────
create table if not exists clinics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists clinic_members (
  id         uuid primary key default gen_random_uuid(),
  clinic_id  uuid not null references clinics(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null check (role in ('admin','clinician','follower','observer')),
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);
create index if not exists clinic_members_user on clinic_members (user_id);

-- ── Patients ────────────────────────────────────────────────────────────────────────────
-- user_id is null until the invited patient accepts and links their auth account. Health flags
-- drive the conditional daily-checkin prompts the clinic's template calls out ("if applicable",
-- and the salt-drink contraindication for hypertensives).
create table if not exists patients (
  id            uuid primary key default gen_random_uuid(),
  clinic_id     uuid not null references clinics(id) on delete cascade,
  user_id       uuid references auth.users(id) on delete set null,
  display_name  text not null,
  invite_email  text,
  status        text not null default 'invited' check (status in ('invited','active','paused','discharged')),
  -- clinical flags
  hypertensive  boolean not null default false,   -- suppresses the twice-daily salt drink
  on_bp_meds    boolean not null default false,   -- shows the BP vital
  diabetic      boolean not null default false,   -- shows the FBS vital
  -- programme anchors
  height_cm        numeric,
  start_weight_kg  numeric,
  goal_weight_kg   numeric,
  start_date       date,
  created_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists patients_clinic on patients (clinic_id);
create index if not exists patients_user on patients (user_id);

-- ── Membership helpers (SECURITY DEFINER → bypass RLS, avoid policy recursion) ────────────
create or replace function is_clinic_member(p_clinic_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from clinic_members m where m.clinic_id = p_clinic_id and m.user_id = auth.uid());
$$;

create or replace function clinic_role(p_clinic_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select m.role from clinic_members m where m.clinic_id = p_clinic_id and m.user_id = auth.uid();
$$;

create or replace function is_member_of_patient_clinic(p_patient_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from patients p join clinic_members m on m.clinic_id = p.clinic_id
    where p.id = p_patient_id and m.user_id = auth.uid()
  );
$$;

create or replace function role_for_patient(p_patient_id uuid)
returns text language sql security definer stable set search_path = public as $$
  select m.role from patients p join clinic_members m on m.clinic_id = p.clinic_id
  where p.id = p_patient_id and m.user_id = auth.uid();
$$;

create or replace function is_patient_owner(p_patient_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from patients p where p.id = p_patient_id and p.user_id = auth.uid());
$$;

-- ── Bootstrap: create a clinic and become its admin atomically ────────────────────────────
-- Solves the chicken-and-egg (you can't insert a clinic_members row for a clinic you're not yet
-- in). Runs as definer so the two inserts succeed regardless of the policies below.
create or replace function create_clinic(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into clinics (name, created_by) values (p_name, auth.uid()) returning id into new_id;
  insert into clinic_members (clinic_id, user_id, role) values (new_id, auth.uid(), 'admin');
  return new_id;
end; $$;

-- ── RLS ───────────────────────────────────────────────────────────────────────────────────
alter table clinics        enable row level security;
alter table clinic_members enable row level security;
alter table patients       enable row level security;

-- clinics: any member can see their clinic; only an admin can rename it.
create policy "member reads clinic" on clinics
  for select using (is_clinic_member(id));
create policy "admin updates clinic" on clinics
  for update using (clinic_role(id) = 'admin') with check (clinic_role(id) = 'admin');

-- clinic_members: members see their team; only an admin can add/change/remove members.
create policy "member reads team" on clinic_members
  for select using (is_clinic_member(clinic_id));
create policy "admin manages team" on clinic_members
  for all using (clinic_role(clinic_id) = 'admin') with check (clinic_role(clinic_id) = 'admin');

-- patients: all clinic staff can read their clinic's patients; the patient can read their own row.
-- Clinicians/admins create and edit patients; the patient may update a limited set (app-enforced).
create policy "staff reads clinic patients" on patients
  for select using (is_clinic_member(clinic_id));
create policy "patient reads self" on patients
  for select using (user_id = auth.uid());
create policy "clinician writes patients" on patients
  for insert with check (clinic_role(clinic_id) in ('admin','clinician'));
create policy "clinician updates patients" on patients
  for update using (clinic_role(clinic_id) in ('admin','clinician'))
  with check (clinic_role(clinic_id) in ('admin','clinician'));
create policy "patient updates self" on patients
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on clinics, clinic_members, patients to authenticated;
grant execute on function create_clinic(text) to authenticated;
grant execute on function is_clinic_member(uuid), clinic_role(uuid), is_member_of_patient_clinic(uuid),
  role_for_patient(uuid), is_patient_owner(uuid) to authenticated;

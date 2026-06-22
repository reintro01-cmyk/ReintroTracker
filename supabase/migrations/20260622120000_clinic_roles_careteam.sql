-- ════════════════════════════════════════════════════════════════════════════════════════
-- CLINIC EDITION — Stage 2 foundation: real roles, care teams, enrollment+approval, link invites
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Replaces the loose "clinician" role with concrete job roles and switches patient access from
-- clinic-wide to CARE-TEAM scoped: an admin sees every patient; everyone else sees a patient only
-- once they're on that patient's care team ("need-only"). The account manager is the patient's
-- primary contact and is auto-added to the care team at enrollment. Onboarding is via shareable
-- one-time link tokens (no email server required).

-- ── Roles ───────────────────────────────────────────────────────────────────────────────────
alter table clinic_members  drop constraint if exists clinic_members_role_check;
alter table clinic_members  add  constraint clinic_members_role_check
  check (role in ('admin','account_manager','doctor','dietician'));

-- ── Patients: approval workflow + primary account manager ─────────────────────────────────────
alter table patients drop constraint if exists patients_status_check;
alter table patients add  constraint patients_status_check
  check (status in ('pending_approval','active','paused','discharged','invited'));
alter table patients alter column status set default 'pending_approval';
alter table patients add column if not exists account_manager_id uuid references auth.users(id);
alter table patients add column if not exists approved_by uuid references auth.users(id);
alter table patients add column if not exists approved_at timestamptz;

-- ── Care team (patient ↔ many staff) ──────────────────────────────────────────────────────────
create table if not exists care_team (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id) on delete cascade,
  staff_user_id uuid not null references auth.users(id) on delete cascade,
  is_primary    boolean not null default false,          -- the account manager
  added_by      uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  unique (patient_id, staff_user_id)
);
create index if not exists care_team_patient on care_team (patient_id);
create index if not exists care_team_staff   on care_team (staff_user_id);

-- ── Access helpers (SECURITY DEFINER → no policy recursion) ───────────────────────────────────
create or replace function is_clinic_admin(p_clinic_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from clinic_members m
    where m.clinic_id = p_clinic_id and m.user_id = auth.uid() and m.role = 'admin');
$$;

-- true if the caller is the patient, an admin of their clinic, or on their care team
create or replace function can_access_patient(p_patient_id uuid) returns boolean
  language sql security definer stable set search_path = public as $$
  select exists (select 1 from patients p where p.id = p_patient_id and p.user_id = auth.uid())
      or exists (select 1 from patients p join clinic_members m on m.clinic_id = p.clinic_id
                  where p.id = p_patient_id and m.user_id = auth.uid() and m.role = 'admin')
      or exists (select 1 from care_team ct where ct.patient_id = p_patient_id and ct.staff_user_id = auth.uid());
$$;

-- the caller's clinic role FOR a patient they can reach (admin clinic-wide, else via care team)
create or replace function my_role_for_patient(p_patient_id uuid) returns text
  language sql security definer stable set search_path = public as $$
  select m.role from patients p
  join clinic_members m on m.clinic_id = p.clinic_id and m.user_id = auth.uid()
  where p.id = p_patient_id
    and (m.role = 'admin' or exists (select 1 from care_team ct where ct.patient_id = p.id and ct.staff_user_id = auth.uid()));
$$;

alter table care_team enable row level security;
drop policy if exists "team visible to those who can access patient" on care_team;
create policy "team visible to those who can access patient" on care_team
  for select using (can_access_patient(patient_id));
grant select on care_team to authenticated;

-- ── Re-scope patient + clinical RLS from clinic-wide to care-team ──────────────────────────────
drop policy if exists "staff reads clinic patients" on patients;
drop policy if exists "patient reads self"          on patients;
drop policy if exists "clinician writes patients"   on patients;
drop policy if exists "clinician updates patients"  on patients;
drop policy if exists "patient updates self"        on patients;
create policy "access scoped patient read" on patients
  for select using (can_access_patient(id));
create policy "patient updates self" on patients
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- staff writes to patients go through enroll_patient / approve_patient (definer); admins may edit
create policy "admin updates patients" on patients
  for update using (is_clinic_admin(clinic_id)) with check (is_clinic_admin(clinic_id));

drop policy if exists "patient owns checkins"   on daily_checkins;
drop policy if exists "staff reads checkins"    on daily_checkins;
drop policy if exists "clinician edits checkins" on daily_checkins;
create policy "patient owns checkins" on daily_checkins
  for all using (is_patient_owner(patient_id)) with check (is_patient_owner(patient_id));
create policy "care team reads checkins" on daily_checkins
  for select using (can_access_patient(patient_id));
create policy "clinical staff edit checkins" on daily_checkins
  for update using (my_role_for_patient(patient_id) in ('admin','doctor','dietician'))
  with check (my_role_for_patient(patient_id) in ('admin','doctor','dietician'));

drop policy if exists "patient reads reintroductions"     on reintroductions;
drop policy if exists "patient inserts reintroductions"   on reintroductions;
drop policy if exists "staff reads reintroductions"       on reintroductions;
drop policy if exists "clinician manages reintroductions" on reintroductions;
create policy "patient reads reintroductions" on reintroductions
  for select using (is_patient_owner(patient_id));
create policy "patient inserts reintroductions" on reintroductions
  for insert with check (is_patient_owner(patient_id));
create policy "care team reads reintroductions" on reintroductions
  for select using (can_access_patient(patient_id));
create policy "doctor manages reintroductions" on reintroductions
  for all using (my_role_for_patient(patient_id) in ('admin','doctor'))
  with check (my_role_for_patient(patient_id) in ('admin','doctor'));

drop policy if exists "staff reads notes"   on clinician_notes;
drop policy if exists "staff writes notes"  on clinician_notes;
drop policy if exists "author updates notes" on clinician_notes;
create policy "care team reads notes" on clinician_notes
  for select using (can_access_patient(patient_id));
create policy "care team writes notes" on clinician_notes
  for insert with check (my_role_for_patient(patient_id) is not null);
create policy "author updates notes" on clinician_notes
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

-- ── Enrollment + approval + care-team management (atomic, definer) ────────────────────────────
create or replace function enroll_patient(p_clinic_id uuid, p_display_name text, p_email text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; r text;
begin
  r := clinic_role(p_clinic_id);
  if r is null then raise exception 'not a member of this clinic'; end if;
  if r not in ('admin','account_manager') then raise exception 'only admin or account manager can enroll'; end if;
  insert into patients (clinic_id, display_name, invite_email, status, account_manager_id, created_by)
    values (p_clinic_id, p_display_name, lower(nullif(p_email,'')), 'pending_approval', auth.uid(), auth.uid())
    returning id into pid;
  insert into care_team (patient_id, staff_user_id, is_primary, added_by)
    values (pid, auth.uid(), true, auth.uid());
  return pid;
end; $$;

create or replace function approve_patient(p_patient_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select clinic_id into cid from patients where id = p_patient_id;
  if cid is null then raise exception 'no such patient'; end if;
  if not is_clinic_admin(cid) then raise exception 'only an admin can approve'; end if;
  update patients set status = 'active', approved_by = auth.uid(), approved_at = now()
    where id = p_patient_id and status = 'pending_approval';
end; $$;

create or replace function add_to_care_team(p_patient_id uuid, p_staff uuid)
returns void language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select clinic_id into cid from patients where id = p_patient_id;
  if not (is_clinic_admin(cid) or exists (select 1 from care_team where patient_id = p_patient_id and staff_user_id = auth.uid()))
    then raise exception 'not allowed'; end if;
  insert into care_team (patient_id, staff_user_id, added_by) values (p_patient_id, p_staff, auth.uid())
    on conflict (patient_id, staff_user_id) do nothing;
end; $$;

-- Supersede Stage 1's email-match invites (clinic_invites + claim_invites) with token links.
-- Also clears any stale Stage-1 invite rows whose role is no longer valid.
drop function if exists claim_invites();
drop table if exists clinic_invites;

-- ── Link-token invites ────────────────────────────────────────────────────────────────────────
create table if not exists invites (
  token       uuid primary key default gen_random_uuid(),
  clinic_id   uuid not null references clinics(id) on delete cascade,
  kind        text not null check (kind in ('staff','patient')),
  role        text check (role in ('admin','account_manager','doctor','dietician')),
  patient_id  uuid references patients(id) on delete cascade,
  email       text,
  created_by  uuid references auth.users(id),
  expires_at  timestamptz not null default now() + interval '14 days',
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
alter table invites enable row level security;
drop policy if exists "members read clinic invites" on invites;
create policy "members read clinic invites" on invites
  for select using (is_clinic_member(clinic_id));
grant select on invites to authenticated;

create or replace function create_staff_invite(p_clinic_id uuid, p_email text, p_role text)
returns uuid language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if not is_clinic_admin(p_clinic_id) then raise exception 'only an admin can invite staff'; end if;
  if p_role not in ('admin','account_manager','doctor','dietician') then raise exception 'bad role'; end if;
  insert into invites (clinic_id, kind, role, email, created_by)
    values (p_clinic_id, 'staff', p_role, lower(nullif(p_email,'')), auth.uid()) returning token into t;
  return t;
end; $$;

create or replace function create_patient_invite(p_patient_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare cid uuid; st text; t uuid;
begin
  select clinic_id, status into cid, st from patients where id = p_patient_id;
  if cid is null then raise exception 'no such patient'; end if;
  if not (is_clinic_admin(cid) or exists (select 1 from care_team where patient_id = p_patient_id and staff_user_id = auth.uid()))
    then raise exception 'not allowed'; end if;
  if st <> 'active' then raise exception 'approve the patient before inviting them'; end if;
  insert into invites (clinic_id, kind, patient_id, created_by)
    values (cid, 'patient', p_patient_id, auth.uid()) returning token into t;
  return t;
end; $$;

-- Called after the invitee signs up and logs in (token comes from the share link).
create or replace function claim_invite(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare inv invites; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into inv from invites where token = p_token;
  if inv.token is null    then return jsonb_build_object('ok', false, 'error', 'invalid');  end if;
  if inv.used_at is not null then return jsonb_build_object('ok', false, 'error', 'used'); end if;
  if inv.expires_at < now()  then return jsonb_build_object('ok', false, 'error', 'expired'); end if;

  if inv.kind = 'staff' then
    insert into clinic_members (clinic_id, user_id, role) values (inv.clinic_id, uid, inv.role)
      on conflict (clinic_id, user_id) do update set role = excluded.role;
  else
    update patients set user_id = uid where id = inv.patient_id;
  end if;
  update invites set used_at = now() where token = p_token;
  return jsonb_build_object('ok', true, 'kind', inv.kind);
end; $$;

grant execute on function is_clinic_admin(uuid), can_access_patient(uuid), my_role_for_patient(uuid),
  enroll_patient(uuid, text, text), approve_patient(uuid), add_to_care_team(uuid, uuid),
  create_staff_invite(uuid, text, text), create_patient_invite(uuid), claim_invite(uuid)
  to authenticated;

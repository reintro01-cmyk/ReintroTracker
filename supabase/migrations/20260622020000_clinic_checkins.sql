-- ════════════════════════════════════════════════════════════════════════════════════════
-- CLINIC EDITION — clinical data: daily check-ins, reintroductions, notes, audit
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Models the clinic's actual workflow (their WhatsApp "DAILY FOOD LOG" template + the running
-- day-by-day tracker). The patient files a structured daily check-in; the clinician dashboard
-- rebuilds the tracker and trigger report from it, replacing manual transcription.
--
-- Access pattern for every table here keys off the patient → clinic relationship via the
-- helpers from 20260622010000: the patient owns their rows; clinic staff read (and clinicians
-- write the clinical bits). Clinician notes are the exception — they are staff-only and never
-- visible to the patient.

-- ── Daily check-in (one row per patient per day) — maps 1:1 to the clinic's template ──────
create table if not exists daily_checkins (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references patients(id) on delete cascade,
  checkin_date      date not null,
  -- today's vitals
  weight_kg         numeric,
  bowel_movement    boolean,
  bp                text,                 -- shown only if patient.on_bp_meds
  fbs               numeric,              -- fasting blood sugar; shown only if patient.diabetic
  -- yesterday's recap
  healthy_fat       boolean,
  healthy_fat_note  text,                 -- time + quantity, free text
  -- meals: jsonb arrays of { time, what, qty } so the shape can flex without migrations
  proteins          jsonb not null default '[]',   -- protein 1 + protein 2
  veg_meal          jsonb,                          -- single { time, what, qty }
  -- reintroduction item of the day (tested across two meals, per their protocol)
  reintro_item      text,
  reintro_meals     jsonb not null default '[]',    -- [{ time, qty }, { time, qty }]
  -- supplements + hydration
  supplements_taken boolean,
  water_litres      numeric,
  salt_drink_twice  boolean,             -- suppressed in UI when patient.hypertensive
  other_drinks      text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (patient_id, checkin_date)
);
create index if not exists daily_checkins_patient_date on daily_checkins (patient_id, checkin_date desc);

-- ── Reintroductions — the trigger report source ───────────────────────────────────────────
-- One row per food/supplement challenge. Verdict is clinical (set by the clinician); symptoms is
-- a structured array of { symptom, severity, onset_hours }. round/version capture the clinic's
-- "RND 2M / V1 / V2" grouping seen in their tracker.
create table if not exists reintroductions (
  id            uuid primary key default gen_random_uuid(),
  patient_id    uuid not null references patients(id) on delete cascade,
  item          text not null,
  introduced_on date not null,
  category      text not null default 'food' check (category in ('food','supplement')),
  round         text,
  version       text,
  verdict       text not null default 'pending' check (verdict in ('pending','safe','limit','avoid')),
  symptoms      jsonb not null default '[]',
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists reintroductions_patient on reintroductions (patient_id, introduced_on desc);

-- ── Clinician notes — staff-only, never shown to the patient ───────────────────────────────
create table if not exists clinician_notes (
  id          uuid primary key default gen_random_uuid(),
  patient_id  uuid not null references patients(id) on delete cascade,
  author_id   uuid not null references auth.users(id),
  body        text not null,
  flag        text check (flag in ('follow_up','reaction','adherence','escalation')),
  resolved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists clinician_notes_patient on clinician_notes (patient_id, created_at desc);

-- ── Access audit — who viewed/changed a patient's data (compliance / DPDP) ─────────────────
create table if not exists patient_access_log (
  id         uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  actor_id   uuid references auth.users(id),
  action     text not null,
  at         timestamptz not null default now()
);
create index if not exists patient_access_log_patient on patient_access_log (patient_id, at desc);

-- keep updated_at fresh (set_updated_at() is defined by the base schema migration)
drop trigger if exists trg_daily_checkins_updated on daily_checkins;
create trigger trg_daily_checkins_updated before update on daily_checkins
  for each row execute function set_updated_at();
drop trigger if exists trg_reintroductions_updated on reintroductions;
create trigger trg_reintroductions_updated before update on reintroductions
  for each row execute function set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────────────────
alter table daily_checkins      enable row level security;
alter table reintroductions     enable row level security;
alter table clinician_notes     enable row level security;
alter table patient_access_log  enable row level security;

-- daily_checkins: patient fully owns their own; clinic staff read; clinicians may correct.
create policy "patient owns checkins" on daily_checkins
  for all using (is_patient_owner(patient_id)) with check (is_patient_owner(patient_id));
create policy "staff reads checkins" on daily_checkins
  for select using (is_member_of_patient_clinic(patient_id));
create policy "clinician edits checkins" on daily_checkins
  for update using (role_for_patient(patient_id) in ('admin','clinician'))
  with check (role_for_patient(patient_id) in ('admin','clinician'));

-- reintroductions: patient reads own + may log their experience; clinician owns the verdict.
create policy "patient reads reintroductions" on reintroductions
  for select using (is_patient_owner(patient_id));
create policy "patient inserts reintroductions" on reintroductions
  for insert with check (is_patient_owner(patient_id));
create policy "staff reads reintroductions" on reintroductions
  for select using (is_member_of_patient_clinic(patient_id));
create policy "clinician manages reintroductions" on reintroductions
  for all using (role_for_patient(patient_id) in ('admin','clinician'))
  with check (role_for_patient(patient_id) in ('admin','clinician'));

-- clinician_notes: staff only. Read by any member; written by clinician/admin/follower; the
-- observer ("silent senior") is read-only. The patient has NO access.
create policy "staff reads notes" on clinician_notes
  for select using (is_member_of_patient_clinic(patient_id));
create policy "staff writes notes" on clinician_notes
  for insert with check (role_for_patient(patient_id) in ('admin','clinician','follower'));
create policy "author updates notes" on clinician_notes
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());

-- access log: staff append; admins read.
create policy "staff appends access log" on patient_access_log
  for insert with check (is_member_of_patient_clinic(patient_id));
create policy "admin reads access log" on patient_access_log
  for select using (role_for_patient(patient_id) = 'admin');

grant select, insert, update, delete on daily_checkins, reintroductions, clinician_notes to authenticated;
grant select, insert on patient_access_log to authenticated;

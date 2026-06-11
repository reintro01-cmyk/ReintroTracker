# Test-user seed spec

Brief for an agent seeding demo accounts. **Read this cold — it assumes no prior context.**

## Goal

Create **5 test users** with varied programme progression and a realistic spread of
Safe / Limit / Avoid food verdicts, so different app states can be exercised.

| User | Email | Programme day (today) | ≈ foods introduced |
|------|-------|----------------------|--------------------|
| 1 | `user1@test.com` | Day 20 (early reintro) | 3 |
| 2 | `user2@test.com` | Day 45 | 16 |
| 3 | `user3@test.com` | Day 69 | 28 |
| 4 | `user4@test.com` | Day 100 | 43 |
| 5 | `user5@test.com` | Day 130 | 58 |

Password: see decision below.

## Project

- Supabase project ref: **`fmaqipsfrfpfpoqzotnk`** (`https://fmaqipsfrfpfpoqzotnk.supabase.co`)
- Publishable (client) key is in `src/lib/supabase.js`.
- App state persists to table **`public.tracker_states`**: columns `user_id` (uuid, PK/unique), `state` (jsonb), `updated_at` (timestamptz). One row per user; **upsert on `user_id`**.

## Access route (pick one)

The direct DB host (`db.<ref>.supabase.co:5432`) is **IPv6-only and unreachable** from the
dev machine; the pooler region is unknown. So:

1. **Service_role key + Admin API (recommended).** Get it from Dashboard → Project Settings →
   API → `service_role`. Use `supabase-js` (`createClient(url, serviceRoleKey)`):
   - `auth.admin.createUser({ email, password, email_confirm: true })` — **admin createUser does
     not enforce the 6-char minimum**, so the exact password **`12345`** works here.
   - Then `from("tracker_states").upsert({ user_id, state })` — service_role bypasses RLS.
2. **CLI** (`supabase` 2.101.0, now working & linked) for SQL/admin if preferred.
3. **Publishable key only (no secret).** `auth.signUp` works *only if email confirmation is off*
   and the password must be **≥ 6 chars** (use `123456`, not `12345`). Then upsert as the
   signed-in user (RLS permits self-writes).

> Password decision: **`12345`** is only settable via route 1/2 (admin/SQL). Via route 3 use `123456`.

## State template (appVersion 6)

Mirror `initialState()` in `src/hooks/useAppState.js`. **`appVersion` must be `6`** and include
`pinnedFoods`. `migrateState` will backfill anything omitted, but target v6 to avoid an upgrade write.

```js
function makeState({ name, programmeStart, status }) {
  return {
    appVersion: 6,
    foods: DEFAULT_FOODS,          // import from src/data/foods.js (131 foods) — keep order
    removed: [],
    intake: {},
    observations: {},              // optional: add an entry per decided food for realism
    status,                        // { foodId: "Safe" | "Limit" | "Avoid" }, see below
    body: { profile: { heightCm: "", neckCm: "" }, weights: [], measurements: [], customFields: [], unit: "cm" },
    nutrition: { dailyCalories: 800, macros: { fat: 25, carbs: 20, protein: 35, fibre: 20 }, mealMerge: null },
    favourites: [],
    favouriteFoods: [],
    programmeStart,                // ISO "YYYY-MM-DD"
    detoxDuration: 14,
    weightGoal: null,
    onboardingComplete: true,
    introOrder: "standard",
    preferredGroups: [],
    priorityFoods: [],
    allergies: [],
    pinnedFoods: {},
    user: { name, programme: "Food Reintroduction" },
  };
}
```

## Progression math

`today = 2026-05-31` (use the real current date when running).

```
programmeStart = today − (day − 1) days          // ISO date
detoxDuration  = 14
reintroDay     = day − 14
foodsIntroduced = reintroDay <= 0 ? 0 : min(131, ceil(reintroDay / 2))
```

Assign verdicts to the **first `foodsIntroduced` foods** in `DEFAULT_FOODS` order; leave the rest
absent from `status` (renders as Pending). Suggested distribution **~55 % Safe / 30 % Limit /
15 % Avoid**, assigned with a seeded RNG so runs are reproducible:

```js
function buildStatus(n, seed) {
  const rng = mulberry32(seed);
  const status = {};
  for (const f of DEFAULT_FOODS.slice(0, n)) {
    const r = rng();
    status[f.id] = r < 0.55 ? "Safe" : r < 0.85 ? "Limit" : "Avoid";
  }
  return status;
}
```

Optional realism: for each decided food, add `observations[foodId] = { verdict, savedAt: <iso> }`,
and add a few `favouriteFoods` from the Safe set.

## Verify

1. Sign in as `user2@test.com` in the app → it should load mid-programme (Day 45), schedule
   populated, ~16 foods with verdicts, the rest Pending.
2. `select user_id, jsonb_array_length(state->'foods') from tracker_states;` → 131 each.
3. Confirm `state->>'appVersion' = '6'`.

## Cleanup

Delete test users via `auth.admin.deleteUser(id)` (cascades the `tracker_states` row if FK is
`on delete cascade`; otherwise delete the row too).

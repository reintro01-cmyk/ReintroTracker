import { addDays, iso } from "./dates.js";

// Reintroduction layout is now a VARIABLE cadence. A food that needs an observation day
// occupies 2 calendar days (introduce → observe); a food the user marked "no observation day"
// (skipObserve) occupies just 1 (introduce only). Foods pack in list order; the next food
// starts the day after the previous food's last day.

export function parseLocalIso(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Whole-day offset of a target date from the reintro start (clamped at 0). Replaces the old
// 2-day "cycle index" — with a variable cadence there is no uniform grid to snap to.
export function dayOffsetForDate(targetIso, reintroStart) {
  const start = parseLocalIso(iso(reintroStart));
  const diffDays = Math.round((parseLocalIso(targetIso) - start) / 86400000);
  return Math.max(0, diffDays);
}

/**
 * Build the reintroduction schedule with a per-food cadence.
 *
 * width(food) = 1 if the food skips its observation day, else 2 (introduce + observe).
 *
 * Pins are authoritative: each pinned food claims its (day-offset) start first, bumped forward
 * until its full width fits a free range. Unpinned foods then flow into the next free range
 * that fits, in list order. Avoided foods — and declared allergies, excluded by id regardless
 * of status — are dropped entirely.
 *
 * Output shape is unchanged: [{date, iso, type, food}].
 */
export function buildSchedule({ foods, status = {}, pinnedFoods = {}, skipObserve = {}, reintroStart, allergies = [] }) {
  const blocked = new Set(allergies);
  const scheduled = foods.filter(f => status[f.id] !== "Avoid" && !blocked.has(f.id));
  const width = f => (skipObserve[f.id] ? 1 : 2);

  const used = new Set();              // consumed day offsets
  const startByFood = new Map();       // food id -> introduce day offset
  const fits = (start, w) => { for (let d = start; d < start + w; d++) if (used.has(d)) return false; return true; };
  const claim = (food, start) => { const w = width(food); for (let d = start; d < start + w; d++) used.add(d); startByFood.set(food.id, start); };

  // Pins first, by requested start ascending; bump forward until the whole width is free.
  const pinned = scheduled
    .filter(f => pinnedFoods[f.id])
    .map(f => ({ food: f, start: dayOffsetForDate(pinnedFoods[f.id], reintroStart) }))
    .sort((a, b) => a.start - b.start);
  for (const { food, start } of pinned) {
    let s = start;
    while (!fits(s, width(food))) s++;
    claim(food, s);
  }

  // Unpinned foods flow into the next fitting gap, in list order.
  const pinnedIds = new Set(pinned.map(p => p.food.id));
  let cursor = 0;
  for (const food of scheduled) {
    if (pinnedIds.has(food.id)) continue;
    let s = cursor;
    while (!fits(s, width(food))) s++;
    claim(food, s);
    cursor = s + width(food);
  }

  const rows = [];
  const ordered = [...startByFood.entries()]
    .map(([id, start]) => ({ food: scheduled.find(f => f.id === id), start }))
    .sort((a, b) => a.start - b.start);
  for (const { food, start } of ordered) {
    const intro = addDays(reintroStart, start);
    rows.push({ date: intro, iso: iso(intro), type: "Introduce", food });
    if (width(food) === 2) {
      const observe = addDays(reintroStart, start + 1);
      rows.push({ date: observe, iso: iso(observe), type: "Observe", food });
    }
  }
  return rows;
}

/**
 * If pinning `foodId` to `targetIso` would land on the same start day already claimed by a
 * different pinned food, return that food's id; otherwise null. (Build-time placement still
 * bumps overlaps defensively, so this is a pre-check for nicer UX.)
 */
export function pinConflict({ foodId, targetIso, pinnedFoods = {}, reintroStart }) {
  const targetStart = dayOffsetForDate(targetIso, reintroStart);
  for (const [fid, d] of Object.entries(pinnedFoods)) {
    if (fid === foodId) continue;
    if (dayOffsetForDate(d, reintroStart) === targetStart) return fid;
  }
  return null;
}

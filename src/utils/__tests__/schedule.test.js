import { describe, it, expect } from 'vitest';
import { buildSchedule, pinConflict, dayOffsetForDate } from '../schedule.js';

const START = new Date(2026, 5, 1); // 1 June 2026 (local midnight)

const foods = [
  { id: 'a', name: 'A', group: 'Dairy' },
  { id: 'b', name: 'B', group: 'Animal protein' },
  { id: 'c', name: 'C', group: 'Grains / carbs' },
  { id: 'd', name: 'D', group: 'Fruits' },
];

function introByFood(rows) {
  const m = {};
  for (const r of rows) if (r.type === 'Introduce') m[r.food.id] = r.iso;
  return m;
}
function hasObserve(rows, id) {
  return rows.some(r => r.type === 'Observe' && r.food.id === id);
}

describe('dayOffsetForDate', () => {
  it('maps dates to whole-day offsets from the start', () => {
    expect(dayOffsetForDate('2026-06-01', START)).toBe(0);
    expect(dayOffsetForDate('2026-06-02', START)).toBe(1);
    expect(dayOffsetForDate('2026-06-03', START)).toBe(2);
  });
  it('clamps dates before the start to 0', () => {
    expect(dayOffsetForDate('2026-05-20', START)).toBe(0);
  });
});

describe('buildSchedule — default (every food has an observation day)', () => {
  it('lays foods out 2 days apart, intro+observe each (back-compat with the old cadence)', () => {
    const rows = buildSchedule({ foods, status: {}, reintroStart: START });
    expect(rows).toHaveLength(8); // 4 foods × 2 rows
    const intro = introByFood(rows);
    expect(intro.a).toBe('2026-06-01');
    expect(intro.b).toBe('2026-06-03');
    expect(intro.c).toBe('2026-06-05');
    expect(intro.d).toBe('2026-06-07');
  });

  it('excludes Avoided foods and shifts the rest earlier', () => {
    const rows = buildSchedule({ foods, status: { b: 'Avoid' }, reintroStart: START });
    const intro = introByFood(rows);
    expect(intro.b).toBeUndefined();
    expect(intro.a).toBe('2026-06-01');
    expect(intro.c).toBe('2026-06-03');
    expect(intro.d).toBe('2026-06-05');
  });
});

describe('buildSchedule — variable cadence (skipObserve)', () => {
  it('a food with no observation day takes a single day; the next food starts the next day', () => {
    const rows = buildSchedule({ foods, status: {}, skipObserve: { b: true }, reintroStart: START });
    const intro = introByFood(rows);
    expect(intro.a).toBe('2026-06-01'); // days 0,1
    expect(intro.b).toBe('2026-06-03'); // day 2 only (no observe)
    expect(intro.c).toBe('2026-06-04'); // starts the day after b
    expect(intro.d).toBe('2026-06-06');
    expect(hasObserve(rows, 'b')).toBe(false);
    expect(hasObserve(rows, 'a')).toBe(true);
    // 3 foods × 2 rows + b's single intro = 7
    expect(rows).toHaveLength(7);
  });

  it('handles a no-observe food at the front of the list', () => {
    const rows = buildSchedule({ foods, status: {}, skipObserve: { a: true }, reintroStart: START });
    const intro = introByFood(rows);
    expect(intro.a).toBe('2026-06-01'); // day 0 only
    expect(intro.b).toBe('2026-06-02'); // starts day 1
    expect(intro.c).toBe('2026-06-04');
    expect(intro.d).toBe('2026-06-06');
    expect(hasObserve(rows, 'a')).toBe(false);
  });
});

describe('buildSchedule — pins are authoritative', () => {
  it('places a pinned food on its date and flows others around it', () => {
    const rows = buildSchedule({ foods, status: {}, pinnedFoods: { d: '2026-06-03' }, reintroStart: START });
    const intro = introByFood(rows);
    expect(intro.d).toBe('2026-06-03'); // pin honoured (offset 2 → days 2,3)
    expect(intro.a).toBe('2026-06-01'); // fills days 0,1
    expect(intro.b).toBe('2026-06-05'); // 2,3 taken by d → flows to 4,5
    expect(intro.c).toBe('2026-06-07');
    const dates = Object.values(intro);
    expect(new Set(dates).size).toBe(dates.length); // no collisions
  });

  it('a pinned no-observe food only reserves one day', () => {
    const rows = buildSchedule({ foods, status: {}, pinnedFoods: { d: '2026-06-03' }, skipObserve: { d: true }, reintroStart: START });
    const intro = introByFood(rows);
    expect(intro.d).toBe('2026-06-03'); // day 2 only
    expect(intro.a).toBe('2026-06-01'); // 0,1
    expect(intro.b).toBe('2026-06-04'); // 2 taken by d → next free is 3? a used 0,1; d used 2 → b fits 3,4
    expect(hasObserve(rows, 'd')).toBe(false);
  });
});

describe('pinConflict', () => {
  it('flags when another pinned food owns the target start day', () => {
    expect(pinConflict({ foodId: 'a', targetIso: '2026-06-03', pinnedFoods: { b: '2026-06-03' }, reintroStart: START })).toBe('b');
  });
  it('returns null when the target day is free', () => {
    expect(pinConflict({ foodId: 'a', targetIso: '2026-06-05', pinnedFoods: { b: '2026-06-03' }, reintroStart: START })).toBeNull();
  });
  it('ignores the food re-pinning to its own day', () => {
    expect(pinConflict({ foodId: 'b', targetIso: '2026-06-03', pinnedFoods: { b: '2026-06-03' }, reintroStart: START })).toBeNull();
  });
});

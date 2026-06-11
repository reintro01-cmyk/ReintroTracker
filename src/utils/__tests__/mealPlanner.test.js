import { describe, it, expect } from 'vitest';
import { loadRecipes } from '../../data/recipes.js';
import {
  MEAL_SLOTS,
  getCurrentPhase,
  getSlotBudget,
  getRecipesForSlot,
  getEffectiveSlots,
  macroGrams,
} from '../mealPlanner.js';

await loadRecipes();

// ── helpers ──────────────────────────────────────────────────────────────────
// Use local-time date formatting — toISOString() returns UTC which can be a
// day behind in positive-offset timezones (e.g. UTC+5:30).
function isoDateOffset(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ── MEAL_SLOTS ────────────────────────────────────────────────────────────────
describe('MEAL_SLOTS', () => {
  it('contains 7 slots', () => {
    expect(MEAL_SLOTS).toHaveLength(7);
  });

  it('kcalWeights sum to 1.0', () => {
    const total = MEAL_SLOTS.reduce((s, slot) => s + slot.kcalWeight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('all slots have required fields', () => {
    for (const slot of MEAL_SLOTS) {
      expect(slot).toHaveProperty('id');
      expect(slot).toHaveProperty('time');
      expect(slot).toHaveProperty('label');
      expect(slot).toHaveProperty('type');
      expect(slot).toHaveProperty('kcalWeight');
      expect(slot).toHaveProperty('color');
    }
  });
});

// ── getCurrentPhase ───────────────────────────────────────────────────────────
describe('getCurrentPhase', () => {
  it('returns pre phase when programme starts in the future', () => {
    const phase = getCurrentPhase({}, isoDateOffset(5));
    expect(phase.phase).toBe('pre');
    expect(phase.daysUntilStart).toBe(5);
  });

  it('returns detox phase on day 1 (today = start)', () => {
    const phase = getCurrentPhase({}, isoDateOffset(0));
    expect(phase.phase).toBe('detox');
    expect(phase.day).toBe(1);
  });

  it('returns detox phase on last day of detox', () => {
    const phase = getCurrentPhase({}, isoDateOffset(-13), 14);
    expect(phase.phase).toBe('detox');
    expect(phase.day).toBe(14);
  });

  it('returns reintro phase day after detox ends', () => {
    const phase = getCurrentPhase({}, isoDateOffset(-14), 14);
    expect(phase.phase).toBe('reintro');
    expect(phase.day).toBe(1);
  });

  it('counts safe foods in reintro phase', () => {
    const status = { apple: 'Safe', chicken: 'Safe', rice: 'Limit' };
    const phase = getCurrentPhase(status, isoDateOffset(-20), 14);
    expect(phase.phase).toBe('reintro');
    expect(phase.safeCount).toBe(2);
  });

  it('respects custom detox duration of 7 days', () => {
    const phase = getCurrentPhase({}, isoDateOffset(-7), 7);
    expect(phase.phase).toBe('reintro');
    expect(phase.day).toBe(1);
  });
});

// ── getSlotBudget ─────────────────────────────────────────────────────────────
describe('getSlotBudget', () => {
  it('returns correct kcal for fat slot at 800 kcal/day', () => {
    const fat = MEAL_SLOTS.find(s => s.id === 'fat');
    expect(getSlotBudget(800, fat)).toBe(112); // 800 * 0.14 = 112
  });

  it('total of all slot budgets equals daily calories', () => {
    const daily = 1200;
    const total = MEAL_SLOTS.reduce((s, slot) => s + getSlotBudget(daily, slot), 0);
    // Allow ±7 kcal rounding error across 7 slots
    expect(Math.abs(total - daily)).toBeLessThanOrEqual(7);
  });
});

// ── getEffectiveSlots ─────────────────────────────────────────────────────────
describe('getEffectiveSlots', () => {
  it('returns all 7 MEAL_SLOTS when mealMerge is null', () => {
    expect(getEffectiveSlots(null)).toHaveLength(7);
    expect(getEffectiveSlots(null)).toBe(MEAL_SLOTS);
  });

  it('merge at 2pm returns 6 slots', () => {
    const slots = getEffectiveSlots('2pm');
    expect(slots).toHaveLength(6);
  });

  it('merge at 2pm removes vc1 (12 PM) and p2 (2 PM)', () => {
    const slots = getEffectiveSlots('2pm');
    const ids = slots.map(s => s.id);
    expect(ids).not.toContain('vc1');
    expect(ids).not.toContain('p2');
  });

  it('merge at 2pm inserts a proteincarb slot at 2 PM', () => {
    const slots = getEffectiveSlots('2pm');
    const merged = slots.find(s => s.type === 'proteincarb');
    expect(merged).toBeDefined();
    expect(merged.time).toBe('2:00 PM');
  });

  it('merge at 2pm combined kcalWeight equals vc1 + p2 (30%)', () => {
    const slots = getEffectiveSlots('2pm');
    const merged = slots.find(s => s.type === 'proteincarb');
    expect(merged.kcalWeight).toBeCloseTo(0.30, 5);
  });

  it('merge at 2pm slot kcalWeights still sum to 1.0', () => {
    const total = getEffectiveSlots('2pm').reduce((s, slot) => s + slot.kcalWeight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('merge at 6pm returns 6 slots', () => {
    expect(getEffectiveSlots('6pm')).toHaveLength(6);
  });

  it('merge at 6pm removes vc2 (4 PM) and p3 (6 PM)', () => {
    const ids = getEffectiveSlots('6pm').map(s => s.id);
    expect(ids).not.toContain('vc2');
    expect(ids).not.toContain('p3');
  });

  it('merge at 6pm inserts a proteincarb slot at 6 PM', () => {
    const slots = getEffectiveSlots('6pm');
    const merged = slots.find(s => s.type === 'proteincarb');
    expect(merged).toBeDefined();
    expect(merged.time).toBe('6:00 PM');
  });

  it('merge at 6pm slot kcalWeights still sum to 1.0', () => {
    const total = getEffectiveSlots('6pm').reduce((s, slot) => s + slot.kcalWeight, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });
});

// ── getRecipesForSlot ─────────────────────────────────────────────────────────
describe('getRecipesForSlot', () => {
  const detoxPhase = { phase: 'detox', day: 5, totalDays: 14 };
  const reintroPhase = { phase: 'reintro', day: 10, safeCount: 5 };

  it('returns only fat-slot recipes in detox phase', () => {
    const results = getRecipesForSlot('fat', detoxPhase, [], 200, []);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.slot === 'fat')).toBe(true);
  });

  it('excludes reintro-only recipes during detox', () => {
    const results = getRecipesForSlot('protein', detoxPhase, [], 200, []);
    expect(results.every(r => r.phase !== 'reintro')).toBe(true);
  });

  it('excludes recipes whose required safe foods are not cleared', () => {
    const results = getRecipesForSlot('protein', reintroPhase, [], 200, []);
    // All returned recipes must have all requiredSafeFoods in safeFoodIds (empty here)
    expect(results.every(r => r.requiredSafeFoods.length === 0)).toBe(true);
  });

  it('includes reintro recipe when all required foods are safe', () => {
    const safeFoods = ['grilled-chicken'];
    const results = getRecipesForSlot('protein', reintroPhase, safeFoods, 250, []);
    const chickenRecipe = results.find(r => r.requiredSafeFoods.includes('grilled-chicken'));
    expect(chickenRecipe).toBeDefined();
  });

  it('excludes recipes that exceed calorie budget + tolerance', () => {
    const slotKcal = 100;
    const tolerance = 0.175;
    const results = getRecipesForSlot('protein', reintroPhase, [], slotKcal, []);
    const maxAllowed = slotKcal * (1 + tolerance);
    expect(results.every(r => r.kcal <= maxAllowed)).toBe(true);
  });

  it('sorts favourites to the top', () => {
    const safeFoods = ['grilled-chicken', 'moong-dal', 'curd', 'paneer', 'eggs'];
    const all = getRecipesForSlot('protein', reintroPhase, safeFoods, 250, []);
    if (all.length < 2) return; // skip if not enough recipes
    const favId = all[1].id;
    const withFav = getRecipesForSlot('protein', reintroPhase, safeFoods, 250, [favId]);
    expect(withFav[0].id).toBe(favId);
  });

  it('returns proteincarb recipes for merged slot with safe foods', () => {
    const safeFoods = ['grilled-chicken', 'white-rice'];
    const results = getRecipesForSlot('proteincarb', reintroPhase, safeFoods, 300, []);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(r => r.slot === 'proteincarb')).toBe(true);
  });

  it('returns empty array for proteincarb without required foods', () => {
    const results = getRecipesForSlot('proteincarb', reintroPhase, [], 300, []);
    expect(results).toHaveLength(0);
  });
});

// ── macroGrams ────────────────────────────────────────────────────────────────
describe('macroGrams', () => {
  it('calculates protein grams correctly', () => {
    // 800 kcal, 35% protein = 280 kcal / 4 kcal/g = 70g
    const g = macroGrams(800, { fat: 25, carbs: 20, protein: 35, fibre: 20 });
    expect(g.protein).toBe(70);
  });

  it('calculates fat grams correctly (9 kcal/g)', () => {
    // 800 kcal, 25% fat = 200 kcal / 9 kcal/g ≈ 22g
    const g = macroGrams(800, { fat: 25, carbs: 20, protein: 35, fibre: 20 });
    expect(g.fat).toBe(22);
  });

  it('returns zero grams when percentage is zero', () => {
    const g = macroGrams(800, { fat: 0, carbs: 0, protein: 100, fibre: 0 });
    expect(g.fat).toBe(0);
    expect(g.carbs).toBe(0);
    expect(g.fibre).toBe(0);
  });
});

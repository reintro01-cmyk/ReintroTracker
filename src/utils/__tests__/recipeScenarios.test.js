/**
 * Recipe scenario tests
 *
 * Simulates realistic programme states at different days by assigning
 * food statuses randomly (55 % Safe / 35 % Limit / 10 % Avoid) and
 * verifying that recipe filtering never produces invalid or hallucinated
 * results regardless of which foods are cleared.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_FOODS } from '../../data/foods.js';
import { loadRecipes } from '../../data/recipes.js';

const RECIPES = await loadRecipes();
import {
  MEAL_SLOTS,
  getCurrentPhase,
  getSlotBudget,
  getRecipesForSlot,
  getEffectiveSlots,
} from '../mealPlanner.js';

// ── Test helpers ─────────────────────────────────────────────────────────────

/** Local-time ISO date string, `offset` days from today (negative = past). */
function localIso(offset) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Seeded LCG — deterministic across runs. */
function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Assign Safe / Limit / Avoid to the first `count` foods in DEFAULT_FOODS
 * at the given frequency ratios.
 */
function buildStatus(count, { safeRate = 0.55, limitRate = 0.35, seed = 42 } = {}) {
  const rng = makePrng(seed);
  const status = {};
  for (const food of DEFAULT_FOODS.slice(0, count)) {
    const r = rng();
    status[food.id] = r < safeRate ? 'Safe'
      : r < safeRate + limitRate ? 'Limit'
      : 'Avoid';
  }
  return status;
}

/** Return only Safe food IDs from a status map. */
function safeIds(status) {
  return Object.entries(status)
    .filter(([, v]) => v === 'Safe')
    .map(([k]) => k);
}

/**
 * Build a phaseInfo object for a given 1-indexed programme day.
 * With a 14-day detox: days 1–14 = detox, day 15+ = reintro.
 * Foods introduced ≈ ceil(reintroDay / 2) (one food per 2-day introduce+observe cycle).
 */
function phaseForDay(progDay, statusMap, detox = 14) {
  const start = localIso(-(progDay - 1)); // today is progDay
  return getCurrentPhase(statusMap, start, detox);
}

/**
 * Return the number of foods that have had their introduce day by programme day D.
 * Reintro starts on day (detox + 1). Each food takes 2 days (introduce + observe).
 */
function foodsIntroducedByDay(progDay, detox = 14) {
  const reintroDay = progDay - detox;
  if (reintroDay <= 0) return 0;
  return Math.ceil(reintroDay / 2);
}

// All valid IDs in the dataset — used to detect hallucination
const VALID_FOOD_IDS  = new Set(DEFAULT_FOODS.map(f => f.id));
const VALID_RECIPE_IDS = new Set(RECIPES.map(r => r.id));

const DAILY_KCAL = 800;
const TOLERANCE  = 0.175; // must match mealPlanner.js

// ── Core invariant checker ────────────────────────────────────────────────────

/**
 * Assert the full set of contracts for getRecipesForSlot across every slot
 * for a given phase + safe food list.
 */
function assertSlotInvariants(phaseInfo, safeFoodList, label) {
  const slots = getEffectiveSlots(null); // standard 7-slot plan

  for (const slot of slots) {
    const budget = getSlotBudget(DAILY_KCAL, slot);
    const results = getRecipesForSlot(slot.type, phaseInfo, safeFoodList, budget, []);

    for (const recipe of results) {
      // 1. Returned ID must exist in the master recipe list (no hallucination)
      expect(
        VALID_RECIPE_IDS.has(recipe.id),
        `[${label}] slot=${slot.id}: unknown recipe id "${recipe.id}"`
      ).toBe(true);

      // 2. Slot type must match
      expect(
        recipe.slot,
        `[${label}] slot=${slot.id}: recipe "${recipe.id}" has wrong slot`
      ).toBe(slot.type);

      // 3. Calorie cap respected (budget + 17.5 % tolerance)
      expect(
        recipe.kcal,
        `[${label}] slot=${slot.id}: recipe "${recipe.id}" kcal ${recipe.kcal} exceeds budget`
      ).toBeLessThanOrEqual(Math.round(budget * (1 + TOLERANCE)));

      // 4. All requiredSafeFoods must be in safeFoodList
      for (const foodId of recipe.requiredSafeFoods) {
        expect(
          safeFoodList.includes(foodId),
          `[${label}] slot=${slot.id}: recipe "${recipe.id}" requires "${foodId}" which is not Safe`
        ).toBe(true);

        // 5. Every required food ID must actually exist in DEFAULT_FOODS (no made-up IDs)
        expect(
          VALID_FOOD_IDS.has(foodId),
          `[${label}] slot=${slot.id}: recipe "${recipe.id}" references non-existent food "${foodId}"`
        ).toBe(true);
      }

      // 6. Detox phase: reintro-only recipes must never appear
      if (phaseInfo.phase === 'detox' || phaseInfo.phase === 'pre') {
        expect(
          recipe.phase,
          `[${label}] slot=${slot.id}: detox/pre should never return reintro-only recipe "${recipe.id}"`
        ).not.toBe('reintro');
      }
    }
  }
}

// ── Scenario definitions ──────────────────────────────────────────────────────

const SCENARIOS = [
  { label: 'Day 1  (detox day 1,  0 foods)',    progDay: 1   },
  { label: 'Day 7  (detox day 7,  0 foods)',    progDay: 7   },
  { label: 'Day 14 (last detox,   0 foods)',    progDay: 14  },
  { label: 'Day 15 (reintro day 1, 1 food)',    progDay: 15  },
  { label: 'Day 20 (reintro day 6, 3 foods)',   progDay: 20  },
  { label: 'Day 45 (reintro day 31, 16 foods)', progDay: 45  },
  { label: 'Day 66 (reintro day 52, 26 foods)', progDay: 66  },
  { label: 'Day 100 (reintro day 86, 43 foods)',progDay: 100 },
  { label: 'Day 150 (reintro day 136, 68 foods)',progDay: 150 },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Recipe scenarios — slot invariants at different programme days', () => {
  for (const { label, progDay } of SCENARIOS) {
    it(label, () => {
      const count     = foodsIntroducedByDay(progDay);
      const status    = buildStatus(count);
      const phase     = phaseForDay(progDay, status);
      const safe      = safeIds(status);
      assertSlotInvariants(phase, safe, label);
    });
  }
});

describe('Recipe scenarios — merged meal plan (2 PM merge)', () => {
  it('Day 66 with 2pm merge: proteincarb slot only returns valid combined recipes', () => {
    const count  = foodsIntroducedByDay(66);
    const status = buildStatus(count);
    const phase  = phaseForDay(66, status);
    const safe   = safeIds(status);
    const slots  = getEffectiveSlots('2pm');

    const mergedSlot = slots.find(s => s.type === 'proteincarb');
    expect(mergedSlot).toBeDefined();

    const budget  = getSlotBudget(DAILY_KCAL, mergedSlot);
    const results = getRecipesForSlot('proteincarb', phase, safe, budget, []);

    for (const recipe of results) {
      expect(VALID_RECIPE_IDS.has(recipe.id)).toBe(true);
      expect(recipe.slot).toBe('proteincarb');
      expect(recipe.kcal).toBeGreaterThanOrEqual(200); // combined meal minimum
      expect(recipe.kcal).toBeLessThanOrEqual(Math.round(budget * (1 + TOLERANCE)));
      expect(recipe.requiredSafeFoods.length).toBeGreaterThanOrEqual(2);
      for (const fid of recipe.requiredSafeFoods) {
        expect(VALID_FOOD_IDS.has(fid)).toBe(true);
        expect(safe.includes(fid)).toBe(true);
      }
    }
  });
});

describe('Recipe scenarios — status distribution', () => {
  it('55 / 35 / 10 split is approximately correct across 50-food sample', () => {
    const status = buildStatus(50);
    const values = Object.values(status);
    const safe   = values.filter(v => v === 'Safe').length;
    const limit  = values.filter(v => v === 'Limit').length;
    const avoid  = values.filter(v => v === 'Avoid').length;

    // Allow ±15 % tolerance on each bucket (small sample variance)
    expect(safe  / 50).toBeGreaterThan(0.40);
    expect(safe  / 50).toBeLessThan(0.70);
    expect(limit / 50).toBeGreaterThan(0.20);
    expect(limit / 50).toBeLessThan(0.50);
    expect(avoid / 50).toBeGreaterThan(0.00);
    expect(avoid / 50).toBeLessThan(0.25);
    expect(safe + limit + avoid).toBe(50); // every food assigned
  });
});

describe('Recipe scenarios — more safe foods → more recipes', () => {
  it('Day 100 has more total available recipes than day 45', () => {
    const countA = foodsIntroducedByDay(45);
    const countB = foodsIntroducedByDay(100);

    const statusA = buildStatus(countA, { seed: 7 });
    const statusB = buildStatus(countB, { seed: 7 });

    const phaseA = phaseForDay(45, statusA);
    const phaseB = phaseForDay(100, statusB);

    const safeA  = safeIds(statusA);
    const safeB  = safeIds(statusB);

    let totalA = 0, totalB = 0;
    for (const slot of MEAL_SLOTS) {
      const budget = getSlotBudget(DAILY_KCAL, slot);
      totalA += getRecipesForSlot(slot.type, phaseA, safeA, budget, []).length;
      totalB += getRecipesForSlot(slot.type, phaseB, safeB, budget, []).length;
    }

    expect(totalB).toBeGreaterThanOrEqual(totalA);
  });

  it('Day 150 has more total available recipes than day 66', () => {
    const countA = foodsIntroducedByDay(66);
    const countB = foodsIntroducedByDay(150);

    const statusA = buildStatus(countA, { seed: 13 });
    const statusB = buildStatus(countB, { seed: 13 });

    const phaseA = phaseForDay(66, statusA);
    const phaseB = phaseForDay(150, statusB);

    let totalA = 0, totalB = 0;
    for (const slot of MEAL_SLOTS) {
      const budget = getSlotBudget(DAILY_KCAL, slot);
      totalA += getRecipesForSlot(slot.type, phaseA, safeIds(statusA), budget, []).length;
      totalB += getRecipesForSlot(slot.type, phaseB, safeIds(statusB), budget, []).length;
    }

    expect(totalB).toBeGreaterThanOrEqual(totalA);
  });
});

describe('Recipe scenarios — seeds produce different safe food sets', () => {
  it('two different seeds at day 66 produce different safe-food lists', () => {
    const count = foodsIntroducedByDay(66);
    const safe1 = safeIds(buildStatus(count, { seed: 1 }));
    const safe2 = safeIds(buildStatus(count, { seed: 99 }));
    // Different seeds → different safe sets (overwhelmingly likely at n=26)
    expect(safe1).not.toEqual(safe2);
  });

  it('same seed always produces the same safe-food list (determinism)', () => {
    const count = foodsIntroducedByDay(66);
    const safe1 = safeIds(buildStatus(count, { seed: 42 }));
    const safe2 = safeIds(buildStatus(count, { seed: 42 }));
    expect(safe1).toEqual(safe2);
  });
});

describe('Recipe scenarios — no Limit or Avoid food appears in any recipe result', () => {
  it('Day 66: recipes never require a Limit or Avoid food', () => {
    const count  = foodsIntroducedByDay(66);
    const status = buildStatus(count, { seed: 55 });
    const phase  = phaseForDay(66, status);
    const safe   = safeIds(status);
    const notSafe = new Set(
      Object.entries(status).filter(([, v]) => v !== 'Safe').map(([k]) => k)
    );

    for (const slot of MEAL_SLOTS) {
      const budget  = getSlotBudget(DAILY_KCAL, slot);
      const results = getRecipesForSlot(slot.type, phase, safe, budget, []);
      for (const recipe of results) {
        for (const fid of recipe.requiredSafeFoods) {
          expect(
            notSafe.has(fid),
            `Recipe "${recipe.id}" requires "${fid}" which is Limit or Avoid`
          ).toBe(false);
        }
      }
    }
  });
});

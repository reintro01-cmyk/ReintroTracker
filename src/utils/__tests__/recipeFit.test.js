import { describe, it, expect } from 'vitest';
import { recipeFit, MEALS_PER_DAY, GOOD_THRESHOLD } from '../recipeFit.js';

// Equal ENERGY split target (25% each). Grams chosen so protein*4 = carbs*4 = fat*9 = fibre*2,
// i.e. {protein:9, carbs:9, fat:4, fibre:18} -> 36 kcal each -> 144 kcal total. With daily/3 =
// 144, that recipe hits both the per-meal budget and the macro balance perfectly.
const EQUAL_TARGET = { dailyCalories: 144 * MEALS_PER_DAY, macros: { protein: 25, carbs: 25, fat: 25, fibre: 25 } };
const PERFECT = { kcal: 144, macros: { protein: 9, carbs: 9, fat: 4, fibre: 18 } };

describe('recipeFit', () => {
  it('scores a recipe matching budget + macro split at/near 100 and flags it good', () => {
    const fit = recipeFit(PERFECT, EQUAL_TARGET);
    expect(fit.score).toBe(100);
    expect(fit.good).toBe(true);
  });

  it('scores an off-target recipe low and not good', () => {
    const off = { kcal: 600, macros: { protein: 100, carbs: 0, fat: 0, fibre: 0 } };
    const fit = recipeFit(off, EQUAL_TARGET);
    expect(fit.score).toBeLessThan(GOOD_THRESHOLD);
    expect(fit.good).toBe(false);
  });

  it('ranks the closer recipe above the farther one', () => {
    const near = { kcal: 160, macros: { protein: 10, carbs: 9, fat: 4, fibre: 16 } };
    const far  = { kcal: 700, macros: { protein: 80, carbs: 5, fat: 30, fibre: 0 } };
    expect(recipeFit(near, EQUAL_TARGET).score).toBeGreaterThan(recipeFit(far, EQUAL_TARGET).score);
  });

  it('tolerates an unnormalized target split (sliders not summing to 100)', () => {
    const target = { dailyCalories: 144 * MEALS_PER_DAY, macros: { protein: 50, carbs: 50, fat: 50, fibre: 50 } };
    const fit = recipeFit(PERFECT, target);   // proportions still equal -> perfect
    expect(fit.score).toBe(100);
  });

  it('returns {0,false} when targets or recipe are missing/empty', () => {
    expect(recipeFit(PERFECT, null)).toEqual({ score: 0, good: false });
    expect(recipeFit(PERFECT, { dailyCalories: 0 })).toEqual({ score: 0, good: false });
    expect(recipeFit(null, EQUAL_TARGET)).toEqual({ score: 0, good: false });
  });

  it('uses calorie fit only when a recipe has no macro data (caps at ~50)', () => {
    const noMacros = { kcal: 144, macros: {} };
    const fit = recipeFit(noMacros, EQUAL_TARGET);
    expect(fit.score).toBe(50);          // perfect kcal (0.5) + zero macro (0)
    expect(fit.good).toBe(false);
  });
});

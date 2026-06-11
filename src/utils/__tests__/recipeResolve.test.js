import { describe, it, expect } from 'vitest';
import { unitToGrams, pickMeasureForUnit, computeRecipeTotals, atwaterDeviation } from '../recipeResolve.js';

const UD = { g: 1, ml: 1, tsp: 5, tbsp: 15, cup: 240, katori: 150, piece: 50 };
const rice = { ingredient_id: 'r', name: 'rice', kcal: 130, protein_g: 2.7, fat_g: 0.3, carb_g: 28, fibre_g: 0.4, confidence: 'high' };
const ghee = { ingredient_id: 'g', name: 'ghee', kcal: 900, protein_g: 0, fat_g: 100, carb_g: 0, fibre_g: 0, confidence: 'medium' };

describe('unitToGrams', () => {
  it('passes grams/ml straight through', () => {
    expect(unitToGrams(200, 'g', [], UD)).toMatchObject({ grams: 200 });
    expect(unitToGrams(150, 'ml', [], UD)).toMatchObject({ grams: 150 });
  });

  it('uses generic unit defaults when no measure', () => {
    expect(unitToGrams(2, 'cup', [], UD).grams).toBe(480);
    expect(unitToGrams(1, 'tbsp', [], UD).grams).toBe(15);
  });

  it('prefers a per-ingredient "1 unit" measure over the generic default', () => {
    const measures = [{ label: '1 cup', unit: 'cup', grams: 195 }];
    const res = unitToGrams(2, 'cup', measures, UD);
    expect(res.grams).toBe(390);
    expect(res.basis).toContain('measure');
  });

  it('returns null grams when qty missing or unit unknown', () => {
    expect(unitToGrams(null, 'cup', [], UD).grams).toBeNull();
    expect(unitToGrams(1, 'sprig', [], UD).grams).toBeNull();
  });
});

describe('pickMeasureForUnit', () => {
  it('only trusts a single-portion label', () => {
    const measures = [{ label: '3 oz', unit: 'serving', grams: 85 }, { label: '1 cup', unit: 'cup', grams: 195 }];
    expect(pickMeasureForUnit('cup', measures).grams).toBe(195);
    expect(pickMeasureForUnit('oz', measures)).toBeNull();
  });
});

describe('computeRecipeTotals', () => {
  it('sums matched lines and divides by servings', () => {
    const lines = [
      { food: rice, grams: 200 },   // 260 kcal
      { food: ghee, grams: 15 },    // 135 kcal
    ];
    const t = computeRecipeTotals(lines, 2);
    expect(t.total.kcal).toBeCloseTo(395, 0);
    expect(t.perServing.kcal).toBeCloseTo(197.5, 0);
    expect(t.counts).toMatchObject({ matched: 2, unmatched: 0, needsGrams: 0 });
  });

  it('flags unmatched lines and lines missing grams, excluding them from totals', () => {
    const lines = [
      { food: rice, grams: 100 },
      { food: null, grams: null },          // unmatched
      { food: ghee, grams: null },          // needs grams
    ];
    const t = computeRecipeTotals(lines, 1);
    expect(t.total.kcal).toBeCloseTo(130, 0);
    expect(t.flags).toContain('unmatched_ingredients');
    expect(t.flags).toContain('missing_grams');
    expect(t.counts).toMatchObject({ matched: 1, unmatched: 1, needsGrams: 1, lines: 3 });
  });

  it('raises atwater_fail when kcal and macros disagree', () => {
    const bogus = { food: { kcal: 50, protein_g: 20, fat_g: 20, carb_g: 20 }, grams: 100 };
    const t = computeRecipeTotals([bogus], 1);
    expect(t.flags).toContain('atwater_fail');
  });
});

describe('atwaterDeviation', () => {
  it('is near zero for self-consistent macros', () => {
    expect(atwaterDeviation({ kcal: 200, protein_g: 10, carb_g: 20, fat_g: 9.78 })).toBeLessThan(0.05);
  });
});

import { describe, it, expect } from 'vitest';
import { computeLogMacros, sumTotals, portionOptions, num } from '../foodLog.js';

const paneer = { kcal: 257.9, protein_g: 18.86, fat_g: 14.78, carb_g: 12.41, fibre_g: 0 };

describe('num', () => {
  it('coerces and guards non-numbers', () => {
    expect(num("12.5")).toBe(12.5);
    expect(num(null)).toBe(0);
    expect(num("abc")).toBe(0);
    expect(num(undefined)).toBe(0);
  });
});

describe('computeLogMacros', () => {
  it('scales per-100g to the logged grams', () => {
    const m = computeLogMacros(paneer, 150);
    expect(m.kcal).toBeCloseTo(386.85, 2);
    expect(m.protein_g).toBeCloseTo(28.29, 2);
    expect(m.carb_g).toBeCloseTo(18.615, 2);
  });
  it('100g returns the per-100g values unchanged', () => {
    const m = computeLogMacros(paneer, 100);
    expect(m.kcal).toBeCloseTo(257.9, 5);
  });
  it('0g is all zeros; missing fields treated as 0', () => {
    expect(computeLogMacros(paneer, 0).kcal).toBe(0);
    expect(computeLogMacros({}, 200).kcal).toBe(0);
  });
});

describe('sumTotals', () => {
  it('adds macros across logs and ignores bad values', () => {
    const t = sumTotals([
      { kcal: 100, protein_g: 5, fat_g: 2, carb_g: 10, fibre_g: 1 },
      { kcal: "50", protein_g: 2.5, fat_g: null, carb_g: 5, fibre_g: 0.5 },
    ]);
    expect(t.kcal).toBe(150);
    expect(t.protein_g).toBe(7.5);
    expect(t.fat_g).toBe(2);
  });
  it('empty/undefined → zeros', () => {
    expect(sumTotals([]).kcal).toBe(0);
    expect(sumTotals(undefined).kcal).toBe(0);
  });
});

describe('portionOptions', () => {
  it('always starts with grams base, then food measures, then generic units', () => {
    const opts = portionOptions(
      [{ label: '3 oz', unit: 'oz', grams: 85, is_default: true }],
      [{ unit: 'g', grams: 1 }, { unit: 'tbsp', grams: 15 }, { unit: 'katori', grams: 150 }]
    );
    expect(opts[0]).toEqual({ key: 'g', label: 'grams', grams: 1 });
    expect(opts.find(o => o.key === 'm:3 oz').grams).toBe(85);
    expect(opts.find(o => o.key === 'u:tbsp').grams).toBe(15);
    // the generic 'g' from unitDefaults is skipped (base already present)
    expect(opts.filter(o => o.label === 'grams')).toHaveLength(1);
  });
  it('drops measures with non-positive grams', () => {
    const opts = portionOptions([{ label: 'bad', grams: 0 }], []);
    expect(opts).toHaveLength(1);
  });
});

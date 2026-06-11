import { describe, it, expect } from 'vitest';
import { loadRecipes } from '../../data/recipes.js';

const RECIPES = await loadRecipes();

const VALID_SLOTS = new Set(['fat', 'protein', 'vegcarb', 'fibre', 'proteincarb']);
const VALID_PHASES = new Set(['detox', 'reintro', 'both']);

describe('RECIPES data integrity', () => {
  it('contains at least 20 recipes', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(20);
  });

  it('every recipe has a unique id', () => {
    const ids = RECIPES.map(r => r.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every recipe has required fields', () => {
    for (const r of RECIPES) {
      expect(r.id, `${r.id} missing id`).toBeTruthy();
      expect(r.name, `${r.id} missing name`).toBeTruthy();
      expect(r.slot, `${r.id} missing slot`).toBeTruthy();
      expect(r.phase, `${r.id} missing phase`).toBeTruthy();
      expect(r.kcal, `${r.id} missing kcal`).toBeGreaterThan(0);
      expect(Array.isArray(r.requiredSafeFoods), `${r.id} requiredSafeFoods must be array`).toBe(true);
    }
  });

  it('every recipe has a valid slot type', () => {
    for (const r of RECIPES) {
      expect(VALID_SLOTS.has(r.slot), `${r.id} has invalid slot "${r.slot}"`).toBe(true);
    }
  });

  it('every recipe has a valid phase', () => {
    for (const r of RECIPES) {
      expect(VALID_PHASES.has(r.phase), `${r.id} has invalid phase "${r.phase}"`).toBe(true);
    }
  });

  it('detox-phase recipes have no requiredSafeFoods', () => {
    for (const r of RECIPES.filter(r => r.phase === 'detox')) {
      expect(r.requiredSafeFoods, `${r.id} detox recipe should need no safe foods`).toHaveLength(0);
    }
  });

  it('all recipes have a positive kcal value', () => {
    for (const r of RECIPES) {
      expect(r.kcal, `${r.id} has non-positive kcal`).toBeGreaterThan(0);
    }
  });

  it('exists at least one recipe per standard slot type', () => {
    for (const slot of ['fat', 'protein', 'vegcarb', 'fibre']) {
      const count = RECIPES.filter(r => r.slot === slot).length;
      expect(count, `no recipes for slot "${slot}"`).toBeGreaterThan(0);
    }
  });

  it('proteincarb recipes are all reintro-phase only', () => {
    const combined = RECIPES.filter(r => r.slot === 'proteincarb');
    expect(combined.length).toBeGreaterThan(0);
    expect(combined.every(r => r.phase === 'reintro')).toBe(true);
  });

  // Curated proteincarb meals are hand-authored to combine ≥2 tracked safe foods.
  // Corpus recipes only map back to the ~121 tracked foods, so their requiredSafeFoods
  // count is a partial signal (most ingredients aren't tracked) — this invariant is
  // therefore curated-scoped.
  it('curated proteincarb recipes all require at least 2 safe foods', () => {
    const combined = RECIPES.filter(r => r.slot === 'proteincarb' && r.source === 'CURATED');
    for (const r of combined) {
      expect(r.requiredSafeFoods.length, `${r.id} should require ≥2 safe foods`).toBeGreaterThanOrEqual(2);
    }
  });

  it('proteincarb recipes have enough calories for a combined meal (≥200 kcal)', () => {
    const combined = RECIPES.filter(r => r.slot === 'proteincarb');
    for (const r of combined) {
      expect(r.kcal, `${r.id} kcal too low for a combined meal`).toBeGreaterThanOrEqual(200);
    }
  });

  it('no recipe exceeds 600 kcal', () => {
    for (const r of RECIPES) {
      expect(r.kcal, `${r.id} exceeds 600 kcal`).toBeLessThanOrEqual(600);
    }
  });
});

import { describe, it, expect } from 'vitest';
import { migrateState, APP_VERSION } from '../migrations.js';
import { DEFAULT_FOODS } from '../../data/foods.js';

function makeBase() {
  // Minimal valid saved state
  return {
    foods: [{ id: 'apple', name: 'Apple', group: 'Fruits', portion: '1' }],
    removed: [],
    intake: {},
    observations: {},
    status: {},
  };
}

function initialState() {
  return {
    appVersion: APP_VERSION,
    foods: DEFAULT_FOODS,
    removed: [],
    intake: {},
    observations: {},
    status: {},
    body: { profile: { heightCm: '', neckCm: '' }, weights: [], measurements: [], unit: 'cm' },
    nutrition: { dailyCalories: 800, macros: { fat: 25, carbs: 20, protein: 35, fibre: 20 }, mealMerge: null },
    favourites: [],
    programmeStart: '2026-01-01',
    detoxDuration: 14,
    weightGoal: null,
    onboardingComplete: false,
    introOrder: 'standard',
    preferredGroups: [],
    priorityFoods: [],
    user: { name: 'User', programme: 'Food Reintroduction' },
  };
}

describe('migrateState', () => {
  it('returns base state when savedState is null', () => {
    const result = migrateState(null, initialState);
    expect(result.foods.length).toBeGreaterThan(0); // default foods
  });

  it('returns base state when savedState has no foods array', () => {
    const result = migrateState({ status: {} }, initialState);
    expect(Array.isArray(result.foods)).toBe(true);
  });

  it('preserves existing food entries from saved state', () => {
    const saved = makeBase();
    const result = migrateState(saved, initialState);
    expect(result.foods.some(f => f.id === 'apple')).toBe(true);
  });

  it('backfills missing default foods not in saved state', () => {
    const saved = makeBase(); // only has 'apple'
    const result = migrateState(saved, initialState);
    // Should have more than just 'apple' (default foods are added)
    expect(result.foods.length).toBeGreaterThan(1);
  });

  it('sets appVersion to current APP_VERSION', () => {
    const result = migrateState(makeBase(), initialState);
    expect(result.appVersion).toBe(APP_VERSION);
  });

  it('backfills nutrition when missing from saved state', () => {
    const saved = makeBase(); // no nutrition field
    const result = migrateState(saved, initialState);
    expect(result.nutrition.dailyCalories).toBe(800);
    expect(result.nutrition.macros.protein).toBe(35);
  });

  it('backfills mealMerge when missing from saved nutrition', () => {
    const saved = { ...makeBase(), nutrition: { dailyCalories: 1000, macros: { fat: 25, carbs: 20, protein: 35, fibre: 20 } } };
    const result = migrateState(saved, initialState);
    expect(result.nutrition.mealMerge).toBeNull();
  });

  it('preserves existing mealMerge value', () => {
    const saved = { ...makeBase(), nutrition: { dailyCalories: 1000, macros: { fat: 25, carbs: 20, protein: 35, fibre: 20 }, mealMerge: '2pm' } };
    const result = migrateState(saved, initialState);
    expect(result.nutrition.mealMerge).toBe('2pm');
  });

  it('preserves existing nutrition when present', () => {
    const saved = { ...makeBase(), nutrition: { dailyCalories: 1200, macros: { fat: 30, carbs: 25, protein: 30, fibre: 15 } } };
    const result = migrateState(saved, initialState);
    expect(result.nutrition.dailyCalories).toBe(1200);
  });

  it('backfills detoxDuration to 14 when missing', () => {
    const result = migrateState(makeBase(), initialState);
    expect(result.detoxDuration).toBe(14);
  });

  it('preserves custom detoxDuration', () => {
    const saved = { ...makeBase(), detoxDuration: 7 };
    const result = migrateState(saved, initialState);
    expect(result.detoxDuration).toBe(7);
  });

  it('backfills body structure when missing', () => {
    const result = migrateState(makeBase(), initialState);
    expect(result.body.weights).toEqual([]);
    expect(result.body.measurements).toEqual([]);
  });

  it('backfills onboardingComplete to true for existing users', () => {
    const result = migrateState(makeBase(), initialState);
    expect(result.onboardingComplete).toBe(true);
  });

  it('preserves favourites array', () => {
    const saved = { ...makeBase(), favourites: ['recipe-1', 'recipe-2'] };
    const result = migrateState(saved, initialState);
    expect(result.favourites).toEqual(['recipe-1', 'recipe-2']);
  });

  it('initialises favourites to [] when missing', () => {
    const result = migrateState(makeBase(), initialState);
    expect(result.favourites).toEqual([]);
  });
});

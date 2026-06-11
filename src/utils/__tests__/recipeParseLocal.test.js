import { describe, it, expect } from 'vitest';
import { parseRecipeLocal } from '../recipeParseLocal.js';

const byName = (lines, name) => lines.find(l => l.ingredient_guess === name);

describe('parseRecipeLocal', () => {
  it('parses qty + unit + ingredient per newline', () => {
    const { lines } = parseRecipeLocal('2 cups basmati rice\n1 tbsp ghee\n200 g paneer');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ qty: 2, unit: 'cup', ingredient_guess: 'basmati rice' });
    expect(lines[1]).toMatchObject({ qty: 1, unit: 'tbsp', ingredient_guess: 'ghee' });
    expect(lines[2]).toMatchObject({ qty: 200, unit: 'g', ingredient_guess: 'paneer' });
  });

  it('handles fractions, mixed numbers and unicode fractions', () => {
    const { lines } = parseRecipeLocal('1/2 cup milk\n1 1/2 cup curd\n½ tsp salt');
    expect(lines[0].qty).toBeCloseTo(0.5);
    expect(lines[1].qty).toBeCloseTo(1.5);
    expect(lines[2].qty).toBeCloseTo(0.5);
  });

  it('converts metric/imperial weights to g/ml', () => {
    const { lines } = parseRecipeLocal('1 kg chicken\n2 oz butter\n1 l water');
    expect(byName(lines, 'chicken')).toMatchObject({ qty: 1000, unit: 'g' });
    expect(byName(lines, 'butter').qty).toBeCloseTo(56.7, 1);
    expect(byName(lines, 'butter').unit).toBe('g');
    expect(byName(lines, 'water')).toMatchObject({ qty: 1000, unit: 'ml' });
  });

  it('strips prep words and parentheticals; keeps clean ingredient', () => {
    const { lines } = parseRecipeLocal('1 onion (finely chopped)\n2 cloves garlic, minced');
    expect(lines[0].ingredient_guess).toBe('onion');
    expect(lines[1].ingredient_guess).toContain('garlic');
  });

  it('keeps qty-less seasoning lines but drops instruction-like lines', () => {
    const { lines } = parseRecipeLocal('salt to taste\nHeat the oil in a large pan and fry the onions until golden brown');
    expect(byName(lines, 'salt')).toBeTruthy();
    expect(byName(lines, 'salt').qty).toBeNull();
    expect(lines.some(l => l.ingredient_guess.includes('Heat'))).toBe(false);
  });

  it('skips section headers and detects servings', () => {
    const { servings, lines } = parseRecipeLocal('For the curry:\n200 g paneer\nServes 4');
    expect(servings).toBe(4);
    expect(lines.some(l => l.ingredient_guess.includes('curry'))).toBe(false);
  });

  it('splits a comma-only blob into lines', () => {
    const { lines } = parseRecipeLocal('2 eggs, 1 cup flour, 1 tsp sugar');
    expect(lines).toHaveLength(3);
  });

  it('never emits a unit outside the allowed set', () => {
    const allowed = new Set(['g', 'ml', 'tsp', 'tbsp', 'cup', 'katori', 'bowl', 'glass', 'piece', 'slice', 'handful', 'plate']);
    const { lines } = parseRecipeLocal('3 cloves garlic\n1 sprig coriander\n2 cups rice');
    for (const l of lines) expect(l.unit === null || allowed.has(l.unit)).toBe(true);
  });
});

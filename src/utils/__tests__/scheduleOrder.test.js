import { describe, it, expect } from 'vitest';
import { parseGroupOrder, normaliseGroupOrder, ALL_GROUP_NAMES } from '../scheduleOrder.js';

const DAIRY = "Dairy";
const MEAT = "Animal protein";
const VEG = "Vegetables";
const SWEET = "Sweeteners";
const CARBS = "Grains / carbs";
const DALS = "Dals / pulses / nuts / seeds";

describe('parseGroupOrder — mention order', () => {
  it('orders by sequence of mention: "dairy first, meats second"', () => {
    const { order, matched, recognized } = parseGroupOrder("do dairy first and meats second");
    expect(recognized).toBe(2);
    expect(matched).toEqual([DAIRY, MEAT]);
    expect(order[0]).toBe(DAIRY);
    expect(order[1]).toBe(MEAT);
  });

  it('keeps unmatched groups after matched ones, in default order', () => {
    const { order } = parseGroupOrder("meats first");
    expect(order[0]).toBe(MEAT);
    // every group present exactly once
    expect(new Set(order).size).toBe(order.length);
    expect(order.length).toBe(ALL_GROUP_NAMES.length);
  });

  it('resolves aliases (meats→Animal protein, veg→Vegetables, carbs→Grains)', () => {
    const { matched } = parseGroupOrder("veggies, then carbs, then meat");
    expect(matched).toEqual([VEG, CARBS, MEAT]);
  });

  it('matches multi-word group names like "animal protein"', () => {
    const { matched } = parseGroupOrder("animal protein before dairy");
    expect(matched).toEqual([MEAT, DAIRY]);
  });
});

describe('parseGroupOrder — last/end handling', () => {
  it('pushes "X last" to the end even if mentioned early', () => {
    const { order } = parseGroupOrder("sugar last, dairy first");
    expect(order[0]).toBe(DAIRY);
    expect(order[order.length - 1]).toBe(SWEET);
  });

  it('"end" keyword also pushes to the back', () => {
    const { order } = parseGroupOrder("put processed food at the end");
    expect(order[order.length - 1]).toBe("Processed / outside food");
  });
});

describe('parseGroupOrder — word boundaries & misses', () => {
  it('does NOT match "egg" inside "veggies"', () => {
    const { matched } = parseGroupOrder("veggies please");
    expect(matched).toEqual([VEG]);
    expect(matched).not.toContain(MEAT);
  });

  it('returns recognized=0 for text with no known group', () => {
    const { recognized } = parseGroupOrder("comfort foods I really miss");
    expect(recognized).toBe(0);
  });

  it('restricts output to the available groups passed in', () => {
    const available = [DAIRY, MEAT, VEG];
    const { order } = parseGroupOrder("meats first", available);
    expect(order).toEqual([MEAT, DAIRY, VEG]);
  });
});

describe('normaliseGroupOrder', () => {
  it('dedupes, drops unknowns, and appends missing groups', () => {
    const available = [DAIRY, MEAT, VEG];
    const out = normaliseGroupOrder([MEAT, "Bogus", MEAT], available);
    expect(out).toEqual([MEAT, DAIRY, VEG]);
  });

  it('returns full available list when proposal is empty', () => {
    const available = [DAIRY, MEAT];
    expect(normaliseGroupOrder([], available)).toEqual([DAIRY, MEAT]);
    expect(normaliseGroupOrder(null, available)).toEqual([DAIRY, MEAT]);
  });
});

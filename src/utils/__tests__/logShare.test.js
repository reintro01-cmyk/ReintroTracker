import { describe, it, expect } from "vitest";
import { buildLogShareText, portionText, groupLogsByMeal } from "../logShare.js";

describe("portionText", () => {
  it("prefers the household unit over grams", () => {
    expect(portionText({ qty: 1, unit: "katori", grams: 150 })).toBe("1 katori");
  });
  it("falls back to grams when the unit is plain grams", () => {
    expect(portionText({ qty: 200, unit: "g", grams: 200 })).toBe("200g");
  });
  it("uses grams when no unit is given", () => {
    expect(portionText({ grams: 80 })).toBe("80g");
  });
  it("is empty when there is nothing to show", () => {
    expect(portionText({})).toBe("");
  });
});

describe("groupLogsByMeal", () => {
  it("orders meals breakfast→snack and groups items", () => {
    const g = groupLogsByMeal([
      { meal: "dinner", custom_name: "Dal" },
      { meal: "breakfast", custom_name: "Eggs" },
      { meal: "breakfast", custom_name: "Oats" },
    ]);
    expect(g.map(x => x.meal)).toEqual(["breakfast", "dinner"]);
    expect(g[0].items).toHaveLength(2);
  });
});

describe("buildLogShareText", () => {
  it("lists meals, items, portions and a total", () => {
    const txt = buildLogShareText({
      logs: [
        { meal: "breakfast", custom_name: "Eggs", qty: 2, unit: "piece", grams: 100 },
        { meal: "breakfast", custom_name: "Oats", grams: 40, unit: "g" },
        { meal: "lunch", custom_name: "Dal", qty: 1, unit: "katori", grams: 150 },
      ],
      dateIso: "2026-06-17",
      totalKcal: 1450,
    });
    expect(txt).toContain("Breakfast");
    expect(txt).toContain("• Eggs — 2 piece");
    expect(txt).toContain("• Oats — 40g");
    expect(txt).toContain("Lunch");
    expect(txt).toContain("• Dal — 1 katori");
    expect(txt).toContain("Total: 1450 kcal");
  });
  it("omits the total line when not provided", () => {
    const txt = buildLogShareText({
      logs: [{ meal: "snack", custom_name: "Apple", grams: 120 }],
      dateIso: "2026-06-17",
    });
    expect(txt).not.toContain("Total:");
  });
});
